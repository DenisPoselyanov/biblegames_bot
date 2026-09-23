import { describe, expect, it } from 'vitest';
import { createMemoryAuditLog } from '../../audit';
import { createInMemoryContentRepositories } from '../../domains/content/inMemoryRepository';
import { createInMemoryLearningRepositories } from '../../domains/learning/inMemoryRepository';
import { createInMemoryScriptureEvidenceRepository } from '../../domains/shared/inMemoryScriptureEvidence';
import { createInMemoryValidationFindingRepository } from '../../domains/shared/inMemoryValidationFindings';
import {
  ContentPublicationBlockedError,
  createContentPublicationService,
} from '../contentPublicationService';

async function harness() {
  const content = createInMemoryContentRepositories();
  const learning = createInMemoryLearningRepositories();
  const findings = createInMemoryValidationFindingRepository();
  const scripture = createInMemoryScriptureEvidenceRepository();
  const service = createContentPublicationService({ content, learning, gates: { findings, scripture } });
  return { content, learning, findings, scripture, service };
}

const questionDraft = {
  questionId: 'q1',
  themeId: 'genesis',
  difficulty: 'youth' as const,
  text: 'Who built the ark?',
  options: ['Noah', 'Moses'],
  correctIndex: 0,
};

describe('publishQuestionRevision', () => {
  it('publishes a clean revision', async () => {
    const { content, service } = await harness();
    const { revision } = await content.revisions.appendRevision(questionDraft);
    const published = await service.publishQuestionRevision(revision.id);
    expect(published.status).toBe('published');
  });

  it('refuses to publish a revision with a blocking validation finding', async () => {
    const { content, findings, service } = await harness();
    const { revision } = await content.revisions.appendRevision(questionDraft);
    await findings.record('question', revision.id, [
      { revisionType: 'question', revisionId: revision.id, kind: 'duplicate_exact', severity: 'blocking', label: 'x', detail: 'x' },
    ]);

    await expect(service.publishQuestionRevision(revision.id)).rejects.toThrow(ContentPublicationBlockedError);
    expect((await content.revisions.getById(revision.id))?.status).toBe('legacy_unreviewed');
  });

  it('refuses to publish a revision with an unresolved Scripture blocker', async () => {
    const { content, scripture, service } = await harness();
    const { revision } = await content.revisions.appendRevision(questionDraft);
    await scripture.record('question', revision.id, [
      {
        revisionType: 'question',
        revisionId: revision.id,
        rawReference: 'Ів 3:16',
        bookId: 43,
        chapter: 3,
        verseStart: 16,
        verseEnd: 16,
        translation: 'UTT',
        verdict: 'mismatch',
        quotedText: 'wrong text',
        sourceText: 'correct text',
        adapterVersion: 'mock-scripture-v1',
      },
    ]);

    await expect(service.publishQuestionRevision(revision.id)).rejects.toThrow(ContentPublicationBlockedError);
  });

  it('allows publishing once a paraphrase verdict is explicitly accepted by a reviewer', async () => {
    const { content, scripture, service } = await harness();
    const { revision } = await content.revisions.appendRevision(questionDraft);
    const [row] = await scripture.record('question', revision.id, [
      {
        revisionType: 'question',
        revisionId: revision.id,
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
    await expect(service.publishQuestionRevision(revision.id)).rejects.toThrow(ContentPublicationBlockedError);

    await scripture.recordReviewerDecision(row!.id, 'accepted');
    const published = await service.publishQuestionRevision(revision.id);
    expect(published.status).toBe('published');
  });
});

describe('publishQuestionSet / rollbackQuestionSet', () => {
  it('refuses to publish a set when any member revision is blocked — nothing partially publishes', async () => {
    const { content, findings, service } = await harness();
    const a = (await content.revisions.appendRevision({ ...questionDraft, questionId: 'qa' })).revision;
    const b = (await content.revisions.appendRevision({ ...questionDraft, questionId: 'qb', text: 'b?' })).revision;
    await findings.record('question', b.id, [
      { revisionType: 'question', revisionId: b.id, kind: 'duplicate_exact', severity: 'blocking', label: 'x', detail: 'x' },
    ]);

    await expect(
      service.publishQuestionSet({
        setId: 'quiz:genesis',
        kind: 'quiz',
        filter: { themeIds: ['genesis'], difficulty: null, topicNodeId: null, questionIds: [] },
        items: [
          { questionId: 'qa', revisionId: a.id },
          { questionId: 'qb', revisionId: b.id },
        ],
      }),
    ).rejects.toThrow(ContentPublicationBlockedError);

    expect(await content.sets.getLatest('quiz:genesis')).toBeNull();
  });

  it('rollback republishes an older version as the new latest without deleting the superseded one', async () => {
    const { content, service } = await harness();
    const a = (await content.revisions.appendRevision({ ...questionDraft, questionId: 'qa' })).revision;
    const b = (await content.revisions.appendRevision({ ...questionDraft, questionId: 'qb', text: 'b?' })).revision;

    const v1 = await service.publishQuestionSet({
      setId: 'quiz:genesis',
      kind: 'quiz',
      filter: { themeIds: ['genesis'], difficulty: null, topicNodeId: null, questionIds: [] },
      items: [{ questionId: 'qa', revisionId: a.id }],
    });
    const v2 = await service.publishQuestionSet({
      setId: 'quiz:genesis',
      kind: 'quiz',
      filter: { themeIds: ['genesis'], difficulty: null, topicNodeId: null, questionIds: [] },
      items: [
        { questionId: 'qa', revisionId: a.id },
        { questionId: 'qb', revisionId: b.id },
      ],
    });
    expect(v2.version).toBe(2);

    const rolledBack = await service.rollbackQuestionSet('quiz:genesis', v1.version);
    expect(rolledBack.version).toBe(3);
    expect(rolledBack.items.map((i) => i.questionId)).toEqual(['qa']);

    // Nothing was deleted — both prior versions are still readable.
    expect((await content.sets.getVersion('quiz:genesis', 1))?.items.length).toBe(1);
    expect((await content.sets.getVersion('quiz:genesis', 2))?.items.length).toBe(2);
    expect((await content.sets.getLatest('quiz:genesis'))?.version).toBe(3);
  });

  it('rollback to a nonexistent version throws instead of silently no-op-ing', async () => {
    const { service } = await harness();
    await expect(service.rollbackQuestionSet('nope', 1)).rejects.toThrow(/no version/);
  });

  it('rollback does not re-run the publish gate — a rule change after the fact cannot block recovery', async () => {
    const { content, findings, service } = await harness();
    const a = (await content.revisions.appendRevision({ ...questionDraft, questionId: 'qa' })).revision;
    const v1 = await service.publishQuestionSet({
      setId: 'quiz:genesis',
      kind: 'quiz',
      filter: { themeIds: ['genesis'], difficulty: null, topicNodeId: null, questionIds: [] },
      items: [{ questionId: 'qa', revisionId: a.id }],
    });
    await service.publishQuestionSet({
      setId: 'quiz:genesis',
      kind: 'quiz',
      filter: { themeIds: ['genesis'], difficulty: null, topicNodeId: null, questionIds: [] },
      items: [],
    });
    // A finding appears against `a` only after it was already published once.
    await findings.record('question', a.id, [
      { revisionType: 'question', revisionId: a.id, kind: 'duplicate_exact', severity: 'blocking', label: 'x', detail: 'x' },
    ]);

    const rolledBack = await service.rollbackQuestionSet('quiz:genesis', v1.version);
    expect(rolledBack.items.map((i) => i.questionId)).toEqual(['qa']);
  });
});

describe('publishLessonRevision', () => {
  const seedLesson = async (learning: Awaited<ReturnType<typeof harness>>['learning']) => {
    await learning.plans.upsert({ id: 'judges', themeId: 'judges', title: 'Судді' });
    await learning.modules.upsert({ id: 'judges-1', planId: 'judges', title: 'Гедеон', position: 0 });
    await learning.objectives.upsert({ id: 'judges-1-1', planId: 'judges', title: 'Заклик', position: 0 });
    return learning.lessonRevisions.appendRevision({
      lessonId: 'lesson_judges-1-1',
      planId: 'judges',
      moduleId: 'judges-1',
      objectiveId: 'judges-1-1',
      title: 'Заклик Гедеона',
      blocks: [{ id: 'b1', blockType: 'heading', schemaVersion: 1, payload: { text: 'Заклик Гедеона' } }],
    });
  };

  it('publishes a clean lesson revision', async () => {
    const { learning, service } = await harness();
    const { revision } = await seedLesson(learning);
    const published = await service.publishLessonRevision(revision.id);
    expect(published.status).toBe('published');
  });

  it('refuses to publish a lesson revision with a blocking finding', async () => {
    const { learning, findings, service } = await harness();
    const { revision } = await seedLesson(learning);
    await findings.record('lesson', revision.id, [
      { revisionType: 'lesson', revisionId: revision.id, kind: 'empty_lesson', severity: 'blocking', label: 'x', detail: 'x' },
    ]);
    await expect(service.publishLessonRevision(revision.id)).rejects.toThrow(ContentPublicationBlockedError);
  });
});

describe('audit trail (WS7)', () => {
  const actor = { userId: 'reviewer-1', authSource: 'telegram-init-data' };

  async function auditedHarness() {
    const content = createInMemoryContentRepositories();
    const learning = createInMemoryLearningRepositories();
    const findings = createInMemoryValidationFindingRepository();
    const scripture = createInMemoryScriptureEvidenceRepository();
    const auditLog = createMemoryAuditLog();
    const service = createContentPublicationService({
      content,
      learning,
      gates: { findings, scripture },
      audit: { log: auditLog, actor, requestId: 'req-1' },
    });
    return { content, findings, service, auditLog };
  }

  it('logs a successful publish with the calling actor', async () => {
    const { content, service, auditLog } = await auditedHarness();
    const { revision } = await content.revisions.appendRevision(questionDraft);
    await service.publishQuestionRevision(revision.id);

    expect(auditLog.records).toHaveLength(1);
    expect(auditLog.records[0]).toMatchObject({
      actor,
      action: 'content.publish',
      target: revision.id,
      result: 'ok',
      requestId: 'req-1',
    });
  });

  it('logs a denied publish attempt with the blockers, and does not log a success', async () => {
    const { content, findings, service, auditLog } = await auditedHarness();
    const { revision } = await content.revisions.appendRevision(questionDraft);
    await findings.record('question', revision.id, [
      { revisionType: 'question', revisionId: revision.id, kind: 'duplicate_exact', severity: 'blocking', label: 'x', detail: 'x' },
    ]);

    await expect(service.publishQuestionRevision(revision.id)).rejects.toThrow(ContentPublicationBlockedError);

    expect(auditLog.records).toHaveLength(1);
    expect(auditLog.records[0]).toMatchObject({ action: 'content.publish_denied', result: 'denied' });
    expect(auditLog.records[0]?.metadata?.blockers).toEqual([
      { revisionId: revision.id, reason: 'validation_blocking' },
    ]);
  });

  it('logs a rollback distinctly from a publish', async () => {
    const { content, service, auditLog } = await auditedHarness();
    const a = (await content.revisions.appendRevision({ ...questionDraft, questionId: 'qa' })).revision;
    await service.publishQuestionSet({
      setId: 'quiz:genesis',
      kind: 'quiz',
      filter: { themeIds: ['genesis'], difficulty: null, topicNodeId: null, questionIds: [] },
      items: [{ questionId: 'qa', revisionId: a.id }],
    });
    await service.publishQuestionSet({
      setId: 'quiz:genesis',
      kind: 'quiz',
      filter: { themeIds: ['genesis'], difficulty: null, topicNodeId: null, questionIds: [] },
      items: [],
    });
    await service.rollbackQuestionSet('quiz:genesis', 1);

    expect(auditLog.records.map((r) => r.action)).toEqual(['content.publish', 'content.publish', 'content.rollback']);
  });

  it('produces no audit records at all when no audit sink is configured', async () => {
    const { content, service } = await harness();
    const { revision } = await content.revisions.appendRevision(questionDraft);
    // Not throwing is the assertion — an absent `audit` dep must not be a hard dependency.
    await expect(service.publishQuestionRevision(revision.id)).resolves.toMatchObject({ status: 'published' });
  });
});
