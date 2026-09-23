/**
 * Cross-question/cross-lesson "revisions by status" read (Phase 4 WS8b) —
 * the Studio review queue's data source. Shared by `content` and `learning`
 * (same precedent as `revisionDiff.ts`/`contentWriteGuard.ts`): both
 * repositories take the same filter and return the same count shape.
 *
 * Unlike `listPublished` (an internal pool-building read with a 10k default),
 * this backs a paginated-by-cap UI list, so the default is small and the
 * ceiling is a real bound, not just a runaway guard.
 */
import { CONTENT_STATUS_VALUES, type ContentStatus } from '../../../contracts/index';

export interface RevisionStatusFilter {
  /** Non-empty; revisions in any of these statuses are returned. */
  statuses: readonly ContentStatus[];
  /** Newest-first cap. Default 100, hard max 500. */
  limit?: number;
}

export const STATUS_LIST_DEFAULT_LIMIT = 100;
export const STATUS_LIST_MAX_LIMIT = 500;

export function boundedStatusLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit) || (limit ?? 0) <= 0) return STATUS_LIST_DEFAULT_LIMIT;
  return Math.min(Math.floor(limit as number), STATUS_LIST_MAX_LIMIT);
}

export type RevisionStatusCounts = Record<ContentStatus, number>;

/** Every status present with `0` — callers never have to guess whether a missing key means zero. */
export function emptyStatusCounts(): RevisionStatusCounts {
  return Object.fromEntries(CONTENT_STATUS_VALUES.map((s) => [s, 0])) as RevisionStatusCounts;
}

/** Newest `createdAt` first; `id` breaks ties so the order is total and stable across adapters. */
export function compareNewestFirst(
  a: { createdAt: string; id: string },
  b: { createdAt: string; id: string },
): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}
