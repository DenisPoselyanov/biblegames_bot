/**
 * Progression + learning storage (Phase 2 §5.3, §9).
 *
 * `player_profiles` / `player_stats` were adopted 1:1 from the hand-written
 * `server/db/schema.sql` (whole-blob `payload`). The progression-decomposition
 * change (§18.2, ADR-016) carves the progression + entitlement fields out of
 * those blobs into the typed tables below — hybrid granularity: typed scalar
 * columns for the hot fields, single-domain `jsonb` sub-bags (each carrying a
 * `schema_version`) for the collections the reward engine reads/writes whole.
 */
import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { createdAt, tstz, updatedAt } from './_shared';
import { users } from './identity';

/** Whole legacy `UserProfileView` blob, keyed by user. */
export const playerProfiles = pgTable('player_profiles', {
  userId: text('user_id').primaryKey(),
  payload: jsonb('payload').notNull().$type<Record<string, unknown>>(),
  updatedAt: updatedAt(),
});

/** Whole legacy progression/stats blob, keyed by user. */
export const playerStats = pgTable('player_stats', {
  userId: text('user_id').primaryKey(),
  payload: jsonb('payload').notNull().$type<Record<string, unknown>>(),
  updatedAt: updatedAt(),
});

/**
 * Per-answer study history (spaced-repetition inputs).
 *
 * Historically written append-then-replace (delete-all + reinsert the last N).
 * The transactional `/answers` path (ADR-016) appends one row per answer, keyed
 * by `(user_id, idempotency_key)` so a client retry is a no-op.
 */
export const studyAnswers = pgTable(
  'study_answers',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: text('user_id').notNull(),
    questionId: text('question_id').notNull(),
    subthemeId: text('subtheme_id').notNull(),
    isCorrect: boolean('is_correct').notNull(),
    answeredAt: tstz('answered_at').notNull(),
    /** Null for legacy rows written before the transactional path. */
    idempotencyKey: text('idempotency_key'),
    payload: jsonb('payload').notNull().$type<Record<string, unknown>>().default({}),
  },
  (t) => [
    index('idx_study_answers_user_time').on(t.userId, t.answeredAt.desc()),
    uniqueIndex('uq_study_answers_idem')
      .on(t.userId, t.idempotencyKey)
      .where(sql`${t.idempotencyKey} is not null`),
  ],
);

/** Bounded client telemetry events. */
export const telemetryEvents = pgTable(
  'telemetry_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: text('user_id').notNull(),
    eventName: text('event_name').notNull(),
    createdAt: tstz('created_at').notNull(),
    payload: jsonb('payload').notNull().$type<Record<string, unknown>>().default({}),
  },
  (t) => [index('idx_telemetry_user_time').on(t.userId, t.createdAt.desc())],
);

// --- Decomposed progression state (§18.2, ADR-016) --------------------------

/**
 * The typed home for the progression fields that used to live in the
 * `player_profiles` blob. One row per user; the row lock (`SELECT … FOR UPDATE`)
 * serialises the reward hot path.
 *
 * Scalars are columns (indexable — leaderboards, streak segmentation, the read
 * overlay). The four collections stay as `jsonb` bags: the reward engine
 * (`server/progression/completionOutcome.ts`) reads and writes each as a whole
 * value and never needs a row-addressable view of one entry. Each bag carries a
 * `schema_version` implicitly through the row's `schema_version`; a later phase
 * can normalise an individual bag on its own migration.
 */
export const progressionState = pgTable('progression_state', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  schemaVersion: integer('schema_version').notNull().default(1),
  rankTier: text('rank_tier').notNull().default('baby'),
  rankPlaque: integer('rank_plaque').notNull().default(7),
  wisdomPoints: integer('wisdom_points').notNull().default(0),
  rankUnlockedTier: text('rank_unlocked_tier').notNull().default('child'),
  streakDays: integer('streak_days').notNull().default(0),
  lastActiveAt: tstz('last_active_at'),
  millionaireWins: integer('millionaire_wins').notNull().default(0),
  millionaireMaxLevel: integer('millionaire_max_level').notNull().default(0),
  survivalHighScore: integer('survival_high_score').notNull().default(0),
  completedLevels: jsonb('completed_levels')
    .notNull()
    .$type<Array<Record<string, unknown>>>()
    .default([]),
  themePoints: jsonb('theme_points').notNull().$type<Record<string, number>>().default({}),
  practiceTracks: jsonb('practice_tracks')
    .notNull()
    .$type<Array<Record<string, unknown>>>()
    .default([]),
  studyMastery: jsonb('study_mastery')
    .notNull()
    .$type<Record<string, Record<string, unknown>>>()
    .default({}),
  /** Bumped on every write — a debugging aid, not the concurrency guard (the row lock is). */
  revision: integer('revision').notNull().default(0),
  updatedAt: updatedAt(),
});

/**
 * One row per achievement a user has unlocked, with provenance. Replaces the
 * `achievements: string[]` array in the blob. Idempotent on `(user_id,
 * achievement_id)` — the reward path grants blindly and relies on the conflict.
 */
export const achievementGrants = pgTable(
  'achievement_grants',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    achievementId: text('achievement_id').notNull(),
    /** `progression.completion` | `progression.answer` | `shop.purchase` | `migration`. */
    sourceType: text('source_type').notNull(),
    sourceId: text('source_id'),
    grantedAt: createdAt(),
    metadata: jsonb('metadata').notNull().$type<Record<string, unknown>>().default({}),
  },
  (t) => [primaryKey({ columns: [t.userId, t.achievementId] })],
);

/**
 * Per-user, per-theme play accounting. Replaces the whole-object `player_stats`
 * blob (`GlobalStats.themes`). `players_count` from the old blob is dropped —
 * derivable as `count(distinct user_id)`.
 */
export const playerThemeStats = pgTable(
  'player_theme_stats',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    themeId: text('theme_id').notNull(),
    totalPoints: bigint('total_points', { mode: 'number' }).notNull().default(0),
    gamesPlayed: integer('games_played').notNull().default(0),
    firstPlayedAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.themeId] })],
);
