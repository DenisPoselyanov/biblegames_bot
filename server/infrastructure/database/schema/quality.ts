/**
 * Content-quality feedback signals (Phase 4 WS9, spec §14, §18).
 *
 * - `content_reports` — a player's report that a question/lesson is wrong. One
 *   row per report; grouped per entity for the reviewer queue. Reports never
 *   mutate content (§22) — a reviewer resolves them, optionally linking the
 *   revision that fixed the problem.
 * - `question_option_picks` — anonymous per-revision, per-option pick counters
 *   from practice answers (no user id: the "first-option bias in the wild"
 *   signal without new personal data). Correctness itself is already in
 *   `study_answers` and is aggregated on read, not duplicated here.
 */
import { index, integer, pgTable, primaryKey, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tstz } from './_shared';

export const contentReports = pgTable(
  'content_reports',
  {
    id: text('id').primaryKey(),
    /** 'question' | 'lesson'. */
    entityType: text('entity_type').notNull(),
    /** Stable question/lesson id — reports group per entity, across revisions. */
    entityId: text('entity_id').notNull(),
    /** The revision the player actually saw, when known. */
    revisionId: text('revision_id'),
    reporterUserId: text('reporter_user_id').notNull(),
    /** 'wrong_answer' | 'wording' | 'translation' | 'reference' | 'offensive' | 'technical'. */
    category: text('category').notNull(),
    comment: text('comment'),
    /** Practice/lesson session the report came from, when any. */
    sessionId: text('session_id'),
    /** 'open' | 'resolved' | 'dismissed'. */
    status: text('status').notNull().default('open'),
    resolutionNote: text('resolution_note'),
    /** Revision that fixed the reported problem — the audit link §14 asks for. */
    resolvedRevisionId: text('resolved_revision_id'),
    resolvedBy: text('resolved_by'),
    resolvedAt: tstz('resolved_at'),
    createdAt: tstz('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('idx_content_reports_entity').on(t.entityType, t.entityId),
    index('idx_content_reports_status').on(t.status, t.createdAt),
    index('idx_content_reports_reporter').on(t.reporterUserId, t.createdAt),
    // One open report per (player, entity, category) — a repeat tap is a duplicate, not a second vote.
    uniqueIndex('uq_content_reports_open_per_reporter')
      .on(t.reporterUserId, t.entityType, t.entityId, t.category)
      .where(sql`${t.status} = 'open'`),
  ],
);

export const questionOptionPicks = pgTable(
  'question_option_picks',
  {
    revisionId: text('revision_id').notNull(),
    questionId: text('question_id').notNull(),
    optionIndex: integer('option_index').notNull(),
    optionCount: integer('option_count').notNull(),
    picks: integer('picks').notNull().default(0),
    updatedAt: tstz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.revisionId, t.optionIndex] }),
    index('idx_question_option_picks_question').on(t.questionId),
  ],
);
