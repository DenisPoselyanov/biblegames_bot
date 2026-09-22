/**
 * SQL `ScriptureEvidenceRepository` (Phase 4 WS4) — the production adapter for
 * `server/domains/shared/scriptureEvidenceRepository.ts`, on Drizzle.
 */
import { and, eq, inArray, isNull, ne, or } from 'drizzle-orm';
import type { ScriptureVerdict } from '../../../domains/content/scriptureVerification';
import type { Transaction as OpaqueTx } from '../../../domains/shared/context';
import type {
  EvidenceRevisionType,
  NewScriptureEvidence,
  ScriptureEvidenceRecord,
} from '../../../domains/shared/scriptureEvidence';
import type { ScriptureEvidenceRepository } from '../../../domains/shared/scriptureEvidenceRepository';
import type { Database, Transaction } from '../client';
import { scriptureEvidence } from '../schema/scriptureEvidence';

type Executor = Database | Transaction;

function asExecutor(db: Database, tx?: OpaqueTx): Executor {
  return (tx as unknown as Transaction | undefined) ?? db;
}

let seq = 0;
const nextId = (): string =>
  `sevid_${Date.now().toString(36)}${(++seq).toString(36).padStart(3, '0')}`;

type Row = typeof scriptureEvidence.$inferSelect;

const toRecord = (row: Row): ScriptureEvidenceRecord => ({
  id: row.id,
  revisionType: row.revisionType as EvidenceRevisionType,
  revisionId: row.revisionId,
  rawReference: row.rawReference,
  bookId: row.bookId,
  chapter: row.chapter,
  verseStart: row.verseStart,
  verseEnd: row.verseEnd,
  translation: row.translation,
  verdict: row.verdict as ScriptureVerdict,
  quotedText: row.quotedText,
  sourceText: row.sourceText,
  adapterVersion: row.adapterVersion,
  retrievedAt: row.retrievedAt,
  reviewerDecision: row.reviewerDecision as ScriptureEvidenceRecord['reviewerDecision'],
});

export function createSqlScriptureEvidenceRepository(db: Database): ScriptureEvidenceRepository {
  return {
    async record(revisionType, revisionId, evidence, tx) {
      const exec = asExecutor(db, tx);
      await exec
        .delete(scriptureEvidence)
        .where(
          and(
            eq(scriptureEvidence.revisionType, revisionType),
            eq(scriptureEvidence.revisionId, revisionId),
          ),
        );
      if (evidence.length === 0) return [];
      const rows = await exec
        .insert(scriptureEvidence)
        .values(
          evidence.map((e: NewScriptureEvidence) => ({
            id: nextId(),
            revisionType: e.revisionType,
            revisionId: e.revisionId,
            rawReference: e.rawReference,
            bookId: e.bookId,
            chapter: e.chapter,
            verseStart: e.verseStart,
            verseEnd: e.verseEnd,
            translation: e.translation,
            verdict: e.verdict,
            quotedText: e.quotedText,
            sourceText: e.sourceText,
            adapterVersion: e.adapterVersion,
          })),
        )
        .returning();
      return rows.map(toRecord);
    },

    async listFor(revisionType, revisionId, tx) {
      const exec = asExecutor(db, tx);
      const rows = await exec
        .select()
        .from(scriptureEvidence)
        .where(
          and(
            eq(scriptureEvidence.revisionType, revisionType),
            eq(scriptureEvidence.revisionId, revisionId),
          ),
        );
      return rows.map(toRecord);
    },

    async hasUnresolvedBlocker(revisionType, revisionId, tx) {
      const exec = asExecutor(db, tx);
      const rows = await exec
        .select({ id: scriptureEvidence.id })
        .from(scriptureEvidence)
        .where(
          and(
            eq(scriptureEvidence.revisionType, revisionType),
            eq(scriptureEvidence.revisionId, revisionId),
            or(
              inArray(scriptureEvidence.verdict, ['mismatch', 'not_found']),
              and(
                eq(scriptureEvidence.verdict, 'paraphrase'),
                or(isNull(scriptureEvidence.reviewerDecision), ne(scriptureEvidence.reviewerDecision, 'accepted')),
              ),
            ),
          ),
        )
        .limit(1);
      return rows.length > 0;
    },

    async recordReviewerDecision(evidenceId, decision, tx) {
      const exec = asExecutor(db, tx);
      const [row] = await exec
        .update(scriptureEvidence)
        .set({ reviewerDecision: decision })
        .where(eq(scriptureEvidence.id, evidenceId))
        .returning();
      if (!row) throw new Error(`scripture evidence ${evidenceId} not found`);
      return toRecord(row);
    },
  };
}
