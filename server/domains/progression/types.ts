/**
 * Progression domain value types (Phase 2 §5.3, ADR-016). Domain-owned: no `pg`,
 * no Drizzle `InferSelectModel`, no HTTP types.
 *
 * The four collection fields are opaque bags here — the reward engine
 * (`server/progression/`) owns their runtime shape and `./mapSnapshot.ts` is the
 * only place that couples the two.
 */

/** The scalar + bag state persisted per user in `progression_state`. */
export interface ProgressionStateRecord {
  userId: string;
  schemaVersion: number;
  rankTier: string;
  rankPlaque: number;
  wisdomPoints: number;
  rankUnlockedTier: string;
  streakDays: number;
  lastActiveAt: string | null;
  millionaireWins: number;
  millionaireMaxLevel: number;
  survivalHighScore: number;
  completedLevels: Array<Record<string, unknown>>;
  themePoints: Record<string, number>;
  practiceTracks: Array<Record<string, unknown>>;
  studyMastery: Record<string, Record<string, unknown>>;
  revision: number;
  updatedAt: string;
}

/**
 * A full replacement of the mutable progression fields. The reward engine always
 * produces a whole `next` snapshot, so there is no partial-patch use — but a
 * write only ever touches the columns listed here (never `userId` /
 * `schemaVersion` / `revision` / `updatedAt`, which the repository owns).
 */
export type ProgressionStatePatch = Omit<
  ProgressionStateRecord,
  'userId' | 'schemaVersion' | 'revision' | 'updatedAt'
>;

export type AchievementSourceType =
  | 'progression.completion'
  | 'progression.answer'
  | 'shop.purchase'
  | 'migration';

export interface AchievementGrantRecord {
  userId: string;
  achievementId: string;
  sourceType: AchievementSourceType;
  sourceId: string | null;
  grantedAt: string;
  metadata: Record<string, unknown>;
}

export interface GrantAchievementInput {
  userId: string;
  achievementId: string;
  sourceType: AchievementSourceType;
  sourceId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ThemeStatRecord {
  userId: string;
  themeId: string;
  totalPoints: number;
  gamesPlayed: number;
  firstPlayedAt: string;
  updatedAt: string;
}

export interface RecordThemePlayInput {
  userId: string;
  themeId: string;
  /** Points earned this play — added to `total_points`. */
  points: number;
}
