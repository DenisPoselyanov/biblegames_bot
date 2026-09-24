import { describe, expect, it } from 'vitest';
import { createMemoryAuditLog, type AuditActor } from '../../audit';
import { createInMemoryContentRepositories } from '../../domains/content/inMemoryRepository';
import { validateQuestionRevision } from '../../domains/content/revisionValidation';
import type { RevisionDraft } from '../../domains/content/types';
import { createInMemoryLearningRepositories } from '../../domains/learning/inMemoryRepository';
import { createInMemoryScriptureEvidenceRepository } from '../../domains/shared/inMemoryScriptureEvidence';
import { createInMemoryValidationFindingRepository } from '../../domains/shared/inMemoryValidationFindings';
import {
  ContentApprovalBlockedError,
  REVIEW_DECISION_ACTION,
  createContentReviewWorkflow,
} from '../contentReviewWorkflow';

const reviewer: AuditActor = { userId: 'rev-1', authSource: 'development' };

function harness() {
  const content = createInMemoryContentRepositories();
  const learning = createInMemoryLearningRepositories();
  const findings = createInMemoryValidationFindingRepository();
  const scripture = createInMemoryScriptureEvidenceRepository();
  const auditLog = createMemoryAuditLog();
  const workflow = createContentReviewWorkflow({
    content,
    learning,
    gates: { findings, scripture },
    auditLog,
  });
  /** Append + run the real quality checks — approval and publish refuse anything never checked. */
  const append = async (draft: RevisionDraft) => {
    const { revision } = await content.revisions.appendRevision(draft);
    await validateQuestionRevision({ findings }, revision);
    return revision;
  };
  return { content, learning, findings, scripture, auditLog, workflow, append };
}

const questionDraft = {
  questionId: 'q1',
  themeId: 'genesis',
  difficulty: 'youth' as const,
  text: 'Хто збудував ковчег?',
  options: ['Ной', 'Мойсей'],
  correctIndex: 0,
  explanationShort: 'Ной збудував ковчег за Божим наказом перед потопом.',
  reference: 'Бут. 6:14',
  status: 'draft' as const,
};

const blockingFinding = (revisionId: string) => ({
  revisionType: 'question' as const,
  revisionId,
  kind: 'theological_sensitivity',
  severity: 'blocking' as const,
  label: 'Богословська чутливість',
  detail: 'Потрібен рецензент',
});

describe('contentReviewWorkflow.listQueue', () => {
  it('lists drafts across questions and lessons with finding summaries and counts', async () => {
    const { content, learning, findings, workflow } = harness();
    const q = (await content.revisions.appendRevision(questionDraft)).revision;
    await content.revisions.appendRevision({ ...questionDraft, questionId: 'q-legacy', status: undefined });
    const l = (
      await learning.lessonRevisions.appendRevision({
        lessonId: 'lesson-1',
        planId: 'genesis',
        moduleId: 'genesis-sub-1',
        objectiveId: 'genesis-sub-1-sub-1',
        title: 'Створення',
        blocks: [],
        status: 'draft',
      })
    ).revision;
    await findings.record('question', q.id, [blockingFinding(q.id)]);

    const queue = await workflow.listQueue({});
    expect(queue.items.map((i) => i.revisionId).sort()).toEqual([q.id, l.id].sort());
    const qItem = queue.items.find((i) => i.revisionId === q.id)!;
    expect(qItem.findings.blocking).toBe(1);
    expect(qItem.topProblem).toMatchObject({ severity: 'blocking', label: 'Богословська чутливість' });
    expect(qItem.title).toBe('Хто збудував ковчег?');
    expect(queue.items.find((i) => i.revisionId === l.id)?.topProblem).toBeNull();

    expect(queue.counts.question).toMatchObject({ draft: 1, legacy_unreviewed: 1 });
    expect(queue.counts.lesson).toMatchObject({ draft: 1 });

    const onlyLessons = await workflow.listQueue({ type: 'lesson' });
    expect(onlyLessons.items.map((i) => i.revisionType)).toEqual(['lesson']);
    const legacy = await workflow.listQueue({ statuses: ['legacy_unreviewed'] });
    expect(legacy.items.map((i) => i.entityId)).toEqual(['q-legacy']);
  });

  it('shows the standing (latest) decision per revision', async () => {
    const { append, workflow } = harness();
    const q = await append(questionDraft);
    await workflow.decide('question', q.id, 'changes_requested', reviewer, { comment: 'Уточнити пояснення' });
    await workflow.decide('question', q.id, 'approved', reviewer);

    const [item] = (await workflow.listQueue({})).items;
    expect(item.decision).toMatchObject({ decision: 'approved', actorUserId: 'rev-1' });
  });
});

