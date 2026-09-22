/**
 * SQL `ValidationFindingRepository` (Phase 4 WS3) — the production adapter for
 * `server/domains/shared/validationFindingsRepository.ts`, on Drizzle.
 */
import { and, eq } from 'drizzle-orm';
import type { Transaction as OpaqueTx } from '../../../domains/shared/context';
import type {
  NewValidationFinding,
  ValidationFinding,
  ValidationRevisionType,
} from '../../../domains/shared/validationFindings';
import type { ValidationFindingRepository } from '../../../domains/shared/validationFindingsRepository';
import type { Database, Transaction } from '../client';
import { contentValidationFindings } from '../schema/validation';

type Executor = Database | Transaction;

function asExecutor(db: Database, tx?: OpaqueTx): Executor {
  return (tx as unknown as Transaction | undefined) ?? db;
}

let seq = 0;
const nextId = (): string =>
  `vfind_${Date.now().toString(36)}${(++seq).toString(36).padStart(3, '0')}`;

type Row = typeof contentValidationFindings.$inferSelect;

const toFinding = (row: Row): ValidationFinding => ({
  id: row.id,
  revisionType: row.revisionType as ValidationRevisionType,
  revisionId: row.revisionId,
  kind: row.kind,
  severity: row.severity as ValidationFinding['severity'],
  label: row.label,
  detail: row.detail,
  checkedAt: row.checkedAt,
});

export function createSqlValidationFindingRepository(db: Database): ValidationFindingRepository {
  return {
    async record(revisionType, revisionId, findings, tx) {
      const exec = asExecutor(db, tx);
      await exec
        .delete(contentValidationFindings)
        .where(
          and(
            eq(contentValidationFindings.revisionType, revisionType),
            eq(contentValidationFindings.revisionId, revisionId),
          ),
        );
      if (findings.length === 0) return [];
      const rows = await exec
        .insert(contentValidationFindings)
        .values(
          findings.map((f: NewValidationFinding) => ({
            id: nextId(),
            revisionType: f.revisionType,
            revisionId: f.revisionId,
            kind: f.kind,
            severity: f.severity,
            label: f.label,
            detail: f.detail,
          })),
        )
        .returning();
      return rows.map(toFinding);
    },

    async listFor(revisionType, revisionId, tx) {
      const exec = asExecutor(db, tx);
      const rows = await exec
        .select()
        .from(contentValidationFindings)
        .where(
          and(
            eq(contentValidationFindings.revisionType, revisionType),
            eq(contentValidationFindings.revisionId, revisionId),
          ),
        );
      return rows.map(toFinding);
    },

    async hasBlocking(revisionType, revisionId, tx) {
      const exec = asExecutor(db, tx);
      const rows = await exec
        .select({ id: contentValidationFindings.id })
        .from(contentValidationFindings)
        .where(
          and(
            eq(contentValidationFindings.revisionType, revisionType),
            eq(contentValidationFindings.revisionId, revisionId),
            eq(contentValidationFindings.severity, 'blocking'),
          ),
        )
        .limit(1);
      return rows.length > 0;
    },
  };
}
