/**
 * In-memory `ScriptureEvidenceRepository` (Phase 4 WS4 parity peer). For dev
 * fixtures and as the contract-test peer to the SQL adapter. Writes inside a
 * `tx` are rejected — same rule as the other in-memory repos (§10).
 */
import type { Transaction } from './context';
import type { EvidenceRevisionType, ScriptureEvidenceRecord } from './scriptureEvidence';
import type { ScriptureEvidenceRepository } from './scriptureEvidenceRepository';

function rejectTx(tx?: Transaction): void {
  if (tx) {
    throw new Error('in-memory scripture-evidence repository does not support transactional writes (§10)');
  }
}

let seq = 0;
const nextId = (): string => `sevid_${(++seq).toString(36).padStart(6, '0')}`;

const key = (revisionType: EvidenceRevisionType, revisionId: string): string =>
  `${revisionType}:${revisionId}`;

export function createInMemoryScriptureEvidenceRepository(
  now: () => Date = () => new Date(),
): ScriptureEvidenceRepository {
  const byRevision = new Map<string, ScriptureEvidenceRecord[]>();
  const byId = new Map<string, ScriptureEvidenceRecord>();

  return {
    async record(revisionType, revisionId, evidence, tx) {
      rejectTx(tx);
      const rows = evidence.map((e) => ({
        ...e,
        id: nextId(),
        retrievedAt: now().toISOString(),
        reviewerDecision: null as ScriptureEvidenceRecord['reviewerDecision'],
      }));
      byRevision.set(key(revisionType, revisionId), rows);
      for (const row of rows) byId.set(row.id, row);
      return rows.map((r) => ({ ...r }));
    },
    async listFor(revisionType, revisionId, tx) {
      rejectTx(tx);
      return (byRevision.get(key(revisionType, revisionId)) ?? []).map((r) => ({ ...r }));
    },
    async hasUnresolvedBlocker(revisionType, revisionId, tx) {
      rejectTx(tx);
      return (byRevision.get(key(revisionType, revisionId)) ?? []).some(
        (r) =>
          r.verdict === 'mismatch' ||
          r.verdict === 'not_found' ||
          (r.verdict === 'paraphrase' && r.reviewerDecision !== 'accepted'),
      );
    },
    async recordReviewerDecision(evidenceId, decision, tx) {
      rejectTx(tx);
      const row = byId.get(evidenceId);
      if (!row) throw new Error(`scripture evidence ${evidenceId} not found`);
      const updated = { ...row, reviewerDecision: decision };
      byId.set(evidenceId, updated);
      const list = byRevision.get(key(updated.revisionType, updated.revisionId));
      if (list) {
        const idx = list.findIndex((r) => r.id === evidenceId);
        if (idx >= 0) list[idx] = updated;
      }
      return { ...updated };
    },
  };
}
