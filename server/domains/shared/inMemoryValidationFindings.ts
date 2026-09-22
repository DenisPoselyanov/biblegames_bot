/**
 * In-memory `ValidationFindingRepository` (Phase 4 WS3 parity peer). For dev
 * fixtures and as the contract-test peer to the SQL adapter. Writes inside a
 * `tx` are rejected — same rule as `content`/`learning`'s in-memory repos (§10).
 */
import type { Transaction } from './context';
import type { ValidationFinding, ValidationRevisionType } from './validationFindings';
import type { ValidationFindingRepository } from './validationFindingsRepository';

function rejectTx(tx?: Transaction): void {
  if (tx) {
    throw new Error('in-memory validation-finding repository does not support transactional writes (§10)');
  }
}

let seq = 0;
const nextId = (): string => `vfind_${(++seq).toString(36).padStart(6, '0')}`;

const key = (revisionType: ValidationRevisionType, revisionId: string): string =>
  `${revisionType}:${revisionId}`;

export function createInMemoryValidationFindingRepository(
  now: () => Date = () => new Date(),
): ValidationFindingRepository {
  const byRevision = new Map<string, ValidationFinding[]>();

  return {
    async record(revisionType, revisionId, findings, tx) {
      rejectTx(tx);
      const rows = findings.map((f) => ({
        ...f,
        id: nextId(),
        checkedAt: now().toISOString(),
      }));
      byRevision.set(key(revisionType, revisionId), rows);
      return rows.map((r) => ({ ...r }));
    },
    async listFor(revisionType, revisionId, tx) {
      rejectTx(tx);
      return (byRevision.get(key(revisionType, revisionId)) ?? []).map((r) => ({ ...r }));
    },
    async hasBlocking(revisionType, revisionId, tx) {
      rejectTx(tx);
      return (byRevision.get(key(revisionType, revisionId)) ?? []).some(
        (r) => r.severity === 'blocking',
      );
    },
  };
}
