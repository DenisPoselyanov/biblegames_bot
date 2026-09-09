/**
 * Content domain repository contracts (Phase 2 §10, §14).
 *
 * Interfaces only — implementations live in `server/infrastructure/database/`
 * (SQL, production) and `./inMemoryRepository.ts` (dev/test parity peer). Both
 * pass `__tests__/repositoryContract.ts`.
 *
 * `tx` is the opaque `Transaction` from `ServiceContext` (§11); a call with no
 * `tx` runs on the pooled connection. The SQL adapter narrows it internally.
 */
import type { Transaction } from '../shared/context';
import type {
  AppendOutcome,
  ContentSetVersionRecord,
  PublishedFilter,
  QuarantineInput,
  QuestionRevisionRecord,
  RevisionDraft,
} from './types';

export interface QuestionRevisionRepository {
  getById(id: string, tx?: Transaction): Promise<QuestionRevisionRecord | null>;
  /** The currently `published` revision for a question, or `null`. */
  getPublished(questionId: string, tx?: Transaction): Promise<QuestionRevisionRecord | null>;
  /** Every revision for a question, newest `revisionNumber` first. */
  listRevisions(questionId: string, tx?: Transaction): Promise<QuestionRevisionRecord[]>;
  /**
   * Published revisions matching a filter (§12.3 — bounded; `limit` defaults to
   * 500, hard-capped). Never returns drafts or quarantined revisions.
   */
  listPublished(filter: PublishedFilter, tx?: Transaction): Promise<QuestionRevisionRecord[]>;
  /**
   * Append a new revision from a draft. Idempotent by body hash: if the latest
   * revision for the question already has the same `contentHash`, returns
   * `{ kind: 'unchanged' }` and writes nothing.
   */
  appendRevision(draft: RevisionDraft, tx?: Transaction): Promise<AppendOutcome>;
  /**
   * Publish a specific revision: mark it `published`, stamp `supersededAt` on the
   * previously published revision for that question. Returns the published row.
   */
  publishRevision(revisionId: string, tx?: Transaction): Promise<QuestionRevisionRecord>;
  /** Move every non-archived revision of a question to `quarantined` with a reason. */
  quarantine(input: QuarantineInput, tx?: Transaction): Promise<number>;
  /** Count of published revisions (for import/verification reporting). */
  countPublished(tx?: Transaction): Promise<number>;
}

export interface ContentSetRepository {
  /** A frozen set version with its ordered items, or `null`. */
  getVersion(
    setId: string,
    version: number,
    tx?: Transaction,
  ): Promise<ContentSetVersionRecord | null>;
  /** The latest version of a set, or `null` if never published. */
  getLatest(setId: string, tx?: Transaction): Promise<ContentSetVersionRecord | null>;
  /**
   * Freeze `revisionIds` (in order) as the next version of `setId`, creating the
   * set row if needed. Idempotent by content hash: if the latest version already
   * has the same ordered membership, returns it unchanged.
   */
  publishVersion(
    input: {
      setId: string;
      kind: ContentSetVersionRecord['kind'];
      filter: ContentSetVersionRecord['filter'];
      items: Array<{ questionId: string; revisionId: string }>;
      publishedBy?: string | null;
    },
    tx?: Transaction,
  ): Promise<ContentSetVersionRecord>;
}

export interface ContentRepositories {
  revisions: QuestionRevisionRepository;
  sets: ContentSetRepository;
}
