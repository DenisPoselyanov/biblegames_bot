/**
 * Progression domain repository contracts (Phase 2 §10, ADR-016).
 *
 * Interfaces only — implementations live in
 * `server/infrastructure/database/repositories/progression.ts` (SQL, production)
 * and `./inMemoryRepository.ts` (dev/test parity peer). Both pass
 * `__tests__/repositoryContract.ts`.
 *
 * `tx` is the opaque `Transaction` from `ServiceContext` (§11). The reward hot
 * path opens one transaction, takes the `progression_state` row lock
 * (`get(..., { forUpdate: true })`), and threads that `tx` through every write.
 */
import type { Transaction } from '../shared/context';
import type {
  AchievementGrantRecord,
  AnswerHistoryEntry,
  GrantAchievementInput,
  ProgressionStatePatch,
  ProgressionStateRecord,
  RecordThemePlayInput,
  ThemeStatRecord,
} from './types';

export interface ProgressionStateRepository {
  /**
   * The user's row, or `null` if they have none yet. `forUpdate` issues
   * `SELECT … FOR UPDATE` — meaningful only inside a `tx` and after `ensureRow`.
   */
  get(
    userId: string,
    tx?: Transaction,
    opts?: { forUpdate?: boolean },
  ): Promise<ProgressionStateRecord | null>;
  /** `INSERT … ON CONFLICT DO NOTHING` — so `FOR UPDATE` has a row to lock. */
  ensureRow(userId: string, tx?: Transaction): Promise<void>;
  /** Replace the mutable fields. Creates the row (schema version 1) if absent. */
  upsert(
    userId: string,
    patch: ProgressionStatePatch,
    tx?: Transaction,
  ): Promise<ProgressionStateRecord>;
}

export interface AchievementRepository {
  /** Every achievement the user has unlocked, newest first. */
  list(userId: string, tx?: Transaction): Promise<AchievementGrantRecord[]>;
  /** Idempotent on `(userId, achievementId)` — a replay returns the existing row. */
  grant(input: GrantAchievementInput, tx?: Transaction): Promise<AchievementGrantRecord>;
}

export interface ThemeStatsRepository {
  listForUser(userId: string, tx?: Transaction): Promise<ThemeStatRecord[]>;
  /**
   * `INSERT … ON CONFLICT DO UPDATE SET total_points = total_points + $,
   * games_played = games_played + 1` — one atomic statement.
   */
  recordPlay(input: RecordThemePlayInput, tx?: Transaction): Promise<void>;
}

export interface AnswerHistoryRepository {
  /** The user's most-recent answers (payloads), oldest first, capped at `limit`. */
  list(userId: string, limit: number, tx?: Transaction): Promise<Array<Record<string, unknown>>>;
  /** Append one row; a duplicate `(userId, idempotencyKey)` is a no-op. */
  append(entry: AnswerHistoryEntry, tx?: Transaction): Promise<void>;
}

export interface ProgressionRepositories {
  state: ProgressionStateRepository;
  achievements: AchievementRepository;
  themeStats: ThemeStatsRepository;
  answers: AnswerHistoryRepository;
}
