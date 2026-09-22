import { describe, expect, it } from 'vitest';
import { createMemoryAuditLog } from '../../audit';
import { createInMemoryScriptureEvidenceRepository } from '../../domains/shared/inMemoryScriptureEvidence';
import { createContentReviewService } from '../contentReviewService';

const actor = { userId: 'reviewer-1', authSource: 'telegram-init-data' };

async function harness() {
  const scripture = createInMemoryScriptureEvidenceRepository();
  const auditLog = createMemoryAuditLog();
  const service = createContentReviewService({ scripture, auditLog });
  const [row] = await scripture.record('question', 'qrev_1', [
    {
      revisionType: 'question',
      revisionId: 'qrev_1',
      rawReference: 'Ів 3:16',
      bookId: 43,
      chapter: 3,
      verseStart: 16,
      verseEnd: 16,
      translation: 'UTT',
      verdict: 'paraphrase',
      quotedText: 'shortened text',
      sourceText: 'full text',
      adapterVersion: 'mock-scripture-v1',
    },
  ]);
  return { scripture, service, auditLog, evidenceId: row!.id };
}

describe('recordScriptureReviewerDecision', () => {
  it('records the decision on the repository and audits it under the calling actor', async () => {
    const { scripture, service, auditLog, evidenceId } = await harness();
    const updated = await service.recordScriptureReviewerDecision(evidenceId, 'accepted', actor, 'req-1');

    expect(updated.reviewerDecision).toBe('accepted');
    expect((await scripture.listFor('question', 'qrev_1'))[0]?.reviewerDecision).toBe('accepted');

    expect(auditLog.records).toHaveLength(1);
    expect(auditLog.records[0]).toMatchObject({
      actor,
      action: 'content.review_decision',
      target: evidenceId,
      result: 'ok',
      requestId: 'req-1',
      metadata: { decision: 'accepted', revisionType: 'question', revisionId: 'qrev_1', verdict: 'paraphrase' },
    });
  });

  it('audits a rejection just as faithfully as an acceptance', async () => {
    const { service, auditLog, evidenceId } = await harness();
    await service.recordScriptureReviewerDecision(evidenceId, 'rejected', actor);
    expect(auditLog.records[0]?.metadata?.decision).toBe('rejected');
  });
});
