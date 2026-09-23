/**
 * SQL `AssessmentRepository` (content quality gate) on Drizzle — the
 * production peer of `server/domains/quality/inMemoryAssessments.ts`; both pass
 * `server/domains/quality/__tests__/assessmentRepositoryContract.ts`.
 *
 * "Newest AI assessment per question" is a `distinct on (question_id)` over
 * `source = 'ai'`; the queue filters and sorts that set.
 */
import { randomUUID } from 'node:crypto';
import { and, eq, inArray, sql, type SQL } from 'drizzle-orm';
import type { Difficulty } from '../../../../contracts/index';
import type {
  AssessmentCriteria,
  AssessmentDecision,
  AssessmentSubject,
  AssessmentVerdict,
} from '../../../../src/lib/contentAssessment';
import {
  boundedQueueLimit,
  type AssessmentPatch,
  type AssessmentQueueFilter,
  type AssessmentRepository,
  type AssessmentSource,
  type NewAssessment,
  type QuestionAssessment,
} from '../../../domains/quality/assessment';
import type { Transaction as OpaqueTx } from '../../../domains/shared/context';
import type { Database, Transaction } from '../client';
import { questionAssessments } from '../schema/quality';

type Executor = Database | Transaction;
type Row = typeof questionAssessments.$inferSelect;

function asExecutor(db: Database, tx?: OpaqueTx): Executor {
  return (tx as unknown as Transaction | undefined) ?? db;
}

const iso = (v: string | null): string | null => (v ? new Date(v).toISOString() : null);

function toAssessment(row: Row): QuestionAssessment {
  return {
    id: row.id,
    questionId: row.questionId,
    contentHash: row.contentHash,
    source: row.source as AssessmentSource,
    assessor: row.assessor,
    rubricVersion: row.rubricVersion,
    verdict: row.verdict as AssessmentVerdict,
    criteria: row.criteria as AssessmentCriteria,
    suggestedDifficulty: (row.suggestedDifficulty as Difficulty | null) ?? null,
    suggestedTopicNodeId: row.suggestedTopicNodeId,
    suggestedExplanationShort: row.suggestedExplanationShort,
    suggestedExplanationDeep: row.suggestedExplanationDeep,
    notes: row.notes,
    confidence: row.confidence,
    risk: row.risk,
    subject: row.subject as unknown as AssessmentSubject,
    meta: row.meta ?? {},
    decision: (row.decision as AssessmentDecision | null) ?? null,
    decisionNote: row.decisionNote,
    decisionPatch: (row.decisionPatch as AssessmentPatch | null) ?? null,
    decidedBy: row.decidedBy,
    decidedAt: iso(row.decidedAt),
    appliedAt: iso(row.appliedAt),
    createdAt: iso(row.createdAt) as string,
    updatedAt: iso(row.updatedAt) as string,
  };
}

function toValues(input: NewAssessment, source: AssessmentSource) {
  return {
    questionId: input.questionId,
    contentHash: input.contentHash,
    source,
    assessor: input.assessor,
    rubricVersion: input.rubricVersion,
    verdict: input.verdict,
    criteria: input.criteria as Record<string, string>,
    suggestedDifficulty: input.suggestedDifficulty,
    suggestedTopicNodeId: input.suggestedTopicNodeId,
    suggestedExplanationShort: input.suggestedExplanationShort,
    suggestedExplanationDeep: input.suggestedExplanationDeep,
    notes: input.notes,
    confidence: input.confidence,
    risk: input.risk,
    subject: input.subject as unknown as Record<string, unknown>,
    meta: input.meta,
  };
}

