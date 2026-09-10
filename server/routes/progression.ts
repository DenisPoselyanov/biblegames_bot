/**
 * Server-authoritative progression commands (Phase 1 §7.2).
 *
 * `POST /api/v1/progression/completions` and `/answers`: the client reports a
 * bounded, validated activity result and the server computes the reward, writes
 * an idempotent wallet entry, persists the authoritative progression state, and
 * returns a typed outcome with a stable `eventId`.
 *
 * When a database is wired (`service` present, ADR-016) the reward runs in one
 * transaction against the typed `progression_state` / `achievement_grants` /
 * `player_theme_stats` tables with a `FOR UPDATE` row lock; otherwise it falls
 * back to the legacy whole-blob read-modify-write on `dbStore`.
 */

import { createHash } from 'node:crypto';
import { Router, type Request } from 'express';
import { progressionContract } from '../../contracts/index';
import { asyncHandler } from '../middleware/asyncHandler';
import { validateBody } from '../middleware/validate';
import { AppError, UnauthorizedError } from '../lib/errors';
import { metrics } from '../lib/metrics';
import type { ServerStore } from '../db/store';
import type { WalletLedger } from '../wallet';
import type { IdempotencyStore } from '../lib/idempotency';
import {
  computeCompletion,
  snapshotFromProfile,
  type CompletionInput,
  type CompletionKind,
  type CompletionResult,
  type ProgressionSnapshot,
} from '../progression/completionOutcome';
import { emptyProfile } from '../services/profileService';
import { recordThemePlay } from '../progression/globalStats';
import { updateMastery, MASTERY_EXPERT_THRESHOLD } from '../progression/masteryMath';
import type { MasteryState } from '../../src/types/index';
import type { ProgressionService } from '../services/progressionService';

export interface ProgressionRouterDeps {
  dbStore: ServerStore;
  walletLedger: WalletLedger;
  idempotency: IdempotencyStore;
  /** Transactional reward service — present only when a database is wired (ADR-016). */
  service?: ProgressionService;
}

const KINDS: readonly CompletionKind[] = ['level', 'practice_stage', 'millionaire', 'survival'];

interface ProgressionOutcome {
  eventId: string;
  previous: ProgressionSnapshot;
  next: ProgressionSnapshot;
  delta: CompletionResult['delta'];
  occurredAt: string;
}

function principal(req: Request): { userId: string } {
  if (!req.auth) throw new UnauthorizedError('missing_credentials', 'Authentication required');
  return { userId: req.auth.userId };
}

function eventId(userId: string, sourceId: string): string {
  // NUL separator (was a raw 0x00 byte in source — see git history; kept byte-identical
  // via the `\0` escape so existing `eventId` values do not shift).
  return createHash('sha256').update(`${userId}\0${sourceId}`).digest('hex').slice(0, 32);
}

function readCompletionBody(body: unknown): { input: CompletionInput; idempotencyKey: string; sourceId: string } {
  if (!body || typeof body !== 'object') throw new AppError('invalid_completion', 'Body required', 400);
  const b = body as Record<string, unknown>;
  const kind = b.kind as CompletionKind;
  if (!KINDS.includes(kind)) throw new AppError('invalid_completion', 'Unknown kind', 400);

  const idempotencyKey = String(b.idempotencyKey ?? '').trim();
  const runId = String(b.runId ?? '').trim();
  if (!idempotencyKey) throw new AppError('invalid_completion', 'idempotencyKey required', 400);
  if (!runId) throw new AppError('invalid_completion', 'runId required', 400);

  const stagePart = b.stageIndex !== undefined ? `:${Number(b.stageIndex)}` : '';
  return {
    idempotencyKey,
    sourceId: `${kind}:${runId}${stagePart}`,
    input: {
      kind,
      difficulty: b.difficulty as string | undefined,
      themeId: b.themeId as string | undefined,
      nodeId: (b.nodeId ?? null) as string | null,
      stageIndex: b.stageIndex as number | undefined,
      stageCount: b.stageCount as number | undefined,
      questionIds: Array.isArray(b.questionIds)
        ? (b.questionIds as unknown[]).slice(0, 100).map(String)
        : undefined,
      correctCount: b.correctCount as number | undefined,
      totalQuestions: b.totalQuestions as number | undefined,
      reachedLevel: b.reachedLevel as number | undefined,
      runLength: b.runLength as number | undefined,
      score: b.score as number | undefined,
    },
  };
}

