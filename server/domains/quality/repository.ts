/**
 * Content-quality repositories (Phase 4 WS9). Interfaces only — the SQL
 * adapter lives in `server/infrastructure/database/repositories/quality.ts`,
 * the in-memory peer in `./inMemory.ts`; both pass `__tests__/*Contract.ts`.
 */
import type { Transaction } from '../shared/context';
import type { AssessmentRepository } from './assessment';
import type {
  ContentReport,
  ContentReportGroup,
  CreateReportOutcome,
  NewContentReport,
  OptionPickCount,
  QuestionAccuracy,
  ReportEntityType,
  ResolveReportsInput,
} from './types';

export interface ContentReportRepository {
  /** Idempotent per (reporter, entity, category) while a report is open — see `CreateReportOutcome`. */
  create(input: NewContentReport, tx?: Transaction): Promise<CreateReportOutcome>;
  /**
   * One group per entity, entities with open reports first (most open first),
   * then newest activity. `includeClosed` adds entities whose reports are all
   * resolved/dismissed. Default limit 100, max 500.
   */
  listGroups(options?: { includeClosed?: boolean; limit?: number }, tx?: Transaction): Promise<ContentReportGroup[]>;
  /** Every report on one entity, newest first. */
  listForEntity(entityType: ReportEntityType, entityId: string, tx?: Transaction): Promise<ContentReport[]>;
  /** A player's own reports, newest first (§14 "optional user acknowledgement"). */
  listByReporter(reporterUserId: string, limit?: number, tx?: Transaction): Promise<ContentReport[]>;
  /** Close every open report on the entity at once; returns how many were closed. */
  resolveEntity(input: ResolveReportsInput, tx?: Transaction): Promise<number>;
  countOpen(tx?: Transaction): Promise<number>;
}

export interface QuestionSignalRepository {
  /** Per-question correctness from recorded answers, only questions with `>= minAttempts`. */
  accuracy(options: { minAttempts: number }, tx?: Transaction): Promise<QuestionAccuracy[]>;
  /** +1 on one option of one revision. */
  recordPick(input: Omit<OptionPickCount, 'picks'>, tx?: Transaction): Promise<void>;
  /** Pick counters, optionally restricted to some questions. */
  picks(options?: { questionIds?: readonly string[] }, tx?: Transaction): Promise<OptionPickCount[]>;
}

export interface QualityRepositories {
  reports: ContentReportRepository;
  signals: QuestionSignalRepository;
  /** Golden labels + AI reviewer verdicts (content quality gate). */
  assessments: AssessmentRepository;
}

export const REPORT_GROUP_DEFAULT_LIMIT = 100;
export const REPORT_GROUP_MAX_LIMIT = 500;

export function boundedGroupLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit) || (limit ?? 0) <= 0) return REPORT_GROUP_DEFAULT_LIMIT;
  return Math.min(Math.floor(limit as number), REPORT_GROUP_MAX_LIMIT);
}

/** Open-first, then most open, then newest — identical in every adapter. */
export function compareReportGroups(a: ContentReportGroup, b: ContentReportGroup): number {
  if ((a.openCount > 0) !== (b.openCount > 0)) return a.openCount > 0 ? -1 : 1;
  if (a.openCount !== b.openCount) return b.openCount - a.openCount;
  if (a.latestAt !== b.latestAt) return a.latestAt < b.latestAt ? 1 : -1;
  return a.entityId < b.entityId ? -1 : a.entityId > b.entityId ? 1 : 0;
}
