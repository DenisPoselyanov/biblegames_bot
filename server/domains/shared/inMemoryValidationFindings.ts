/**
 * In-memory `ValidationFindingRepository` (Phase 4 WS3 parity peer). For dev
 * fixtures and as the contract-test peer to the SQL adapter. Writes inside a
 * `tx` are rejected — same rule as `content`/`learning`'s in-memory repos (§10).
 */
import type { Transaction } from './context';
import {
  compareFindingSummaries,
  type ValidationFinding,
  type ValidationFindingSummary,
  type ValidationRevisionType,
} from './validationFindings';
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
    async summarize(tx) {
      rejectTx(tx);
      const buckets = new Map<string, ValidationFindingSummary>();
      const revisionIds = new Map<string, Set<string>>();
      for (const rows of byRevision.values()) {
        for (const r of rows) {
          const k = `${r.revisionType}\u0000${r.kind}\u0000${r.severity}`;
          const bucket = buckets.get(k) ?? {
            revisionType: r.revisionType,
            kind: r.kind,
            severity: r.severity,
            label: r.label,
            revisions: 0,
          };
          if (r.label < bucket.label) bucket.label = r.label;
          const ids = revisionIds.get(k) ?? new Set<string>();
          ids.add(r.revisionId);
          revisionIds.set(k, ids);
          bucket.revisions = ids.size;
          buckets.set(k, bucket);
        }
      }
      return [...buckets.values()]
        .sort(compareFindingSummaries);
    },
  };
}
