/**
 * Server-authoritative reward computation (Phase 1 §7.2, ADR-003).
 *
 * The client sends *what happened* (bounded, validated inputs); the server
 * decides *what it is worth*. Client-supplied coins/wisdom/rank/wins are never
 * read here. Formulas are deliberately simple and conservative for Phase 1 —
 * the full progression model is Phase 2/3 (§7.2, §18).
 */

import {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  DIFFICULTY_POINTS,
  getMillionaireSafePoints,
  MILLIONAIRE_LEVEL_POINTS,
  MILLIONAIRE_WIN_BONUS,
  SURVIVAL_POINTS_BY_DIFFICULTY,
  SURVIVAL_STARTING_LIVES,
  type Difficulty,
  type MasteryState,
  type PracticeStageResult,
  type PracticeTrackProgress,
  type Question,
} from '../../src/types/index';
import { AppError } from '../lib/errors';
import { recomputeStreak } from '../lib/streak';
import { advancePlayerRank, computeStageWisdom, getDefaultPlayerRank } from './rankMath';
import { applyPracticeStage } from './practiceTracks';
import { getQuestionsByIds } from '../services/questionService';

export type CompletionKind = 'level' | 'practice_stage' | 'millionaire' | 'survival';

export const MAX_QUESTIONS = 100;
export const SURVIVAL_MAX_SCORE = 1000;
export const MILLIONAIRE_MAX_LEVEL = MILLIONAIRE_LEVEL_POINTS.length;
export const PRACTICE_PASS_MIN_CORRECT = 7;
/** Survival correct-answer count that earns the `iron-shield` achievement (src/pages/play/Survival.tsx). */
export const SURVIVAL_IRON_SHIELD_MIN = 30;

/** A single answer in a millionaire/survival run's validated trail (WS9, §15.2/§15.3). */
export interface CompletionAnswer {
  questionId: string;
  selectedIndex: number;
}

/** Looks up the real questions (incl. `correctIndex`) behind a submitted answer trail. Injectable for tests. */
export type QuestionLookup = (ids: string[]) => Promise<Pick<Question, 'id' | 'correctIndex' | 'difficulty'>[]>;

const defaultLookupQuestions: QuestionLookup = (ids) => getQuestionsByIds(ids);

export interface CompletionInput {
  kind: CompletionKind;
  difficulty?: string;
  themeId?: string;
  nodeId?: string | null;
  stageIndex?: number;
  /** Client hint for the track's total stage count (1..12); caps the upper unlock bound only. */
  stageCount?: number;
  questionIds?: string[];
  correctCount?: number;
  totalQuestions?: number;
  reachedLevel?: number;
  runLength?: number;
  score?: number;
  answers?: CompletionAnswer[];
}

export interface ProgressionSnapshot {
  coins: number;
  wisdom: number;
  rankTier: Difficulty;
  rankPlaque: number;
  rankUnlockedTier: Difficulty;
  streakDays: number;
  lastActiveAt: string | null;
  millionaireWins: number;
  millionaireMaxLevel: number;
  survivalHighScore: number;
  completedLevels: Array<Record<string, unknown>>;
  achievements: string[];
  themePoints: Record<string, number>;
  practiceTracks: PracticeTrackProgress[];
  studyMastery: Record<string, MasteryState>;
}

export interface CompletionResult {
  next: ProgressionSnapshot;
  delta: {
    coins: number;
    wisdom: number;
    levelChanged: boolean;
    rankChanged: boolean;
    achievementsGranted: string[];
    /** practice_stage only — lets the client render its result screen without recomputing. */
    stageResult?: PracticeStageResult;
    nextStageUnlocked?: boolean;
    stagePerfect?: boolean;
    passed?: boolean;
  };
}

function bad(message: string): never {
  throw new AppError('invalid_completion', message, 400);
}

function requireDifficulty(raw: string | undefined): Difficulty {
  if (!raw || !DIFFICULTIES.includes(raw as Difficulty)) bad('Unknown or missing difficulty');
  return raw as Difficulty;
}

function requireBoundedCount(correct: number | undefined, total: number | undefined): {
  correct: number;
  total: number;
} {
  const t = Number(total);
  const c = Number(correct);
  if (!Number.isInteger(t) || t <= 0 || t > MAX_QUESTIONS) bad('totalQuestions out of range');
  if (!Number.isInteger(c) || c < 0 || c > t) bad('correctCount out of range');
  return { correct: c, total: t };
}