/** SQL predicate for `matchesQueueFilter` over the latest-AI subquery alias `l`. */
function queueWhere(filter: AssessmentQueueFilter): SQL {
  const verdicts = filter.verdicts ?? ['reclassify', 'repair', 'reject'];
  const parts: SQL[] = [
    verdicts.length ? sql`l.verdict in (${sql.join(verdicts.map((v) => sql`${v}`), sql`, `)})` : sql`false`,
  ];
  const decided = filter.decided ?? 'undecided';
  if (decided === 'undecided') parts.push(sql`l.decision is null`);
  if (decided === 'decided') parts.push(sql`l.decision is not null`);
  if (filter.unappliedOnly) parts.push(sql`l.applied_at is null and l.decision in ('accepted', 'overridden')`);
  if (filter.themeId) parts.push(sql`l.subject->>'themeId' = ${filter.themeId}`);
  if (filter.questionIds) {
    parts.push(
      filter.questionIds.length
        ? sql`l.question_id in (${sql.join(filter.questionIds.map((id) => sql`${id}`), sql`, `)})`
        : sql`false`,
    );
  }
  return sql.join(parts, sql` and `);
}

const LATEST_AI = sql`(
  select distinct on (question_id) *
  from question_assessments
  where source = 'ai'
  order by question_id, created_at desc, id desc
)`;

export function createSqlAssessmentRepository(db: Database): AssessmentRepository {
  const selectLatest = async (ex: Executor, where: SQL, tail: SQL): Promise<Row[]> => {
    const res = await ex.execute(sql`select l.* from ${LATEST_AI} l where ${where} ${tail}`);
    // Raw rows come back snake_case; map through the table's own column names.
    return (res.rows as Record<string, unknown>[]).map(rowFromRaw);
  };

  return {
    async upsertGolden(input, tx) {
      const ex = asExecutor(db, tx);
      const values = { id: `qa_${randomUUID()}`, ...toValues(input, 'golden') };
      const [row] = await ex
        .insert(questionAssessments)
        .values(values)
        .onConflictDoUpdate({
          target: questionAssessments.questionId,
          targetWhere: sql`${questionAssessments.source} = 'golden'`,
          set: { ...toValues(input, 'golden'), updatedAt: sql`now()` },
        })
        .returning();
      return toAssessment(row);
    },

    async addAi(input, tx) {
      const [row] = await asExecutor(db, tx)
        .insert(questionAssessments)
        .values({ id: `qa_${randomUUID()}`, ...toValues(input, 'ai') })
        .returning();
      return toAssessment(row);
    },

    async getById(id, tx) {
      const [row] = await asExecutor(db, tx).select().from(questionAssessments).where(eq(questionAssessments.id, id));
      return row ? toAssessment(row) : null;
    },

    async listGolden(tx) {
      const rows = await asExecutor(db, tx)
        .select()
        .from(questionAssessments)
        .where(eq(questionAssessments.source, 'golden'))
        .orderBy(questionAssessments.questionId);
      return rows.map(toAssessment);
    },

    async latestAi(options, tx) {
      const ids = options?.questionIds;
      if (ids && ids.length === 0) return [];
      const where = ids ? sql`l.question_id in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})` : sql`true`;
      const rows = await selectLatest(asExecutor(db, tx), where, sql`order by l.question_id`);
      return rows.map(toAssessment);
    },

    async aiKeys(rubricVersion, tx) {
      const rows = await asExecutor(db, tx)
        .select({ questionId: questionAssessments.questionId, contentHash: questionAssessments.contentHash })
        .from(questionAssessments)
        .where(and(eq(questionAssessments.source, 'ai'), eq(questionAssessments.rubricVersion, rubricVersion)));
      return new Set(rows.map((r) => `${r.questionId}:${r.contentHash}`));
    },

    async queue(filter = {}, tx) {
      const ex = asExecutor(db, tx);
      const where = queueWhere(filter);
      const limit = boundedQueueLimit(filter.limit);
      const offset = Math.max(0, Math.floor(filter.offset ?? 0));
      const rows = await selectLatest(
        ex,
        where,
        sql`order by l.risk desc, l.created_at desc, l.id asc limit ${limit} offset ${offset}`,
      );
      const count = await ex.execute(sql`select count(*)::int as n from ${LATEST_AI} l where ${where}`);
      return { items: rows.map(toAssessment), total: Number((count.rows[0] as { n: number }).n) };
    },

    async decide(input, tx) {
      if (input.ids.length === 0) return 0;
      const rows = await asExecutor(db, tx)
        .update(questionAssessments)
        .set({
          decision: input.decision,
          decisionNote: input.note ?? null,
          decisionPatch: (input.patch as Record<string, unknown> | null | undefined) ?? null,
          decidedBy: input.decidedBy,
          decidedAt: sql`now()`,
          appliedAt: null,
          updatedAt: sql`now()`,
        })
        .where(and(inArray(questionAssessments.id, [...input.ids]), eq(questionAssessments.source, 'ai')))
        .returning({ id: questionAssessments.id });
      return rows.length;
    },

    async markApplied(ids, at, tx) {
      if (ids.length === 0) return 0;
      const rows = await asExecutor(db, tx)
        .update(questionAssessments)
        .set({ appliedAt: at, updatedAt: sql`now()` })
        .where(inArray(questionAssessments.id, [...ids]))
        .returning({ id: questionAssessments.id });
      return rows.length;
    },

    async summary(tx) {
      const ex = asExecutor(db, tx);
      const res = await ex.execute(sql`
        select l.verdict,
               count(*)::int as n,
               count(*) filter (where l.decision is null and l.verdict <> 'pass')::int as undecided,
               count(*) filter (where l.decision in ('accepted', 'overridden') and l.applied_at is null)::int as unapplied
        from ${LATEST_AI} l
        group by l.verdict`);
      const byVerdict: Record<string, number> = {};
      let total = 0;
      let undecided = 0;
      let decidedUnapplied = 0;
      for (const r of res.rows as Array<{ verdict: string; n: number; undecided: number; unapplied: number }>) {
        byVerdict[r.verdict] = Number(r.n);
        total += Number(r.n);
        undecided += Number(r.undecided);
        decidedUnapplied += Number(r.unapplied);
      }
      const [golden] = await ex
        .select({ n: sql<number>`count(*)::int` })
        .from(questionAssessments)
        .where(eq(questionAssessments.source, 'golden'));
      return { ai: { total, byVerdict, undecided, decidedUnapplied }, golden: { total: Number(golden?.n ?? 0) } };
    },
  };
}

