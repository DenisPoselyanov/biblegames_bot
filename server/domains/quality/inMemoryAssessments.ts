/**
 * In-memory `AssessmentRepository` — dev fixtures and the contract-test peer
 * to the SQL adapter (`infrastructure/database/repositories/assessments.ts`).
 */
import { randomUUID } from 'node:crypto';
import type { Transaction } from '../shared/context';
import {
  boundedQueueLimit,
  compareQueue,
  isNewer,
  matchesQueueFilter,
  type AssessmentRepository,
  type QuestionAssessment,
} from './assessment';

function rejectTx(tx?: Transaction): void {
  if (tx) throw new Error('in-memory assessment repository does not support transactional writes (§10)');
}

const clone = (a: QuestionAssessment): QuestionAssessment => structuredClone(a);

export function createInMemoryAssessmentRepository(clock: () => Date = () => new Date()): AssessmentRepository {
  const rows = new Map<string, QuestionAssessment>();
  // Strictly increasing, so "newest per question" never depends on two writes sharing a millisecond.
  let last = 0;
  const now = (): Date => {
    last = Math.max(clock().getTime(), last + 1);
    return new Date(last);
  };

  const latestAiRows = (): QuestionAssessment[] => {
    const latest = new Map<string, QuestionAssessment>();
    for (const a of rows.values()) {
      if (a.source !== 'ai') continue;
      const prev = latest.get(a.questionId);
      if (!prev || isNewer(a, prev)) latest.set(a.questionId, a);
    }
    return [...latest.values()];
  };

  return {
    async upsertGolden(input, tx) {
      rejectTx(tx);
      const at = now().toISOString();
      const existing = [...rows.values()].find((a) => a.source === 'golden' && a.questionId === input.questionId);
      const row: QuestionAssessment = {
        ...structuredClone(input),
        source: 'golden',
        id: existing?.id ?? `qa_${randomUUID()}`,
        decision: null,
        decisionNote: null,
        decisionPatch: null,
        decidedBy: null,
        decidedAt: null,
        appliedAt: null,
        createdAt: existing?.createdAt ?? at,
        updatedAt: at,
      };
      rows.set(row.id, row);
      return clone(row);
    },

    async addAi(input, tx) {
      rejectTx(tx);
      const at = now().toISOString();
      const row: QuestionAssessment = {
        ...structuredClone(input),
        source: 'ai',
        id: `qa_${randomUUID()}`,
        decision: null,
        decisionNote: null,
        decisionPatch: null,
        decidedBy: null,
        decidedAt: null,
        appliedAt: null,
        createdAt: at,
        updatedAt: at,
      };
      rows.set(row.id, row);
      return clone(row);
    },

    async getById(id, tx) {
      rejectTx(tx);
      const row = rows.get(id);
      return row ? clone(row) : null;
    },

    async listGolden(tx) {
      rejectTx(tx);
      return [...rows.values()]
        .filter((a) => a.source === 'golden')
        .sort((a, b) => (a.questionId < b.questionId ? -1 : 1))
        .map(clone);
    },

    async latestAi(options, tx) {
      rejectTx(tx);
      const ids = options?.questionIds ? new Set(options.questionIds) : null;
      return latestAiRows()
        .filter((a) => !ids || ids.has(a.questionId))
        .sort((a, b) => (a.questionId < b.questionId ? -1 : 1))
        .map(clone);
    },

    async aiKeys(rubricVersion, tx) {
      rejectTx(tx);
      const keys = new Set<string>();
      for (const a of rows.values()) {
        if (a.source === 'ai' && a.rubricVersion === rubricVersion) keys.add(`${a.questionId}:${a.contentHash}`);
      }
      return keys;
    },

    async queue(filter = {}, tx) {
      rejectTx(tx);
      const matching = latestAiRows().filter((a) => matchesQueueFilter(a, filter)).sort(compareQueue);
      const offset = Math.max(0, Math.floor(filter.offset ?? 0));
      return {
        items: matching.slice(offset, offset + boundedQueueLimit(filter.limit)).map(clone),
        total: matching.length,
      };
    },

    async decide(input, tx) {
      rejectTx(tx);
      const at = now().toISOString();
      let count = 0;
      for (const id of input.ids) {
        const row = rows.get(id);
        if (!row || row.source !== 'ai') continue;
        rows.set(id, {
          ...row,
          decision: input.decision,
          decisionNote: input.note ?? null,
          decisionPatch: input.patch ? structuredClone(input.patch) : null,
          decidedBy: input.decidedBy,
          decidedAt: at,
          appliedAt: null,
          updatedAt: at,
        });
        count += 1;
      }
      return count;
    },

    async markApplied(ids, at, tx) {
      rejectTx(tx);
      let count = 0;
      for (const id of ids) {
        const row = rows.get(id);
        if (!row) continue;
        rows.set(id, { ...row, appliedAt: at, updatedAt: at });
        count += 1;
      }
      return count;
    },

    async summary(tx) {
      rejectTx(tx);
      const latest = latestAiRows();
      const byVerdict: Record<string, number> = {};
      for (const a of latest) byVerdict[a.verdict] = (byVerdict[a.verdict] ?? 0) + 1;
      return {
        ai: {
          total: latest.length,
          byVerdict,
          undecided: latest.filter((a) => !a.decision && a.verdict !== 'pass').length,
          decidedUnapplied: latest.filter((a) => a.decision && a.decision !== 'dismissed' && !a.appliedAt).length,
        },
        golden: { total: [...rows.values()].filter((a) => a.source === 'golden').length },
      };
    },
  };
}