export function snapshotFromProfile(profile: Record<string, unknown>): ProgressionSnapshot {
  const rank =
    (profile.playerRank as ProgressionSnapshot | undefined) &&
    typeof profile.playerRank === 'object'
      ? (profile.playerRank as { tier: Difficulty; plaque: number; wisdomPoints: number; unlockedTier: Difficulty })
      : getDefaultPlayerRank();
  return {
    coins: Number(profile.coins) || 0,
    wisdom: Number(rank.wisdomPoints) || 0,
    rankTier: rank.tier,
    rankPlaque: rank.plaque,
    rankUnlockedTier: rank.unlockedTier,
    streakDays: Number(profile.streakDays) || 0,
    lastActiveAt: typeof profile.lastActiveAt === 'string' ? profile.lastActiveAt : null,
    millionaireWins: Number(profile.millionaireWins) || 0,
    millionaireMaxLevel: Number(profile.millionaireMaxLevel) || 0,
    survivalHighScore: Number(profile.survivalHighScore) || 0,
    completedLevels: Array.isArray(profile.completedLevels)
      ? (profile.completedLevels as Array<Record<string, unknown>>)
      : [],
    achievements: Array.isArray(profile.achievements)
      ? (profile.achievements as string[])
      : [],
    themePoints:
      profile.themePoints && typeof profile.themePoints === 'object'
        ? { ...(profile.themePoints as Record<string, number>) }
        : {},
    practiceTracks: Array.isArray(profile.practiceTracks)
      ? (profile.practiceTracks as PracticeTrackProgress[])
      : [],
    studyMastery:
      profile.studyMastery && typeof profile.studyMastery === 'object'
        ? { ...(profile.studyMastery as Record<string, MasteryState>) }
        : {},
  };
}

