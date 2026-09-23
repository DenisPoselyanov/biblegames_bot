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
import { index, integer, jsonb, pgTable, primaryKey, real, text, uniqueIndex } from 'drizzle-orm/pg-core';
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

/**
 * Question assessments (content quality gate, layers 2–3) — the owner's golden
 * labels and the AI reviewer's verdicts, in one shape so they can be compared
 * criterion by criterion. Bound to a body by `content_hash`, not a revision id:
 * the legacy bank is still files. See `server/domains/quality/assessment.ts`.
 */
export const questionAssessments = pgTable(
  'question_assessments',
  {
    id: text('id').primaryKey(),
    questionId: text('question_id').notNull(),
    contentHash: text('content_hash').notNull(),
    /** 'golden' | 'ai'. */
    source: text('source').notNull(),
    assessor: text('assessor').notNull(),
    rubricVersion: text('rubric_version').notNull(),
    /** 'pass' | 'reclassify' | 'repair' | 'reject'. */
    verdict: text('verdict').notNull(),
    criteria: jsonb('criteria').notNull().$type<Record<string, string>>(),
    suggestedDifficulty: text('suggested_difficulty'),
    suggestedTopicNodeId: text('suggested_topic_node_id'),
    suggestedExplanationShort: text('suggested_explanation_short'),
    suggestedExplanationDeep: text('suggested_explanation_deep'),
    notes: text('notes'),
    confidence: real('confidence'),
    risk: integer('risk').notNull().default(0),
    /** The question body as assessed (`AssessmentSubject`). */
    subject: jsonb('subject').notNull().$type<Record<string, unknown>>(),
    meta: jsonb('meta').notNull().$type<Record<string, unknown>>().default({}),
    /** 'accepted' | 'overridden' | 'dismissed' — AI rows only. */
    decision: text('decision'),
    decisionNote: text('decision_note'),
    decisionPatch: jsonb('decision_patch').$type<Record<string, unknown>>(),
    decidedBy: text('decided_by'),
    decidedAt: tstz('decided_at'),
    appliedAt: tstz('applied_at'),
    createdAt: tstz('created_at').notNull().defaultNow(),
    updatedAt: tstz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('idx_question_assessments_question').on(t.source, t.questionId, t.createdAt),
    index('idx_question_assessments_queue').on(t.source, t.risk),
    // One golden label per question — relabelling replaces it.
    uniqueIndex('uq_question_assessments_golden')
      .on(t.questionId)
      .where(sql`${t.source} = 'golden'`),
  ],
);
