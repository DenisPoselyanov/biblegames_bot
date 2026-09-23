/**
 * SQL quality repositories (Phase 4 WS9) — the production adapter for
 * `server/domains/quality/repository.ts`, on Drizzle. Correctness is read
 * from the existing `study_answers` table (aggregated on read, nothing
 * duplicated); reports and option-pick counters live in `schema/quality.ts`.
 */
import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Transaction as OpaqueTx } from '../../../domains/shared/context';
import {
  boundedGroupLimit,
  compareReportGroups,
  type ContentReportRepository,
  type QualityRepositories,
  type QuestionSignalRepository,
} from '../../../domains/quality/repository';
import type {
  ContentReport,
  ContentReportCategory,
  ContentReportGroup,
  ContentReportStatus,
  ReportEntityType,
} from '../../../domains/quality/types';
import type { Database, Transaction } from '../client';
import { studyAnswers } from '../schema/progression';
import { contentReports, questionOptionPicks } from '../schema/quality';

type Executor = Database | Transaction;

function asExecutor(db: Database, tx?: OpaqueTx): Executor {
  return (tx as unknown as Transaction | undefined) ?? db;
}

type ReportRow = typeof contentReports.$inferSelect;

const toReport = (row: ReportRow): ContentReport => ({
  id: row.id,
  entityType: row.entityType as ReportEntityType,
  entityId: row.entityId,
  revisionId: row.revisionId,
  reporterUserId: row.reporterUserId,
  category: row.category as ContentReportCategory,
  comment: row.comment,
  sessionId: row.sessionId,
  status: row.status as ContentReportStatus,
  resolutionNote: row.resolutionNote,
  resolvedRevisionId: row.resolvedRevisionId,
  resolvedBy: row.resolvedBy,
  resolvedAt: row.resolvedAt,
  createdAt: row.createdAt,
});

const OPEN = sql`${contentReports.status} = 'open'`;

