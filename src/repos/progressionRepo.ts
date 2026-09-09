/**
 * Client for the server-authoritative command surface (`/api/v1/*`), built on
 * the typed API client (`src/lib/apiClient`). Every method throws on a non-2xx
 * response so the caller (PlayerContext) can fall back to the local computation
 * and mark the run pending-sync.
 */

import type { ZodType } from 'zod';
import { progressionContract, shopContract } from '@contracts';
import type { Difficulty, MasteryState, PlayerProfile, PracticeStageResult } from '../types';
import { ApiError, apiRequest, type ApiRequestOptions } from '../lib/apiClient';

/** A failed progression command. Carries the server's §7.5 envelope fields. */
export class ProgressionError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;
  readonly requestId?: string;
  readonly fieldErrors?: Record<string, string[]>;
  constructor(source: ApiError) {
    super(source.message);
    this.name = 'ProgressionError';
    this.code = source.code;
    this.status = source.status;
    this.retryable = source.retryable;
    this.requestId = source.requestId;
    this.fieldErrors = source.fieldErrors;
  }
}

/** Run a command through the typed client, remapping `ApiError` → `ProgressionError`. */
async function call<T>(path: string, opts: ApiRequestOptions<T>): Promise<T> {
  try {
    return await apiRequest<T>(path, opts);
  } catch (err) {
    if (err instanceof ApiError) throw new ProgressionError(err);
    throw err; // network / abort errors propagate untouched
  }
}

function post<T>(
  path: string,
  body: unknown,
  extra?: Omit<ApiRequestOptions<T>, 'method' | 'body'>,
): Promise<T> {
  return call<T>(path, { method: 'POST', body, ...extra });
}

function patch<T>(path: string, body: unknown): Promise<T> {
  return call<T>(path, { method: 'PATCH', body });
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
  practiceTracks: PlayerProfile['practiceTracks'];
  studyMastery: Record<string, MasteryState>;
}

export interface ProgressionOutcome {
  eventId: string;
  previous: ProgressionSnapshot;
  next: ProgressionSnapshot;
  delta: {
    coins: number;
    wisdom: number;
    levelChanged: boolean;
    rankChanged: boolean;
    achievementsGranted: string[];
    stageResult?: PracticeStageResult;
    nextStageUnlocked?: boolean;
    stagePerfect?: boolean;
    passed?: boolean;
  };
  occurredAt: string;
}

export type CompletionKind = 'level' | 'practice_stage' | 'millionaire' | 'survival';

export interface CompletionCommand {
  kind: CompletionKind;
  runId: string;
  idempotencyKey: string;
  difficulty?: Difficulty;
  themeId?: string;
  nodeId?: string | null;
  stageIndex?: number;
  stageCount?: number;
  questionIds?: string[];
  correctCount?: number;
  totalQuestions?: number;
  reachedLevel?: number;
  runLength?: number;
  score?: number;
}

export interface AnswerOutcome {
  nodeId: string;
  mastery: MasteryState;
  achievementsGranted: string[];
  answeredAt: string;
}

export interface PurchaseOutcome {
  ok: true;
  balance: number;
  unlockedThemes: string[];
  unlockedAvatars: string[];
  activeTheme: string;
  avatar: string;
  achievementsGranted: string[];
}

export const progressionRepo = {
  completion(cmd: CompletionCommand): Promise<ProgressionOutcome> {
    // The local `ProgressionOutcome` still diverges from the contract snapshot
    // shape (delta extras); the typed read model in WS4 part 4 validates this.
    return post<ProgressionOutcome>('/progression/completions', cmd, {
      idempotencyKey: cmd.idempotencyKey,
    });
  },

  answer(input: {
    questionId: string;
    themeId?: string;
    nodeId?: string | null;
    subthemeId?: string;
    isCorrect: boolean;
    errorTag?: string;
    idempotencyKey: string;
  }): Promise<AnswerOutcome> {
    return post<AnswerOutcome>('/progression/answers', input, {
      idempotencyKey: input.idempotencyKey,
      schema: progressionContract.answerResponse as unknown as ZodType<AnswerOutcome>,
      onInvalidResponse: 'warn',
    });
  },

  purchase(input: {
    kind: 'theme' | 'avatar';
    itemId: string;
    idempotencyKey: string;
  }): Promise<PurchaseOutcome> {
    return post<PurchaseOutcome>('/shop/purchases', input, {
      idempotencyKey: input.idempotencyKey,
      schema: shopContract.purchaseResponse as unknown as ZodType<PurchaseOutcome>,
      onInvalidResponse: 'warn',
    });
  },

  savePreferences(prefs: {
    displayName?: string;
    bibleTranslation?: string;
    activeTheme?: string;
    avatar?: string;
  }): Promise<PlayerProfile> {
    return patch<PlayerProfile>('/me/preferences', prefs);
  },

  saveLearningState(
    reviewSchedules: PlayerProfile['reviewSchedules'],
  ): Promise<{ ok: true; reviewSchedules: PlayerProfile['reviewSchedules'] }> {
    return patch('/me/learning-state', { reviewSchedules });
  },

  async migrate(profile: PlayerProfile): Promise<void> {
    await post('/me/migrate', { sourceVersion: 1, profile });
  },

  async getProfile(): Promise<PlayerProfile | null> {
    try {
      return await apiRequest<PlayerProfile>('/me/profile');
    } catch (err) {
      // A missing/forbidden profile is a null result; transport failures still
      // propagate so `playerRepo.get` can fall back to the local copy.
      if (err instanceof ApiError) return null;
      throw err;
    }
  },
};
