/**
 * Content-quality feedback loop value types (Phase 4 WS9, spec §14, §18).
 * Domain-owned: no Drizzle, no HTTP. See `./repository.ts` for the contracts.
 */

export const CONTENT_REPORT_CATEGORIES = [
  'wrong_answer',
  'wording',
  'translation',
  'reference',
  'offensive',
  'technical',
] as const;
export type ContentReportCategory = (typeof CONTENT_REPORT_CATEGORIES)[number];

export type ContentReportStatus = 'open' | 'resolved' | 'dismissed';
export type ReportEntityType = 'question' | 'lesson';

/** Hard cap on a report comment — enough for "варіант Б теж правильний, бо…", not an essay (§14 privacy limits). */
export const REPORT_COMMENT_MAX = 500;

export interface ContentReport {
  id: string;
  entityType: ReportEntityType;
  entityId: string;
  revisionId: string | null;
  reporterUserId: string;
  category: ContentReportCategory;
  comment: string | null;
  sessionId: string | null;
  status: ContentReportStatus;
  resolutionNote: string | null;
  resolvedRevisionId: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface NewContentReport {
  entityType: ReportEntityType;
  entityId: string;
  revisionId?: string | null;
  reporterUserId: string;
  category: ContentReportCategory;
  comment?: string | null;
  sessionId?: string | null;
}

/** `created` — a new row; `duplicate` — this player already has an open report of this category on this entity. */
export type CreateReportOutcome =
  | { kind: 'created'; report: ContentReport }
  | { kind: 'duplicate'; report: ContentReport };

/**
 * All reports on one entity, folded for the reviewer queue (§14 "duplicate
 * report grouping"). Never carries reporter ids — a reviewer decides on the
 * content, not on who complained.
 */
export interface ContentReportGroup {
  entityType: ReportEntityType;
  entityId: string;
  openCount: number;
  totalCount: number;
  /** Open reports per category. */
  categories: Partial<Record<ContentReportCategory, number>>;
  /** Most recent revision any open report pointed at. */
  latestRevisionId: string | null;
  firstAt: string;
  latestAt: string;
}

export interface ResolveReportsInput {
  entityType: ReportEntityType;
  entityId: string;
  status: Exclude<ContentReportStatus, 'open'>;
  note?: string | null;
  resolvedRevisionId?: string | null;
  resolvedBy: string | null;
}

/** Correctness aggregate for one question across all recorded answers. */
export interface QuestionAccuracy {
  questionId: string;
  attempts: number;
  correct: number;
}

/** Anonymous pick counter for one option of one revision. */
export interface OptionPickCount {
  revisionId: string;
  questionId: string;
  optionIndex: number;
  optionCount: number;
  picks: number;
}
