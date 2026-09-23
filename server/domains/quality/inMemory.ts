/**
 * In-memory quality repositories (Phase 4 WS9 parity peer) — dev fixtures and
 * the contract-test peer to the SQL adapter. Writes inside a `tx` are
 * rejected, same rule as every other in-memory repository here (§10).
 */
import { randomUUID } from 'node:crypto';
import type { Transaction } from '../shared/context';
import { createInMemoryAssessmentRepository } from './inMemoryAssessments';
import {
  boundedGroupLimit,
  compareReportGroups,
  type ContentReportRepository,
  type QualityRepositories,
  type QuestionSignalRepository,
} from './repository';
import type { ContentReport, ContentReportGroup, OptionPickCount, QuestionAccuracy } from './types';

function rejectTx(tx?: Transaction): void {
  if (tx) throw new Error('in-memory quality repository does not support transactional writes (§10)');
}

export interface InMemoryQualityOptions {
  now?: () => Date;
  /**
   * Where correctness comes from. The SQL adapter reads `study_answers`; the
   * in-memory peer reads whatever the caller hands it (default: nothing).
   */
  answers?: () => Promise<Array<{ questionId: string; isCorrect: boolean }>>;
}

export function createInMemoryQualityRepositories(options: InMemoryQualityOptions = {}): QualityRepositories {
  const now = options.now ?? (() => new Date());
  const reports = new Map<string, ContentReport>();
  const picks = new Map<string, OptionPickCount>();

  const reportRepo: ContentReportRepository = {
    async create(input, tx) {
      rejectTx(tx);
      const existing = [...reports.values()].find(
        (r) =>
          r.status === 'open' &&
          r.reporterUserId === input.reporterUserId &&
          r.entityType === input.entityType &&
          r.entityId === input.entityId &&
          r.category === input.category,
      );
      if (existing) return { kind: 'duplicate', report: { ...existing } };
      const report: ContentReport = {
        id: `crep_${randomUUID()}`,
        entityType: input.entityType,
        entityId: input.entityId,
        revisionId: input.revisionId ?? null,
        reporterUserId: input.reporterUserId,
        category: input.category,
        comment: input.comment ?? null,
        sessionId: input.sessionId ?? null,
        status: 'open',
        resolutionNote: null,
        resolvedRevisionId: null,
        resolvedBy: null,
        resolvedAt: null,
        createdAt: now().toISOString(),
      };
      reports.set(report.id, report);
      return { kind: 'created', report: { ...report } };
    },

    async listGroups(opts, tx) {
      rejectTx(tx);
      const groups = new Map<string, ContentReportGroup>();
      for (const r of reports.values()) {
        const key = `${r.entityType}:${r.entityId}`;
        const g = groups.get(key) ?? {
          entityType: r.entityType,
          entityId: r.entityId,
          openCount: 0,
          totalCount: 0,
          categories: {},
          latestRevisionId: null,
          firstAt: r.createdAt,
          latestAt: r.createdAt,
        };
        g.totalCount += 1;
        if (r.createdAt < g.firstAt) g.firstAt = r.createdAt;
        if (r.createdAt > g.latestAt) g.latestAt = r.createdAt;
        if (r.status === 'open') {
          g.openCount += 1;
          g.categories[r.category] = (g.categories[r.category] ?? 0) + 1;
        }
        groups.set(key, g);
      }
      // Latest revision among open reports — needs a second pass over newest-first reports.
      const newestFirst = [...reports.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      for (const g of groups.values()) {
        g.latestRevisionId =
          newestFirst.find(
            (r) => r.status === 'open' && r.entityType === g.entityType && r.entityId === g.entityId && r.revisionId,
          )?.revisionId ?? null;
      }
      return [...groups.values()]
        .filter((g) => opts?.includeClosed || g.openCount > 0)
        .sort(compareReportGroups)
        .slice(0, boundedGroupLimit(opts?.limit));
    },

    async listForEntity(entityType, entityId, tx) {
      rejectTx(tx);
      return [...reports.values()]
        .filter((r) => r.entityType === entityType && r.entityId === entityId)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : a.id < b.id ? 1 : -1))
        .map((r) => ({ ...r }));
    },

    async listByReporter(reporterUserId, limit = 20, tx) {
      rejectTx(tx);
      return [...reports.values()]
        .filter((r) => r.reporterUserId === reporterUserId)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : a.id < b.id ? 1 : -1))
        .slice(0, Math.max(1, Math.min(limit, 100)))
        .map((r) => ({ ...r }));
    },

    async resolveEntity(input, tx) {
      rejectTx(tx);
      const at = now().toISOString();
      let count = 0;
      for (const r of reports.values()) {
        if (r.status !== 'open' || r.entityType !== input.entityType || r.entityId !== input.entityId) continue;
        reports.set(r.id, {
          ...r,
          status: input.status,
          resolutionNote: input.note ?? null,
          resolvedRevisionId: input.resolvedRevisionId ?? null,
          resolvedBy: input.resolvedBy,
          resolvedAt: at,
        });
        count += 1;
      }
      return count;
    },

    async countOpen(tx) {
      rejectTx(tx);
      return [...reports.values()].filter((r) => r.status === 'open').length;
    },
  };

  const signalRepo: QuestionSignalRepository = {
    async accuracy({ minAttempts }, tx) {
      rejectTx(tx);
      const rows = options.answers ? await options.answers() : [];
      const byQuestion = new Map<string, QuestionAccuracy>();
      for (const a of rows) {
        const s = byQuestion.get(a.questionId) ?? { questionId: a.questionId, attempts: 0, correct: 0 };
        s.attempts += 1;
        if (a.isCorrect) s.correct += 1;
        byQuestion.set(a.questionId, s);
      }
      return [...byQuestion.values()]
        .filter((s) => s.attempts >= minAttempts)
        .sort((a, b) => (a.questionId < b.questionId ? -1 : 1));
    },

    async recordPick(input, tx) {
      rejectTx(tx);
      const key = `${input.revisionId}#${input.optionIndex}`;
      const row = picks.get(key) ?? { ...input, picks: 0 };
      row.picks += 1;
      row.optionCount = input.optionCount;
      picks.set(key, row);
    },

    async picks(opts, tx) {
      rejectTx(tx);
      const filter = opts?.questionIds ? new Set(opts.questionIds) : null;
      return [...picks.values()]
        .filter((p) => !filter || filter.has(p.questionId))
        .sort((a, b) => (a.revisionId === b.revisionId ? a.optionIndex - b.optionIndex : a.revisionId < b.revisionId ? -1 : 1))
        .map((p) => ({ ...p }));
    },
  };

  return { reports: reportRepo, signals: signalRepo, assessments: createInMemoryAssessmentRepository(now) };
}
