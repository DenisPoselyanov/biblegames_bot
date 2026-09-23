/**
 * `ScriptureEvidenceRepository` (Phase 4 WS4) — interface only; implementations
 * live in `server/infrastructure/database/repositories/scriptureEvidence.ts`
 * (SQL) and `./inMemoryScriptureEvidence.ts` (dev/test parity peer). Both pass
 * `__tests__/scriptureEvidenceRepositoryContract.ts`.
 */
import type { Transaction } from './context';
import type {
  EvidenceRevisionType,
  NewScriptureEvidence,
  ScriptureEvidenceRecord,
} from './scriptureEvidence';

export interface ScriptureEvidenceRepository {
  /** Replace the stored evidence set for one revision with the latest verification run. */
  record(
    revisionType: EvidenceRevisionType,
    revisionId: string,
    evidence: NewScriptureEvidence[],
    tx?: Transaction,
  ): Promise<ScriptureEvidenceRecord[]>;
  listFor(
    revisionType: EvidenceRevisionType,
    revisionId: string,
    tx?: Transaction,
  ): Promise<ScriptureEvidenceRecord[]>;
  /** True when any stored evidence row is `verdict: 'mismatch' | 'not_found'`, or `'paraphrase'` awaiting a reviewer decision (§13.4/§22 — publication is blocked on these). */
  hasUnresolvedBlocker(
    revisionType: EvidenceRevisionType,
    revisionId: string,
    tx?: Transaction,
  ): Promise<boolean>;
  /** A reviewer's explicit call on one evidence row — the only way a `paraphrase` verdict stops blocking. */
  recordReviewerDecision(
    evidenceId: string,
    decision: 'accepted' | 'rejected',
    tx?: Transaction,
  ): Promise<ScriptureEvidenceRecord>;
}
