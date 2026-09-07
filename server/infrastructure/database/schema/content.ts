/**
 * Content storage (Phase 2 §5.5, §9 "content baseline"). Adopted 1:1 from
 * `server/db/schema.sql`. WS3 introduces the canonical question/lesson revision
 * model on top of these; for now they are the live question bank.
 */
import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text } from 'drizzle-orm/pg-core';
import { createdAt, updatedAt } from './_shared';

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
