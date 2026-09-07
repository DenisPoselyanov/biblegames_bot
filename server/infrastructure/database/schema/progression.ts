/**
 * Progression + learning storage (Phase 2 §5.3, §9). Adopted 1:1 from the
 * hand-written `server/db/schema.sql` so migration `0000` can take over the
 * existing tables without a data move. Decomposition of the `payload` blobs into
 * typed columns happens in a later WS2 migration (§18.2).
 */
import { bigserial, boolean, index, jsonb, pgTable, text } from 'drizzle-orm/pg-core';
import { tstz, updatedAt } from './_shared';

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

/** Per-answer study history (spaced-repetition inputs). Append-then-replace by user. */
export const studyAnswers = pgTable(
  'study_answers',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: text('user_id').notNull(),
    questionId: text('question_id').notNull(),
    subthemeId: text('subtheme_id').notNull(),
    isCorrect: boolean('is_correct').notNull(),
    answeredAt: tstz('answered_at').notNull(),
    payload: jsonb('payload').notNull().$type<Record<string, unknown>>().default({}),
  },
  (t) => [index('idx_study_answers_user_time').on(t.userId, t.answeredAt.desc())],
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