interface AnswerBody {
  questionId: string;
  idempotencyKey: string;
  isCorrect: boolean;
  nodeId: string;
  errorTag: string;
}

function readAnswerBody(body: unknown): AnswerBody {
  const b = (body ?? {}) as Record<string, unknown>;
  const questionId = String(b.questionId ?? '').trim().slice(0, 128);
  const idempotencyKey = String(b.idempotencyKey ?? '').trim();
  if (!questionId) throw new AppError('invalid_answer', 'questionId required', 400);
  if (!idempotencyKey) throw new AppError('invalid_answer', 'idempotencyKey required', 400);
  if (typeof b.isCorrect !== 'boolean') {
    throw new AppError('invalid_answer', 'isCorrect must be a boolean', 400);
  }
  const themeId = String(b.themeId ?? '').trim().slice(0, 64);
  const rawNode =
    (typeof b.nodeId === 'string' && b.nodeId) ||
    (typeof b.subthemeId === 'string' && b.subthemeId) ||
    themeId;
  const nodeId = String(rawNode).trim().slice(0, 128);
  if (!nodeId) throw new AppError('invalid_answer', 'themeId or nodeId required', 400);
  const errorTag =
    typeof b.errorTag === 'string' && b.errorTag ? b.errorTag.slice(0, 64) : 'knowledge-gap';
  return { questionId, idempotencyKey, isCorrect: b.isCorrect, nodeId, errorTag };
}

export function createProgressionRouter({
  dbStore,
  walletLedger,
  idempotency,
  service,
}: ProgressionRouterDeps): Router {
  const router = Router();

  router.post(
    '/completions',
    validateBody(progressionContract.completionRequest, 'invalid_completion'),
    asyncHandler(async (req, res) => {
      const { userId } = principal(req);
      const { input, idempotencyKey, sourceId } = readCompletionBody(req.body);
      const scopedKey = `progression.completion:${userId}:${idempotencyKey}`;

      const cached = await idempotency.recall(scopedKey);
      if (cached) {
        metrics.inc('idempotency_replay_total', { surface: 'progression' });
        res.json(cached.result);
        return;
      }

      const outcome: ProgressionOutcome = service
        ? await service.applyCompletion(userId, input, sourceId)
        : await applyCompletionBlob({ dbStore, walletLedger, userId, input, sourceId });

      await idempotency.remember(scopedKey, outcome);
      res.json(outcome);
    }),
  );

  router.post(
    '/answers',
    validateBody(progressionContract.answerRequest, 'invalid_answer'),
    asyncHandler(async (req, res) => {
      const { userId } = principal(req);
      const body = readAnswerBody(req.body);
      const scopedKey = `progression.answer:${userId}:${body.idempotencyKey}`;

      const cached = await idempotency.recall(scopedKey);
      if (cached) {
        metrics.inc('idempotency_replay_total', { surface: 'progression' });
        res.json(cached.result);
        return;
      }

      const outcome = service
        ? await service.applyAnswer(userId, {
            questionId: body.questionId,
            idempotencyKey: body.idempotencyKey,
            isCorrect: body.isCorrect,
            nodeId: body.nodeId,
            subthemeId: body.nodeId,
            errorTag: body.errorTag,
          })
        : await applyAnswerBlob({ dbStore, userId, body });

      await idempotency.remember(scopedKey, outcome);
      res.json(outcome);
    }),
  );

  return router;
}

// --- Legacy whole-blob path (no database wired) -----------------------------

