/**
 * Transactional reward orchestration (Phase 2 §18.2, ADR-016).
 *
 * Replaces the non-atomic read-modify-write of the `player_profiles` /
 * `player_stats` blobs in `server/routes/progression.ts`. Each command opens one
 * `db.transaction`, takes the `progression_state` row lock (`FOR UPDATE`), and
 * threads that transaction through every write — the typed repos, the wallet
 * ledger, and (until `LEGACY_PROGRESSION_READONLY`) the legacy blob mirror — so
 * concurrent submissions for one user serialise and a mid-command failure rolls
 * the whole thing back.
 *
 * Idempotency (`recall` / `remember`) stays in the route: the wallet's
 * `(sourceType, sourceId)` unique constraint plus the row lock are the
 * correctness guarantees; the idempotency store is only a response cache.
 *
 * SQL-only — constructed by `server/app.ts` only when a database is wired.
 * ADR-006 forbids the JSON / in-memory stores emulating transactions, and JSON
 * is being retired for this data.
 */
import { createHash } from 'node:crypto';
import type { Database } from '../infrastructure/database/client';
import type { Transaction as OpaqueTx } from '../domains/shared/context';
import type { EntitlementRepository } from '../domains/economy/entitlements';
import type { ProgressionRepositories } from '../domains/progression/repository';
import { snapshotToState, stateToSnapshot } from '../domains/progression/mapSnapshot';
import {
  computeCompletion,
  type CompletionInput,
  type CompletionResult,
  type ProgressionSnapshot,
} from '../progression/completionOutcome';
import { updateMastery, MASTERY_EXPERT_THRESHOLD } from '../progression/masteryMath';
import type { MasteryState } from '../../src/types/index';
import type { WalletLedger } from '../wallet';
import type { LegacyBlobMirror } from './legacyBlobMirror';

export interface ProgressionOutcome {
  eventId: string;
  previous: ProgressionSnapshot;
  next: ProgressionSnapshot;
  delta: CompletionResult['delta'];
  occurredAt: string;
}

export interface AnswerInput {
  questionId: string;
  idempotencyKey: string;
  isCorrect: boolean;
  nodeId: string;
  subthemeId: string;
  errorTag: string;
}

export interface AnswerOutcome {
  nodeId: string;
  mastery: MasteryState;
  achievementsGranted: string[];
  answeredAt: string;
}

export interface ProgressionServiceDeps {
  db: Database;
  repos: ProgressionRepositories;
  entitlements: EntitlementRepository;
  walletLedger: WalletLedger;
  legacyBlobMirror: LegacyBlobMirror;
  legacyReadOnly: boolean;
  now: () => Date;
}

export interface ProgressionService {
  applyCompletion(
    userId: string,
    input: CompletionInput,
    sourceId: string,
  ): Promise<ProgressionOutcome>;
  applyAnswer(userId: string, input: AnswerInput): Promise<AnswerOutcome>;
}

function eventId(userId: string, sourceId: string): string {
  return createHash('sha256').update(`${userId}\0${sourceId}`).digest('hex').slice(0, 32);
}

export function createProgressionService(deps: ProgressionServiceDeps): ProgressionService {
  const { db, repos, walletLedger, legacyBlobMirror, legacyReadOnly, now } = deps;

  return {
    async applyCompletion(userId, input, sourceId) {
      return db.transaction(async (txHandle) => {
        const tx = txHandle as unknown as OpaqueTx;

        await repos.state.ensureRow(userId, tx);
        const state = await repos.state.get(userId, tx, { forUpdate: true });
        const grants = await repos.achievements.list(userId, tx);
        const previous = stateToSnapshot(state, grants);
        previous.coins = await walletLedger.getBalance(userId, tx);

        const { next, delta } = computeCompletion(input, previous, now());

        let balanceAfter = previous.coins;
        if (delta.coins !== 0) {
          const { entry } = await walletLedger.post(
            {
              userId,
              type: 'earn',
              amount: delta.coins,
              sourceType: 'progression.completion',
              sourceId,
              metadata: { kind: input.kind },
            },
            tx,
          );
          balanceAfter = entry.balanceAfter;
        }
        next.coins = balanceAfter;

        await repos.state.upsert(userId, snapshotToState(next), tx);
        for (const achievementId of delta.achievementsGranted) {
          await repos.achievements.grant(
            { userId, achievementId, sourceType: 'progression.completion', sourceId },
            tx,
          );
        }

        if (
          delta.coins > 0 &&
          (input.kind === 'level' || input.kind === 'practice_stage') &&
          input.themeId
        ) {
          const themeId = String(input.themeId).slice(0, 64);
          const hadThemePoints = (previous.themePoints[themeId] ?? 0) > 0;
          await repos.themeStats.recordPlay({ userId, themeId, points: delta.coins }, tx);
          if (!legacyReadOnly) {
            await legacyBlobMirror.recordThemePlay(
              userId,
              themeId,
              delta.coins,
              !hadThemePoints,
              tx,
            );
          }
        }

        if (!legacyReadOnly) {
          await legacyBlobMirror.writeProfile(userId, next, balanceAfter, tx);
        }

        return {
          eventId: eventId(userId, sourceId),
          previous,
          next,
          delta,
          occurredAt: now().toISOString(),
        };
      });
    },

    async applyAnswer(userId, input) {
      return db.transaction(async (txHandle) => {
        const tx = txHandle as unknown as OpaqueTx;

        await repos.state.ensureRow(userId, tx);
        const state = await repos.state.get(userId, tx, { forUpdate: true });
        const grants = await repos.achievements.list(userId, tx);
        const snapshot = stateToSnapshot(state, grants);

        const mastery = snapshot.studyMastery as Record<string, MasteryState>;
        const nextState = updateMastery(mastery[input.nodeId], input.isCorrect, input.errorTag, now());
        snapshot.studyMastery = { ...mastery, [input.nodeId]: nextState };

        const granted: string[] = [];
        if (
          nextState.mastery >= MASTERY_EXPERT_THRESHOLD &&
          !snapshot.achievements.includes('mastery-expert')
        ) {
          granted.push('mastery-expert');
          snapshot.achievements = [...snapshot.achievements, 'mastery-expert'];
        }

        await repos.state.upsert(userId, snapshotToState(snapshot), tx);
        for (const achievementId of granted) {
          await repos.achievements.grant(
            { userId, achievementId, sourceType: 'progression.answer', sourceId: input.idempotencyKey },
            tx,
          );
        }

        const answeredAt = now().toISOString();
        await repos.answers.append(
          {
            userId,
            questionId: input.questionId,
            subthemeId: input.subthemeId,
            isCorrect: input.isCorrect,
            answeredAt,
            idempotencyKey: input.idempotencyKey,
            payload: {
              questionId: input.questionId,
              subthemeId: input.subthemeId,
              nodeId: input.nodeId,
              isCorrect: input.isCorrect,
              answeredAt,
              errorTag: input.isCorrect ? undefined : input.errorTag,
            },
          },
          tx,
        );

        if (!legacyReadOnly) {
          await legacyBlobMirror.writeAnswerState(
            userId,
            snapshot.studyMastery,
            snapshot.achievements,
            tx,
          );
        }

        return { nodeId: input.nodeId, mastery: nextState, achievementsGranted: granted, answeredAt };
      });
    },
  };
}