export async function computeCompletion(
  input: CompletionInput,
  current: ProgressionSnapshot,
  now: Date = new Date(),
  lookupQuestions: QuestionLookup = defaultLookupQuestions,
): Promise<CompletionResult> {
  const next: ProgressionSnapshot = {
    ...current,
    completedLevels: [...current.completedLevels],
    achievements: [...current.achievements],
    themePoints: { ...current.themePoints },
    practiceTracks: current.practiceTracks.map((t) => ({ ...t })),
    studyMastery: { ...current.studyMastery },
  };
  const granted: string[] = [];
  let coinsDelta = 0;
  let wisdomDelta = 0;
  let levelChanged = false;
  let rankChanged = false;
  let stageResult: PracticeStageResult | undefined;
  let nextStageUnlocked: boolean | undefined;
  let stagePerfect: boolean | undefined;
  let passedOut: boolean | undefined;

  const streak = recomputeStreak(current.lastActiveAt, current.streakDays, now);
  next.streakDays = streak.streakDays;
  next.lastActiveAt = streak.lastActiveAt;

  const grant = (id: string): void => {
    if (!next.achievements.includes(id)) {
      next.achievements.push(id);
      granted.push(id);
    }
  };

  switch (input.kind) {
    case 'level': {
      const difficulty = requireDifficulty(input.difficulty);
      const { correct, total } = requireBoundedCount(input.correctCount, input.totalQuestions);
      const themeId = String(input.themeId ?? '').slice(0, 64);
      if (!themeId) bad('themeId required for a level completion');

      const points = Math.round(DIFFICULTY_POINTS[difficulty] * (correct / total));
      coinsDelta = points;
      next.themePoints[themeId] = (next.themePoints[themeId] ?? 0) + points;

      const key = (l: Record<string, unknown>) => `${l.themeId}:${l.difficulty}`;
      const record = {
        themeId,
        difficulty,
        score: correct,
        maxScore: total,
        completedAt: now.toISOString(),
      };
      const idx = next.completedLevels.findIndex((l) => key(l) === `${themeId}:${difficulty}`);
      if (idx >= 0) next.completedLevels[idx] = record;
      else {
        next.completedLevels.push(record);
        levelChanged = true;
      }

      if (correct === total) grant('flawless-level');
      if (
        (themeId === 'geography' || themeId === 'geography-nt') &&
        difficulty === 'teacher' &&
        correct === total
      ) {
        grant('cartographer');
      }
      break;
    }

    case 'practice_stage': {
      const difficulty = requireDifficulty(input.difficulty);
      const { correct, total } = requireBoundedCount(input.correctCount, input.totalQuestions);
      const themeId = String(input.themeId ?? '').slice(0, 64);
      if (!themeId) bad('themeId required for a practice_stage completion');
      const stageIndex = Number(input.stageIndex ?? 0);
      if (!Number.isInteger(stageIndex) || stageIndex < 0 || stageIndex > 50) {
        bad('stageIndex out of range');
      }
      const nodeId =
        typeof input.nodeId === 'string' && input.nodeId ? input.nodeId.slice(0, 128) : null;
      const passed = correct >= PRACTICE_PASS_MIN_CORRECT;

      // Full value this run is worth; the track applies it incrementally over
      // the stage's prior best so replaying an aced stage grants 0.
      const pointsThisRun = passed ? Math.round(DIFFICULTY_POINTS[difficulty] * (correct / total)) : 0;
      const wisdomThisRun = passed ? computeStageWisdom(difficulty, correct, total) : 0;

      const applied = applyPracticeStage(next.practiceTracks, {
        themeId,
        nodeId,
        difficulty,
        stageIndex,
        correct,
        total,
        passed,
        pointsThisRun,
        wisdomThisRun,
        stageCount: input.stageCount,
        questionIds: input.questionIds,
        now,
      });
      next.practiceTracks = applied.tracks;
      coinsDelta = applied.awardedPoints;
      wisdomDelta = applied.awardedWisdom;
      stageResult = applied.stageResult;
      nextStageUnlocked = applied.nextStageUnlocked;
      stagePerfect = applied.stagePerfect;
      passedOut = passed;

      const advanced = advancePlayerRank(
        {
          tier: current.rankTier,
          plaque: current.rankPlaque,
          wisdomPoints: current.wisdom,
          unlockedTier: current.rankUnlockedTier,
        },
        applied.awardedWisdom,
      );
      rankChanged =
        DIFFICULTY_ORDER[advanced.tier] > DIFFICULTY_ORDER[current.rankTier] ||
        advanced.plaque < current.rankPlaque;
      next.rankTier = advanced.tier;
      next.rankPlaque = advanced.plaque;
      next.rankUnlockedTier = advanced.unlockedTier;
      next.wisdom = advanced.wisdomPoints;

      if (applied.awardedPoints > 0) {
        next.themePoints[themeId] = (next.themePoints[themeId] ?? 0) + applied.awardedPoints;
      }
      if (correct === total) grant('flawless-level');
      break;
    }

    case 'millionaire': {
      // The client sends what it played (an answer per level, in order); the
      // server replays it against the real answer key and decides what it's
      // worth — `input.reachedLevel`/`runLength` are display hints only, never
      // trusted for the payout (WS9, §15.2 — a client can no longer just POST
      // a `reachedLevel` number and collect the coins for levels it never
      // cleared).
      const answers = input.answers ?? [];
      if (answers.length === 0 || answers.length > MILLIONAIRE_MAX_LEVEL) {
        bad('answers out of range for millionaire completion');
      }
      const questions = await lookupQuestions(answers.map((a) => a.questionId));
      const byId = new Map(questions.map((q) => [q.id, q]));

      let reached = 0;
      for (const answer of answers) {
        const question = byId.get(answer.questionId);
        if (!question) bad('unknown question in millionaire answers');
        if (answer.selectedIndex !== question.correctIndex) break;
        reached += 1;
      }

      const lostOnAWrongAnswer = reached < answers.length;
      const won = reached >= MILLIONAIRE_MAX_LEVEL;
      coinsDelta = lostOnAWrongAnswer
        ? getMillionaireSafePoints(reached)
        : reached > 0
          ? MILLIONAIRE_LEVEL_POINTS[reached - 1]
          : 0;
      if (won) coinsDelta += MILLIONAIRE_WIN_BONUS;

      next.millionaireMaxLevel = Math.max(current.millionaireMaxLevel, reached);
      if (won) {
        next.millionaireWins = current.millionaireWins + 1;
        grant('biblical-millionaire');
      }
      break;
    }

    case 'survival': {
      // Same principle as millionaire above: replay the submitted answer
      // trail against the real answer key, tracking lives exactly like the
      // client's own game loop does, instead of trusting a bare
      // client-submitted `score` (WS9, §15.3 — explicitly called out in the
      // Phase 3 spec as a bug to fix, not just a reskin).
      const answers = input.answers ?? [];
      if (answers.length === 0) bad('answers required for survival completion');
      const questions = await lookupQuestions(answers.map((a) => a.questionId));
      const byId = new Map(questions.map((q) => [q.id, q]));

      let lives = SURVIVAL_STARTING_LIVES;
      let score = 0;
      let points = 0;
      for (const answer of answers) {
        if (lives <= 0) break; // anything submitted after game-over is ignored, not trusted
        const question = byId.get(answer.questionId);
        if (!question) bad('unknown question in survival answers');
        if (answer.selectedIndex === question.correctIndex) {
          score += 1;
          points += SURVIVAL_POINTS_BY_DIFFICULTY[question.difficulty];
        } else {
          lives -= 1;
        }
      }

      const bounded = Math.min(score, SURVIVAL_MAX_SCORE);
      coinsDelta = points;
      next.survivalHighScore = Math.max(current.survivalHighScore, bounded);
      if (bounded >= SURVIVAL_IRON_SHIELD_MIN) grant('iron-shield');
      break;
    }

    default:
      bad(`Unknown completion kind: ${String((input as { kind: unknown }).kind)}`);
  }

  next.coins = current.coins + coinsDelta;

  return {
    next,
    delta: {
      coins: coinsDelta,
      wisdom: wisdomDelta,
      levelChanged,
      rankChanged,
      achievementsGranted: granted,
      stageResult,
      nextStageUnlocked,
      stagePerfect,
      passed: passedOut,
    },
  };
}
