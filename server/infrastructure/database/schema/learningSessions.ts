/**
 * Learning session storage (Phase 3 WS2, spec §11.4/§12.1).
 *
 * Two tables, deliberately kept separate from `learning.ts` (content) — these
 * track a *user's* progress through content, not the content itself. Ids are
 * caller-supplied (minted by `learningService`), same convention WS1 used for
 * content-mapping upserts.
 *
 * No review-scheduler table: due-ness is computed at read time from
 * `studyMastery` (see `server/domains/learning/reviewScheduler.ts`) — nothing
 * here backs it.
 */
import { index, integer, jsonb, pgTable, text } from 'drizzle-orm/pg-core';
import { createdAt, tstz } from './_shared';
import { learningObjectives, lessons } from './learning';

/**
 * One lesson attempt. `status` is `LessonSessionStatus`
 * (`in_progress|completed|abandoned`). `planId`/`moduleId` are denormalized
 * from `lessons` — same pattern `lessons` itself uses for `planId` — so the
 * Today/resume lookups don't need an extra join.
 */
export const lessonSessions = pgTable(
  'lesson_sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    lessonId: text('lesson_id')
      .notNull()
      .references(() => lessons.id, { onDelete: 'cascade' }),
    planId: text('plan_id').notNull(),
    moduleId: text('module_id').notNull(),
    /** `LessonSessionStatus`. */
    status: text('status').notNull().default('in_progress'),
    /** The lesson's `updatedAt` at session-start (§11.4 "content revision"). */
    contentRevision: text('content_revision').notNull(),
    checkpointBlockId: text('checkpoint_block_id'),
    startedAt: tstz('started_at').notNull().defaultNow(),
    lastActivityAt: tstz('last_activity_at').notNull().defaultNow(),
    completedAt: tstz('completed_at'),
  },
  (t) => [
    index('idx_lesson_sessions_user_status_activity').on(t.userId, t.status, t.lastActivityAt),
    index('idx_lesson_sessions_user_lesson').on(t.userId, t.lessonId),
  ],
);

/**
 * One practice/review session (§12.1). `questionRevisionIds` pins the ordered
 * revision set shown so a reload doesn't re-roll it and so "no answer key for
 * future questions" is enforceable server-side.
 */
export const practiceSessions = pgTable(
  'practice_sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    /** `PracticeSessionMode` (`practice|review|mistakes`). */
    mode: text('mode').notNull(),
    objectiveId: text('objective_id')
      .notNull()
      .references(() => learningObjectives.id, { onDelete: 'cascade' }),
    questionRevisionIds: jsonb('question_revision_ids').notNull().$type<string[]>().default([]),
    currentIndex: integer('current_index').notNull().default(0),
    /** `PracticeSessionStatus` (`active|completed|expired`). */
    status: text('status').notNull().default('active'),
    createdAt: createdAt(),
    expiresAt: tstz('expires_at').notNull(),
  },
  (t) => [index('idx_practice_sessions_user_status').on(t.userId, t.status)],
);