describe('contentReviewWorkflow.getDetail', () => {
  it('diffs against the published revision and reports blockers + history', async () => {
    const { content, findings, workflow } = harness();
    const v1 = (await content.revisions.appendRevision(questionDraft)).revision;
    await content.revisions.publishRevision(v1.id);
    const v2 = (
      await content.revisions.appendRevision({ ...questionDraft, text: 'Хто збудував ковчег із дерева гофер?' })
    ).revision;
    await findings.record('question', v2.id, [blockingFinding(v2.id)]);
    await workflow.decide('question', v2.id, 'changes_requested', reviewer, { comment: 'Перевір формулювання' });

    const detail = await workflow.getDetail('question', v2.id);
    expect(detail?.baseline).toMatchObject({ revisionId: v1.id, status: 'published' });
    expect(detail?.diff.map((d) => d.field)).toEqual(['text']);
    expect(detail?.blockers).toEqual([
      { revisionId: v2.id, reason: 'not_validated' },
      { revisionId: v2.id, reason: 'validation_blocking' },
    ]);
    expect(detail?.history.map((h) => h.action)).toEqual([REVIEW_DECISION_ACTION]);
    expect(detail?.siblings.map((s) => s.revisionNumber)).toEqual([2, 1]);
  });

  it('returns null for an unknown revision and a full diff for a first revision', async () => {
    const { content, workflow } = harness();
    expect(await workflow.getDetail('question', 'nope')).toBeNull();
    const v1 = (await content.revisions.appendRevision(questionDraft)).revision;
    const detail = await workflow.getDetail('question', v1.id);
    expect(detail?.baseline).toBeNull();
    expect(detail?.diff.map((d) => d.field)).toContain('text');
  });
});

describe('contentReviewWorkflow.decide', () => {
  it('refuses to approve while blockers are open, and audits the denial', async () => {
    const { content, findings, auditLog, workflow } = harness();
    const q = (await content.revisions.appendRevision(questionDraft)).revision;
    await findings.record('question', q.id, [blockingFinding(q.id)]);

    await expect(workflow.decide('question', q.id, 'approved', reviewer)).rejects.toThrow(
      ContentApprovalBlockedError,
    );
    const [denied] = await auditLog.query({ action: REVIEW_DECISION_ACTION });
    expect(denied).toMatchObject({ result: 'denied', target: q.id });
    // A denial is not a standing decision.
    expect((await workflow.getDetail('question', q.id))?.item.decision).toBeNull();
  });

  it('requires a comment to request changes', async () => {
    const { content, workflow } = harness();
    const q = (await content.revisions.appendRevision(questionDraft)).revision;
    await expect(workflow.decide('question', q.id, 'changes_requested', reviewer)).rejects.toMatchObject({
      code: 'comment_required',
    });
  });

  it('refuses a decision on a published revision', async () => {
    const { content, workflow } = harness();
    const q = (await content.revisions.appendRevision(questionDraft)).revision;
    await content.revisions.publishRevision(q.id);
    await expect(workflow.decide('question', q.id, 'approved', reviewer)).rejects.toMatchObject({
      code: 'revision_not_reviewable',
    });
  });
});

describe('contentReviewWorkflow.publish', () => {
  it('refuses to approve a revision whose quality checks never ran', async () => {
    const { content, workflow } = harness();
    const q = (await content.revisions.appendRevision(questionDraft)).revision;
    await expect(workflow.decide('question', q.id, 'approved', reviewer)).rejects.toThrow(ContentApprovalBlockedError);
  });

  it('refuses an unapproved revision, then publishes it once approved', async () => {
    const { append, auditLog, workflow } = harness();
    const q = await append(questionDraft);

    await expect(workflow.publish('question', q.id, reviewer)).rejects.toMatchObject({
      code: 'content_not_approved',
    });
    expect((await auditLog.query({ action: 'content.publish_denied' })).length).toBe(1);

    await workflow.decide('question', q.id, 'approved', reviewer);
    const published = await workflow.publish('question', q.id, reviewer);
    expect(published.status).toBe('published');
    expect((await auditLog.query({ action: 'content.publish', target: q.id })).length).toBe(1);
  });

  it('a later changes_requested withdraws the approval', async () => {
    const { append, workflow } = harness();
    const q = await append(questionDraft);
    await workflow.decide('question', q.id, 'approved', reviewer);
    await workflow.decide('question', q.id, 'changes_requested', reviewer, { comment: 'Стоп, помилка' });
    await expect(workflow.publish('question', q.id, reviewer)).rejects.toMatchObject({
      code: 'content_not_approved',
    });
  });
});
