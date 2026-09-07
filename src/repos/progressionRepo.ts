/**
 * Client for the Phase 1 server-authoritative command surface (`/api/v1/*`).
 *
 * Only used when the `authoritative_profile` flag is on. Every method throws on
 * a non-2xx response so the caller (PlayerContext) can fall back to the local
 * computation and mark the run pending-sync.
 */

import type { Difficulty, MasteryState, PlayerProfile, PracticeStageResult } from '../types';
import { apiV1Fetch, readApiError, type ApiError } from './apiClient';

export class ProgressionError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(status: number, error: ApiError) {
    super(error.message);
    this.name = 'ProgressionError';
    this.code = error.code;
    this.status = status;
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await apiV1Fetch(path, { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) throw new ProgressionError(res.status, await readApiError(res));
  return (await res.json()) as T;
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await apiV1Fetch(path, { method: 'PATCH', body: JSON.stringify(body) });
  if (!res.ok) throw new ProgressionError(res.status, await readApiError(res));
  return (await res.json()) as T;
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
    return post<ProgressionOutcome>('/progression/completions', cmd);
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
    return post<AnswerOutcome>('/progression/answers', input);
  },

  purchase(input: {
    kind: 'theme' | 'avatar';
    itemId: string;
    idempotencyKey: string;
  }): Promise<PurchaseOutcome> {
    return post<PurchaseOutcome>('/shop/purchases', input);
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
    const res = await apiV1Fetch('/me/profile');
    if (!res.ok) return null;
    return (await res.json()) as PlayerProfile;
  },
};
