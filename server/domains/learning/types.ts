/**
 * Learning domain value types (Phase 3 WS1, ADR-017). Domain-owned: no `pg`, no
 * Drizzle `InferSelectModel`, no HTTP types. Repository interfaces speak only
 * these and `@contracts` types.
 */
import type { ContentStatus } from '../../../contracts/index';

/** Where a row came from — the mapping script today, Content Studio in Phase 4. */
export type LearningContentSource = 'topic-tree' | 'authored';

export interface LearningPlanRecord {
  id: string;
  themeId: string;
  title: string;
  description: string | null;
  status: ContentStatus;
  position: number;
  source: LearningContentSource;
  createdAt: string;
  updatedAt: string;
}

export interface LearningModuleRecord {
  id: string;
  planId: string;
  parentModuleId: string | null;
  title: string;
  description: string | null;
  status: ContentStatus;
  position: number;
  source: LearningContentSource;
  createdAt: string;
  updatedAt: string;
}

export interface LearningObjectiveRecord {
  id: string;
  planId: string;
  title: string;
  description: string | null;
  topicPath: string | null;
  status: ContentStatus;
  position: number;
  source: LearningContentSource;
  createdAt: string;
  updatedAt: string;
}

export interface LessonRecord {
  id: string;
  planId: string;
  moduleId: string;
  objectiveId: string;
  title: string;
  description: string | null;
  status: ContentStatus;
  position: number;
  source: LearningContentSource;
  createdAt: string;
  updatedAt: string;
}

/** Typed lesson-block kinds (§11.3 of the Phase 3 spec). */
export const LESSON_BLOCK_TYPES = [
  'heading',
  'text',
  'scripture',
  'explanation',
  'glossary',
  'image',
  'reflection',
  'question',
  'summary',
  'next_step',
] as const;
export type LessonBlockType = (typeof LESSON_BLOCK_TYPES)[number];

export interface LessonBlockRecord {
  id: string;
  lessonId: string;
  position: number;
  blockType: LessonBlockType;
  schemaVersion: number;
  payload: Record<string, unknown>;
  status: ContentStatus;
  createdAt: string;
  updatedAt: string;
}

// --- Upsert inputs. Ids are always caller-supplied: the mapping script derives
// deterministic ids from topic-tree node ids so repeated runs are idempotent by
// id, not by a generated key (contrast `content.appendRevision`). ------------

export interface PlanUpsert {
  id: string;
  themeId: string;
  title: string;
  description?: string | null;
  status?: ContentStatus;
  position?: number;
  source?: LearningContentSource;
}

export interface ModuleUpsert {
  id: string;
  planId: string;
  parentModuleId?: string | null;
  title: string;
  description?: string | null;
  status?: ContentStatus;
  position?: number;
  source?: LearningContentSource;
}

export interface ObjectiveUpsert {
  id: string;
  planId: string;
  title: string;
  description?: string | null;
  topicPath?: string | null;
  status?: ContentStatus;
  position?: number;
  source?: LearningContentSource;
}

export interface LessonUpsert {
  id: string;
  planId: string;
  moduleId: string;
  objectiveId: string;
  title: string;
  description?: string | null;
  status?: ContentStatus;
  position?: number;
  source?: LearningContentSource;
}

export interface LessonBlockUpsert {
  id: string;
  lessonId: string;
  position: number;
  blockType: LessonBlockType;
  schemaVersion?: number;
  payload?: Record<string, unknown>;
  status?: ContentStatus;
}
