/**
 * Review-decision recording, audited (Phase 4 WS7, spec §7/§14).
 *
 * `ScriptureEvidenceRepository.recordReviewerDecision` (WS4) is a plain
 * repository write with no actor/audit concept — repositories never take an
 * actor (§11's domain rule: a repository speaks domain types only). This
 * service is the thin audited wrapper a future route (WS8) calls instead of
 * the repository directly, the same shape as `contentPublicationService`'s
 * audit sink.
 */
import type { AuditActor, AuditLog } from '../audit';
import { buildAuditRecord } from '../audit';
import type { ScriptureEvidenceRecord } from '../domains/shared/scriptureEvidence';
import type { ScriptureEvidenceRepository } from '../domains/shared/scriptureEvidenceRepository';

export interface ContentReviewService {
  recordScriptureReviewerDecision(
    evidenceId: string,
    decision: 'accepted' | 'rejected',
    actor: AuditActor,
    requestId?: string,
  ): Promise<ScriptureEvidenceRecord>;
}

export function createContentReviewService(deps: {
  scripture: ScriptureEvidenceRepository;
  auditLog: AuditLog;
}): ContentReviewService {
  return {
    async recordScriptureReviewerDecision(evidenceId, decision, actor, requestId) {
      const record = await deps.scripture.recordReviewerDecision(evidenceId, decision);
      await deps.auditLog.append(
        buildAuditRecord({
          actor,
          action: 'content.review_decision',
          target: evidenceId,
          result: 'ok',
          requestId,
          metadata: {
            decision,
            revisionType: record.revisionType,
            revisionId: record.revisionId,
            verdict: record.verdict,
          },
        }),
      );
      return record;
    },
  };
}
