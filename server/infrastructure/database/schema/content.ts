/**
 * Content storage (Phase 2 §5.5, §9 "content baseline", §14).
 *
 * The `questions` / `question_exclusions` / `question_overrides` trio is the
 * legacy live bank adopted 1:1 from `server/db/schema.sql`. WS3 adds the
 * canonical revision model — `question_revisions` (+ `scripture_references`) and
 * frozen `content_sets` / `content_set_versions` / `content_set_items`. The
 * legacy trio stays authoritative until the `canonicalContentRepository` cutover
 * (WS3 part 3); import runs into `question_revisions` as `legacy_unreviewed`.
 */
import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { createdAt, tstz, updatedAt } from './_shared';

/** Live question bank row — `payload` is the full question JSON. */
export const questions = pgTable(
  'questions',
  {
    id: text('id').primaryKey(),
    themeId: text('theme_id').notNull(),
    difficulty: text('difficulty').notNull(),
    topicNodeId: text('topic_node_id'),
    source: text('source').notNull().default('embedded'),
    payload: jsonb('payload').notNull().$type<Record<string, unknown>>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('idx_questions_theme_difficulty').on(t.themeId, t.difficulty),
    index('idx_questions_topic_node')
      .on(t.topicNodeId)
      .where(sql`${t.topicNodeId} is not null`),
  ],
);

/** Question ids withheld from selection. */
export const questionExclusions = pgTable('question_exclusions', {
  questionId: text('question_id').primaryKey(),
});

/** Per-question JSON patch applied over the canonical payload. */
export const questionOverrides = pgTable('question_overrides', {
  questionId: text('question_id').primaryKey(),
  patch: jsonb('patch').notNull().$type<Record<string, unknown>>().default({}),
  updatedAt: updatedAt(),
});

// --- Canonical revision model (WS3 §14) --------------------------------------

/**
 * An immutable question revision. One `question_id` accumulates numbered
 * revisions; at most one is `published` at a time (partial unique index). Import
 * lands revisions as `legacy_unreviewed` (§18.3), never `published`.
 */
export const questionRevisions = pgTable(
  'question_revisions',
  {
    id: text('id').primaryKey(),
    questionId: text('question_id').notNull(),
    revisionNumber: integer('revision_number').notNull(),
    /** `ContentStatus` — 'legacy_unreviewed' | 'draft' | 'ready_for_review' | 'published' | 'quarantined' | 'archived'. */
    status: text('status').notNull().default('legacy_unreviewed'),
    themeId: text('theme_id').notNull(),
    difficulty: text('difficulty').notNull(),
    topicNodeId: text('topic_node_id'),
    topicPath: text('topic_path'),
    text: text('text').notNull(),
    /** `string[]` — the answer options, in order. */
    options: jsonb('options').notNull().$type<string[]>(),
    correctIndex: integer('correct_index').notNull(),
    explanationShort: text('explanation_short'),
    explanationDeep: text('explanation_deep'),
    reference: text('reference'),
    tags: jsonb('tags').notNull().$type<string[]>().default([]),
    /** sha-256 of the normalized revision body — dedup + version identity. */
    contentHash: text('content_hash').notNull(),
    source: text('source').notNull().default('legacy'),
    createdAt: createdAt(),
    createdBy: text('created_by'),
    supersededAt: tstz('superseded_at'),
    /** Set when `status` = 'quarantined'. */
    quarantineReason: text('quarantine_reason'),
  },
  (t) => [
    uniqueIndex('uq_question_revisions_question_number').on(t.questionId, t.revisionNumber),
    index('idx_question_revisions_theme_difficulty').on(t.themeId, t.difficulty),
    index('idx_question_revisions_status').on(t.status),
    index('idx_question_revisions_topic_node')
      .on(t.topicNodeId)
      .where(sql`${t.topicNodeId} is not null`),
    uniqueIndex('uq_question_revisions_published')
      .on(t.questionId)
      .where(sql`${t.status} = 'published'`),
  ],
);

/** Normalized Scripture citations for a revision (§5.5). */
export const scriptureReferences = pgTable(
  'scripture_references',
  {
    revisionId: text('revision_id')
      .notNull()
      .references(() => questionRevisions.id, { onDelete: 'cascade' }),
    ordinal: integer('ordinal').notNull(),
    book: text('book').notNull(),
    chapter: integer('chapter').notNull(),
    verseStart: integer('verse_start').notNull(),
    verseEnd: integer('verse_end'),
    translation: text('translation'),
  },
  (t) => [
    primaryKey({ columns: [t.revisionId, t.ordinal] }),
    index('idx_scripture_references_book').on(t.book, t.chapter),
  ],
);

/**
 * A named published set (Quiz theme pack, Kahoot playlist, practice pool, …).
 * The row is the identity; each publish creates a `content_set_versions` row.
 */
export const contentSets = pgTable(
  'content_sets',
  {
    id: text('id').primaryKey(),
    /** 'quiz' | 'kahoot' | 'practice' | 'lesson' | 'snapshot'. */
    kind: text('kind').notNull(),
    /** JSON `ContentSetFilter` used to (re)compute membership. */
    filter: jsonb('filter').notNull().$type<Record<string, unknown>>().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('idx_content_sets_kind').on(t.kind)],
);

/** One frozen publish of a set — stable `version` + `content_hash`. */
export const contentSetVersions = pgTable(
  'content_set_versions',
  {
    setId: text('set_id')
      .notNull()
      .references(() => contentSets.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    contentHash: text('content_hash').notNull(),
    questionCount: integer('question_count').notNull().default(0),
    publishedAt: createdAt(),
    publishedBy: text('published_by'),
  },
  (t) => [primaryKey({ columns: [t.setId, t.version] })],
);

/** Ordered membership of a set version — points at a specific published revision. */
export const contentSetItems = pgTable(
  'content_set_items',
  {
    setId: text('set_id').notNull(),
    version: integer('version').notNull(),
    position: integer('position').notNull(),
    questionId: text('question_id').notNull(),
    revisionId: text('revision_id').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.setId, t.version, t.position] }),
    index('idx_content_set_items_lookup').on(t.setId, t.version),
  ],
);
