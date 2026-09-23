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
import type { RevisionStatusCounts, RevisionStatusFilter } from '../shared/revisionStatusFilter';
import type {
  AppendOutcome,
  ContentSetVersionRecord,
  ContentSetVersionSummary,
  ThemeStatusCount,
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
   * Published revisions matching a filter — the pool a consumer picks from.
   * `limit` defaults high enough to cover a full theme+difficulty pool (the
   * legacy path had no LIMIT); a runaway ceiling still applies. Never returns
   * drafts or quarantined revisions.
   */
  listPublished(filter: PublishedFilter, tx?: Transaction): Promise<QuestionRevisionRecord[]>;
  /**
   * Revisions across every question whose status is in `filter.statuses`,
   * newest `createdAt` first (Phase 4 WS8b — the Studio review queue). Bounded:
   * default 100, max 500.
   */
  listByStatus(filter: RevisionStatusFilter, tx?: Transaction): Promise<QuestionRevisionRecord[]>;
  /** Revision count per status, every status present (zero when none). */
  countByStatus(tx?: Transaction): Promise<RevisionStatusCounts>;
  /**
   * Revision count per (theme, status), sorted by theme then status (Phase 4
   * WS8c — the Studio library's coverage table). Only non-zero pairs.
   */
  countByTheme(tx?: Transaction): Promise<ThemeStatusCount[]>;
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
   * Every set's versions, newest `publishedAt` first (Phase 4 WS8c — the Studio
   * releases list). Summaries only, no items. Default 50, max 500.
   */
  listVersions(options?: { limit?: number }, tx?: Transaction): Promise<ContentSetVersionSummary[]>;
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