async function applyCompletionBlob(args: {
  dbStore: ServerStore;
  walletLedger: WalletLedger;
  userId: string;
  input: CompletionInput;
  sourceId: string;
}): Promise<ProgressionOutcome> {
  const { dbStore, walletLedger, userId, input, sourceId } = args;
  const stored = (await dbStore.getProfile(userId)) ?? emptyProfile(userId);
  const previous = snapshotFromProfile(stored);
  const { next, delta } = computeCompletion(input, previous);

  let balanceAfter: number;
  if (delta.coins !== 0) {
    const { entry } = await walletLedger.post({
      userId,
      type: 'earn',
      amount: delta.coins,
      sourceType: 'progression.completion',
      sourceId,
      metadata: { kind: input.kind },
    });
    balanceAfter = entry.balanceAfter;
  } else {
    balanceAfter = await walletLedger.getBalance(userId);
  }
  next.coins = balanceAfter;

  await dbStore.setProfile(userId, {
    ...stored,
    coins: balanceAfter,
    playerRank: {
      tier: next.rankTier,
      plaque: next.rankPlaque,
      wisdomPoints: next.wisdom,
      unlockedTier: next.rankUnlockedTier,
    },
    streakDays: next.streakDays,
    lastActiveAt: next.lastActiveAt,
    completedLevels: next.completedLevels,
    millionaireWins: next.millionaireWins,
    millionaireMaxLevel: next.millionaireMaxLevel,
    survivalHighScore: next.survivalHighScore,
    achievements: next.achievements,
    themePoints: next.themePoints,
    practiceTracks: next.practiceTracks,
    studyMastery: next.studyMastery,
    updatedAt: new Date().toISOString(),
  });

  if (delta.coins > 0 && (input.kind === 'level' || input.kind === 'practice_stage') && input.themeId) {
    const themeId = String(input.themeId).slice(0, 64);
    const hadThemePoints = (previous.themePoints[themeId] ?? 0) > 0;
    const stats = await dbStore.getStats(userId);
    const nextStats = recordThemePlay(stats, themeId, delta.coins, !hadThemePoints);
    await dbStore.setStats(userId, nextStats as unknown as Record<string, unknown>);
  }

  return {
    eventId: eventId(userId, sourceId),
    previous,
    next,
    delta,
    occurredAt: new Date().toISOString(),
  };
}

async function applyAnswerBlob(args: {
  dbStore: ServerStore;
  userId: string;
  body: AnswerBody;
}): Promise<{ nodeId: string; mastery: MasteryState; achievementsGranted: string[]; answeredAt: string }> {
  const { dbStore, userId, body } = args;
  const stored = (await dbStore.getProfile(userId)) ?? emptyProfile(userId);
  const mastery =
    stored.studyMastery && typeof stored.studyMastery === 'object'
      ? (stored.studyMastery as Record<string, MasteryState>)
      : {};
  const nextState = updateMastery(mastery[body.nodeId], body.isCorrect, body.errorTag);
  const nextMastery = { ...mastery, [body.nodeId]: nextState };

  const achievements = Array.isArray(stored.achievements) ? [...(stored.achievements as string[])] : [];
  const granted: string[] = [];
  if (nextState.mastery >= MASTERY_EXPERT_THRESHOLD && !achievements.includes('mastery-expert')) {
    achievements.push('mastery-expert');
    granted.push('mastery-expert');
  }

  await dbStore.setProfile(userId, {
    ...stored,
    studyMastery: nextMastery,
    achievements,
    updatedAt: new Date().toISOString(),
  });

  const answeredAt = new Date().toISOString();
  const history = await dbStore.getStudyAnswers(userId);
  history.push({
    questionId: body.questionId,
    subthemeId: body.nodeId,
    nodeId: body.nodeId,
    isCorrect: body.isCorrect,
    answeredAt,
    errorTag: body.isCorrect ? undefined : body.errorTag,
  });
  await dbStore.setStudyAnswers(userId, history.slice(-5000));

  return { nodeId: body.nodeId, mastery: nextState, achievementsGranted: granted, answeredAt };
}