export function createSqlQualityRepositories(db: Database): QualityRepositories {
  const reports: ContentReportRepository = {
    async create(input, tx) {
      const exec = asExecutor(db, tx);
      const [inserted] = await exec
        .insert(contentReports)
        .values({
          id: `crep_${randomUUID()}`,
          entityType: input.entityType,
          entityId: input.entityId,
          revisionId: input.revisionId ?? null,
          reporterUserId: input.reporterUserId,
          category: input.category,
          comment: input.comment ?? null,
          sessionId: input.sessionId ?? null,
        })
        // `uq_content_reports_open_per_reporter` is a partial index; an untargeted DO NOTHING covers it.
        .onConflictDoNothing()
        .returning();
      if (inserted) return { kind: 'created', report: toReport(inserted) };
      const [existing] = await exec
        .select()
        .from(contentReports)
        .where(
          and(
            eq(contentReports.reporterUserId, input.reporterUserId),
            eq(contentReports.entityType, input.entityType),
            eq(contentReports.entityId, input.entityId),
            eq(contentReports.category, input.category),
            eq(contentReports.status, 'open'),
          ),
        )
        .limit(1);
      if (!existing) throw new Error('content report insert conflicted but no open duplicate was found');
      return { kind: 'duplicate', report: toReport(existing) };
    },

    async listGroups(options, tx) {
      const exec = asExecutor(db, tx);
      const openCount = sql<number>`(count(*) filter (where ${OPEN}))::int`;
      const latestAt = sql<string>`max(${contentReports.createdAt})`;
      const base = exec
        .select({
          entityType: contentReports.entityType,
          entityId: contentReports.entityId,
          openCount,
          totalCount: sql<number>`count(*)::int`,
          firstAt: sql<string>`min(${contentReports.createdAt})`,
          latestAt,
          latestRevisionId: sql<
            string | null
          >`(array_agg(${contentReports.revisionId} order by ${contentReports.createdAt} desc) filter (where ${OPEN} and ${contentReports.revisionId} is not null))[1]`,
        })
        .from(contentReports)
        .groupBy(contentReports.entityType, contentReports.entityId);
      const grouped = options?.includeClosed ? base : base.having(sql`${openCount} > 0`);
      const rows = await grouped
        .orderBy(sql`(${openCount} > 0) desc`, desc(openCount), desc(latestAt), asc(contentReports.entityId))
        .limit(boundedGroupLimit(options?.limit));
      if (rows.length === 0) return [];

      const categoryRows = await exec
        .select({
          entityType: contentReports.entityType,
          entityId: contentReports.entityId,
          category: contentReports.category,
          count: sql<number>`count(*)::int`,
        })
        .from(contentReports)
        .where(
          and(
            eq(contentReports.status, 'open'),
            inArray(
              contentReports.entityId,
              rows.map((r) => r.entityId),
            ),
          ),
        )
        .groupBy(contentReports.entityType, contentReports.entityId, contentReports.category);

      return rows
        .map((r): ContentReportGroup => {
          const categories: ContentReportGroup['categories'] = {};
          for (const c of categoryRows) {
            if (c.entityType === r.entityType && c.entityId === r.entityId) {
              categories[c.category as ContentReportCategory] = c.count;
            }
          }
          return {
            entityType: r.entityType as ReportEntityType,
            entityId: r.entityId,
            openCount: r.openCount,
            totalCount: r.totalCount,
            categories,
            latestRevisionId: r.latestRevisionId ?? null,
            firstAt: r.firstAt,
            latestAt: r.latestAt,
          };
        })
        .sort(compareReportGroups);
    },

    async listForEntity(entityType, entityId, tx) {
      const rows = await asExecutor(db, tx)
        .select()
        .from(contentReports)
        .where(and(eq(contentReports.entityType, entityType), eq(contentReports.entityId, entityId)))
        .orderBy(desc(contentReports.createdAt), desc(contentReports.id));
      return rows.map(toReport);
    },

    async listByReporter(reporterUserId, limit = 20, tx) {
      const rows = await asExecutor(db, tx)
        .select()
        .from(contentReports)
        .where(eq(contentReports.reporterUserId, reporterUserId))
        .orderBy(desc(contentReports.createdAt), desc(contentReports.id))
        .limit(Math.max(1, Math.min(limit, 100)));
      return rows.map(toReport);
    },

    async resolveEntity(input, tx) {
      const rows = await asExecutor(db, tx)
        .update(contentReports)
        .set({
          status: input.status,
          resolutionNote: input.note ?? null,
          resolvedRevisionId: input.resolvedRevisionId ?? null,
          resolvedBy: input.resolvedBy,
          resolvedAt: sql`now()`,
        })
        .where(
          and(
            eq(contentReports.entityType, input.entityType),
            eq(contentReports.entityId, input.entityId),
            eq(contentReports.status, 'open'),
          ),
        )
        .returning({ id: contentReports.id });
      return rows.length;
    },

    async countOpen(tx) {
      const [row] = await asExecutor(db, tx)
        .select({ count: sql<number>`count(*)::int` })
        .from(contentReports)
        .where(eq(contentReports.status, 'open'));
      return row?.count ?? 0;
    },
  };

  const signals: QuestionSignalRepository = {
    async accuracy({ minAttempts }, tx) {
      return asExecutor(db, tx)
        .select({
          questionId: studyAnswers.questionId,
          attempts: sql<number>`count(*)::int`,
          correct: sql<number>`(count(*) filter (where ${studyAnswers.isCorrect}))::int`,
        })
        .from(studyAnswers)
        .groupBy(studyAnswers.questionId)
        .having(sql`count(*) >= ${Math.max(1, Math.floor(minAttempts))}`)
        .orderBy(asc(studyAnswers.questionId));
    },

    async recordPick(input, tx) {
      await asExecutor(db, tx)
        .insert(questionOptionPicks)
        .values({ ...input, picks: 1 })
        .onConflictDoUpdate({
          target: [questionOptionPicks.revisionId, questionOptionPicks.optionIndex],
          set: {
            picks: sql`${questionOptionPicks.picks} + 1`,
            optionCount: input.optionCount,
            updatedAt: sql`now()`,
          },
        });
    },

    async picks(options, tx) {
      if (options?.questionIds && options.questionIds.length === 0) return [];
      const query = asExecutor(db, tx)
        .select({
          revisionId: questionOptionPicks.revisionId,
          questionId: questionOptionPicks.questionId,
          optionIndex: questionOptionPicks.optionIndex,
          optionCount: questionOptionPicks.optionCount,
          picks: questionOptionPicks.picks,
        })
        .from(questionOptionPicks);
      const filtered = options?.questionIds
        ? query.where(inArray(questionOptionPicks.questionId, [...options.questionIds]))
        : query;
      return filtered.orderBy(asc(questionOptionPicks.revisionId), asc(questionOptionPicks.optionIndex));
    },
  };

  return { reports, signals };
}
