/**
 * Learning domain storage (Phase 3 WS1, ADR-017).
 *
 * `learning_plans` / `learning_modules` / `learning_objectives` / `lessons` /
 * `lesson_blocks` are the typed home for the Phase 3 Learn hub. They are
 * populated two ways: `source = 'topic-tree'` rows come from
 * `scripts/migrate/map-learning-content.ts`, deriving a plan per content theme
 * and a module/lesson/objective per topic-tree node from `data/topics-db/*.json`
 * (see ADR-017 for the depth-agnostic mapping rule). `source = 'authored'` rows
 * are Phase 4 Content Studio's home — this schema does not change shape for that,
 * only the `source` value and, eventually, who writes it.
 *
 * All five tables carry `status` (`ContentStatus`, text — same closed vocabulary
 * as `question_revisions.status`, ADR-004): mapped content lands
 * `legacy_unreviewed`, never `published`, by the same rule content import uses.
 * WS2's read API only serves `published` rows.
 */
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { createdAt, updatedAt } from './_shared';

/**
 * A learning plan — one per content theme for topic-tree-derived plans
 * (`id` = `themeId`, e.g. `pentateuch`), reusing the vocabulary already on
 * `question_revisions.theme_id` rather than inventing a parallel id space.
 */
export const learningPlans = pgTable(
  'learning_plans',
  {
    id: text('id').primaryKey(),
    themeId: text('theme_id').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    /** `ContentStatus`. */
    status: text('status').notNull().default('legacy_unreviewed'),
    position: integer('position').notNull().default(0),
    /** `'topic-tree' | 'authored'`. */
    source: text('source').notNull().default('topic-tree'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('idx_learning_plans_theme').on(t.themeId),
    index('idx_learning_plans_status').on(t.status),
  ],
);

/**
 * A module groups objectives/lessons under a plan. Self-referencing
 * `parentModuleId` models the topic tree's variable depth (a plan's direct
 * children are modules with `parentModuleId = null`; a module nested another
 * level deeper — e.g. Pentateuch's book → period grouping — points at its
 * parent module). `id` = the topic-tree node id.
 */
export const learningModules = pgTable(
  'learning_modules',
  {
    id: text('id').primaryKey(),
    planId: text('plan_id')
      .notNull()
      .references(() => learningPlans.id, { onDelete: 'cascade' }),
    parentModuleId: text('parent_module_id').references(
      (): AnyPgColumn => learningModules.id,
      { onDelete: 'cascade' },
    ),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').notNull().default('legacy_unreviewed'),
    position: integer('position').notNull().default(0),
    source: text('source').notNull().default('topic-tree'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('idx_learning_modules_plan').on(t.planId, t.position),
    index('idx_learning_modules_parent').on(t.parentModuleId),
  ],
);

/**
 * A learning objective — one per topic-tree leaf node. Reuses the same id as
 * `question_revisions.topic_node_id` / `topic_path`, so every published question
 * already tagged with a `topicNodeId` is, by construction, evidence toward one
 * objective; no separate question↔objective mapping table is needed.
 */
export const learningObjectives = pgTable(
  'learning_objectives',
  {
    id: text('id').primaryKey(),
    planId: text('plan_id')
      .notNull()
      .references(() => learningPlans.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    /** Breadcrumb — same convention as `question_revisions.topic_path`. */
    topicPath: text('topic_path'),
    status: text('status').notNull().default('legacy_unreviewed'),
    position: integer('position').notNull().default(0),
    source: text('source').notNull().default('topic-tree'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('idx_learning_objectives_plan').on(t.planId, t.position)],
);

/**
 * A lesson belongs to exactly one module and (for now, §11.1 ADR-017) teaches
 * exactly one objective. The mapping script keeps that 1:1; the column is not
 * uniquely constrained on `objectiveId` so a later authored lesson (Phase 4)
 * covering multiple objectives is not blocked at the schema level.
 */
export const lessons = pgTable(
  'lessons',
  {
    id: text('id').primaryKey(),
    planId: text('plan_id')
      .notNull()
      .references(() => learningPlans.id, { onDelete: 'cascade' }),
    moduleId: text('module_id')
      .notNull()
      .references(() => learningModules.id, { onDelete: 'cascade' }),
    objectiveId: text('objective_id')
      .notNull()
      .references(() => learningObjectives.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').notNull().default('legacy_unreviewed'),
    position: integer('position').notNull().default(0),
    source: text('source').notNull().default('topic-tree'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('idx_lessons_module').on(t.moduleId, t.position),
    index('idx_lessons_objective').on(t.objectiveId),
    index('idx_lessons_plan').on(t.planId),
  ],
);

/**
 * One typed, ordered content block inside a lesson (§11.3). `blockType` is one
 * of `LESSON_BLOCK_TYPES` (`server/domains/learning/types.ts`); an unknown value
 * here means a client renderer failed safely rather than the server rejecting
 * unfamiliar content (§11.3 "fail safely with logging").
 */
export const lessonBlocks = pgTable(
  'lesson_blocks',
  {
    id: text('id').primaryKey(),
    lessonId: text('lesson_id')
      .notNull()
      .references(() => lessons.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    blockType: text('block_type').notNull(),
    schemaVersion: integer('schema_version').notNull().default(1),
    payload: jsonb('payload').notNull().$type<Record<string, unknown>>().default({}),
    status: text('status').notNull().default('legacy_unreviewed'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('uq_lesson_blocks_lesson_position').on(t.lessonId, t.position),
    index('idx_lesson_blocks_type').on(t.blockType),
  ],
);
