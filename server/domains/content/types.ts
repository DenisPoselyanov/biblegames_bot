/**
 * Content domain value types (Phase 2 §5.5, §14). Domain-owned: no `pg`, no
 * Drizzle `InferSelectModel`, no HTTP types. Repository interfaces speak only
 * these and `@contracts` types.
 */
import type {
  ContentSetFilter,
  ContentStatus,
  Difficulty,
  PublishedContentSet,
  PublishedQuestion,
  ScriptureReference,
} from '../../../contracts/index';

export type { ContentSetFilter, PublishedContentSet, PublishedQuestion };

/** A Scripture citation as stored/handled inside the domain. */
export type ScriptureRef = ScriptureReference;

/** One stored, immutable question revision. */
export interface QuestionRevisionRecord {
  id: string;
  questionId: string;
  revisionNumber: number;
  status: ContentStatus;
  themeId: string;
  difficulty: Difficulty;
  topicNodeId: string | null;
  topicPath: string | null;
  text: string;
  options: string[];
  correctIndex: number;
  explanationShort: string | null;
  explanationDeep: string | null;
  reference: string | null;
  scriptureRefs: ScriptureRef[];
  tags: string[];
  contentHash: string;
  source: string;
  createdAt: string;
  createdBy: string | null;
  supersededAt: string | null;
  quarantineReason: string | null;
}

/** Body a caller supplies to create a new revision (hash + numbering derived). */
export interface RevisionDraft {
  questionId: string;
  themeId: string;
  difficulty: Difficulty;
  topicNodeId?: string | null;
  topicPath?: string | null;
  text: string;
  options: string[];
  correctIndex: number;
  explanationShort?: string | null;
  explanationDeep?: string | null;
  reference?: string | null;
  scriptureRefs?: ScriptureRef[];
  tags?: string[];
  source?: string;
  createdBy?: string | null;
  /** Starting lifecycle state. Import uses `legacy_unreviewed`; never `published`. */
  status?: Extract<ContentStatus, 'legacy_unreviewed' | 'draft'>;
}

/** Why `RevisionRepository.appendRevision` did what it did. */
export type AppendOutcome =
  | { kind: 'created'; revision: QuestionRevisionRecord }
  | { kind: 'unchanged'; revision: QuestionRevisionRecord };

export interface PublishedFilter {
  themeIds?: string[];
  difficulty?: Difficulty | null;
  topicNodeId?: string | null;
  questionIds?: string[];
  limit?: number;
}

export interface QuarantineInput {
  questionId: string;
  reason: string;
}

/** A frozen content-set version plus its ordered revision membership. */
export interface ContentSetVersionRecord {
  setId: string;
  kind: PublishedContentSet['kind'];
  version: number;
  contentHash: string;
  filter: ContentSetFilter;
  questionCount: number;
  items: Array<{ position: number; questionId: string; revisionId: string }>;
  publishedAt: string;
  publishedBy: string | null;
}
