/**
 * Learning domain value types (Phase 3 WS1/WS2, ADR-017). Domain-owned: no
 * `pg`, no Drizzle `InferSelectModel`, no HTTP types. Repository interfaces
 * speak only these and `@contracts` types.
 */
import type {
  ContentStatus,
  LessonSessionStatus,
  PracticeSessionMode,
  PracticeSessionStatus,
  Testament,
} from '../../../contracts/index';

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
  /** Content metadata (§10.3), nullable — unpopulated until Phase 4 content-ops tags it. */
  testament: Testament | null;
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
  /** Content metadata (§10.3), nullable — unpopulated until Phase 4 content-ops tags it. */
  testament: Testament | null;
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
  testament?: Testament | null;
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
  testament?: Testament | null;
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

// --- Lesson revisions (Phase 4 WS2, ADR-019 §2). An additive, immutable layer
// over the mutable `lessons`/`lesson_blocks` rows above — mirrors
// `content`'s `QuestionRevisionRecord`/`RevisionDraft` shape. `publishRevision`
// writes the snapshot through to the mutable rows so Learn hub reads (which
// query `lessons`/`lesson_blocks` directly) are unaffected by drafts. -------

/** One ordered block inside a lesson revision's denormalized snapshot. */
export interface LessonRevisionBlock {
  id: string;
  blockType: LessonBlockType;
  schemaVersion: number;
  payload: Record<string, unknown>;
}

/** One stored, immutable lesson revision. */
export interface LessonRevisionRecord {
  id: string;
  /** No FK — a draft for a brand-new lesson may exist before any `lessons` row does (parity with `questionId`). */
  lessonId: string;
  revisionNumber: number;
  status: ContentStatus;
  planId: string;
  moduleId: string;
  objectiveId: string;
  title: string;
  description: string | null;
  blocks: LessonRevisionBlock[];
  contentHash: string;
  source: string;
  createdAt: string;
  createdBy: string | null;
  supersededAt: string | null;
  quarantineReason: string | null;
}

/** Body a caller supplies to create a new lesson revision (hash + numbering derived). */
export interface LessonRevisionDraft {
  lessonId: string;
  planId: string;
  moduleId: string;
  objectiveId: string;
  title: string;
  description?: string | null;
  blocks: LessonRevisionBlock[];
  source?: string;
  createdBy?: string | null;
  /** Starting lifecycle state — never `published` directly (ADR-019 §3). */
  status?: Extract<ContentStatus, 'legacy_unreviewed' | 'draft'>;
}

export type AppendLessonRevisionOutcome =
  | { kind: 'created'; revision: LessonRevisionRecord }
  | { kind: 'unchanged'; revision: LessonRevisionRecord };

export interface LessonQuarantineInput {
  lessonId: string;
  reason: string;
}

// --- Session tracking (Phase 3 WS2, §11.4/§12.1). Ids are always caller-
// supplied (a UUID minted by the service layer), matching the content-mapping
// upsert convention above rather than a DB-generated key. --------------------

export interface LessonSessionRecord {
  id: string;
  userId: string;
  lessonId: string;
  planId: string;
  moduleId: string;
  status: LessonSessionStatus;
  /** The lesson's `updatedAt` at session-start — lets a resuming client detect the content shifted under it. */
  contentRevision: string;
  checkpointBlockId: string | null;
  startedAt: string;
  lastActivityAt: string;
  completedAt: string | null;
}

export interface LessonSessionStart {
  id: string;
  userId: string;
  lessonId: string;
  planId: string;
  moduleId: string;
  contentRevision: string;
}

export interface PracticeSessionRecord {
  id: string;
  userId: string;
  mode: PracticeSessionMode;
  objectiveId: string;
  /** Pinned revision ids, in presentation order — not question ids, so a mid-session content edit can't change what's already shown (§12.6). */
  questionRevisionIds: string[];
  currentIndex: number;
  status: PracticeSessionStatus;
  createdAt: string;
  expiresAt: string;
}

export interface PracticeSessionCreate {
  id: string;
  userId: string;
  mode: PracticeSessionMode;
  objectiveId: string;
  questionRevisionIds: string[];
  expiresAt: string;
}