/** snake_case raw row (from `db.execute`) → the Drizzle row shape. */
function rowFromRaw(r: Record<string, unknown>): Row {
  const ts = (v: unknown): string | null => (v == null ? null : v instanceof Date ? v.toISOString() : String(v));
  return {
    id: r.id as string,
    questionId: r.question_id as string,
    contentHash: r.content_hash as string,
    source: r.source as string,
    assessor: r.assessor as string,
    rubricVersion: r.rubric_version as string,
    verdict: r.verdict as string,
    criteria: r.criteria as Record<string, string>,
    suggestedDifficulty: (r.suggested_difficulty as string | null) ?? null,
    suggestedTopicNodeId: (r.suggested_topic_node_id as string | null) ?? null,
    suggestedExplanationShort: (r.suggested_explanation_short as string | null) ?? null,
    suggestedExplanationDeep: (r.suggested_explanation_deep as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    confidence: r.confidence == null ? null : Number(r.confidence),
    risk: Number(r.risk),
    subject: r.subject as Record<string, unknown>,
    meta: (r.meta as Record<string, unknown>) ?? {},
    decision: (r.decision as string | null) ?? null,
    decisionNote: (r.decision_note as string | null) ?? null,
    decisionPatch: (r.decision_patch as Record<string, unknown> | null) ?? null,
    decidedBy: (r.decided_by as string | null) ?? null,
    decidedAt: ts(r.decided_at),
    appliedAt: ts(r.applied_at),
    createdAt: ts(r.created_at) as string,
    updatedAt: ts(r.updated_at) as string,
  };
}
