/**
 * Shared `AssessmentRepository` contract (content quality gate). Run against
 * the SQL adapter (pglite) and the in-memory peer.
 */
import { expect, it } from 'vitest';
import {
  ASSESSMENT_RUBRIC_VERSION,
  assessmentRisk,
  type AssessmentCriteria,
  type AssessmentVerdict,
} from '../../../../src/lib/contentAssessment';
import type { AssessmentRepository, NewAssessment } from '../assessment';

const PASS: AssessmentCriteria = {
  answer_supported: 'pass',
  single_correct: 'pass',
  factual: 'pass',
  distractors: 'pass',
  topic_fit: 'pass',
  level_fit: 'pass',
  explanation_fit: 'pass',
  language: 'pass',
};

export function assessment(over: Partial<NewAssessment> & { verdict?: AssessmentVerdict } = {}): NewAssessment {
  const questionId = over.questionId ?? 'q1';
  const verdict = over.verdict ?? 'repair';
  const criteria = over.criteria ?? { ...PASS, explanation_fit: verdict === 'pass' ? 'pass' : 'fail' };
  const confidence = over.confidence ?? 0.8;
  return {
    questionId,
    contentHash: over.contentHash ?? `h-${questionId}`,
    source: over.source ?? 'ai',
    assessor: over.assessor ?? 'mock:model',
    rubricVersion: over.rubricVersion ?? ASSESSMENT_RUBRIC_VERSION,
    verdict,
    criteria,
    suggestedDifficulty: over.suggestedDifficulty ?? null,
    suggestedTopicNodeId: over.suggestedTopicNodeId ?? null,
    suggestedExplanationShort: over.suggestedExplanationShort ?? null,
    suggestedExplanationDeep: over.suggestedExplanationDeep ?? null,
    notes: over.notes ?? null,
    confidence,
    risk: over.risk ?? assessmentRisk({ verdict, criteria, confidence }),
    subject: over.subject ?? {
      questionId,
      contentHash: `h-${questionId}`,
      themeId: 'pentateuch',
      difficulty: 'youth',
      topicNodeId: null,
      text: 'Хто збудував ковчег?',
      options: ['Ной', 'Мойсей', 'Аарон', 'Лот'],
      correctIndex: 0,
      explanationShort: 'Ной збудував ковчег.',
      explanationDeep: null,
      reference: 'Бут. 6:14',
    },
    meta: over.meta ?? { provider: 'mock' },
  };
}

export function runAssessmentRepositoryContract(make: () => Promise<{ repo: AssessmentRepository; reset: () => Promise<void> }>): void {
  const setup = async () => {
    const h = await make();
    await h.reset();
    return h.repo;
  };

  it('keeps one golden label per question — relabelling replaces it', async () => {
    const repo = await setup();
    const first = await repo.upsertGolden(assessment({ source: 'golden', assessor: 'owner', verdict: 'pass' }));
    const second = await repo.upsertGolden(
      assessment({ source: 'golden', assessor: 'owner', verdict: 'reject', notes: 'вигадка' }),
    );
    expect(second.id).toBe(first.id);
    const golden = await repo.listGolden();
    expect(golden).toHaveLength(1);
    expect(golden[0]).toMatchObject({ source: 'golden', verdict: 'reject', notes: 'вигадка' });
    // golden labels never show up as AI verdicts
    expect(await repo.latestAi()).toEqual([]);
  });

  it('keeps AI history and serves the newest assessment per question', async () => {
    const repo = await setup();
    await repo.addAi(assessment({ verdict: 'reject' }));
    const newer = await repo.addAi(assessment({ verdict: 'pass', criteria: PASS }));
    await repo.addAi(assessment({ questionId: 'q2', verdict: 'repair' }));
    const latest = await repo.latestAi();
    expect(latest.map((a) => [a.questionId, a.verdict])).toEqual([
      ['q1', 'pass'],
      ['q2', 'repair'],
    ]);
    expect(latest[0].id).toBe(newer.id);
    expect((await repo.latestAi({ questionIds: ['q2'] })).map((a) => a.questionId)).toEqual(['q2']);
    expect(await repo.aiKeys(ASSESSMENT_RUBRIC_VERSION)).toEqual(new Set(['q1:h-q1', 'q2:h-q2']));
    expect(await repo.aiKeys('assessment@0')).toEqual(new Set());
  });

  it('orders the queue by risk, hides passes and decided items by default', async () => {
    const repo = await setup();
    await repo.addAi(assessment({ questionId: 'low', verdict: 'reclassify', risk: 40 }));
    const top = await repo.addAi(assessment({ questionId: 'top', verdict: 'reject', risk: 150 }));
    await repo.addAi(assessment({ questionId: 'mid', verdict: 'repair', risk: 80 }));
    await repo.addAi(assessment({ questionId: 'ok', verdict: 'pass', criteria: PASS, risk: 5 }));

    const q = await repo.queue();
    expect(q.items.map((a) => a.questionId)).toEqual(['top', 'mid', 'low']);
    expect(q.total).toBe(3);
    expect((await repo.queue({ limit: 1, offset: 1 })).items.map((a) => a.questionId)).toEqual(['mid']);
    expect((await repo.queue({ verdicts: ['pass'] })).items.map((a) => a.questionId)).toEqual(['ok']);
    expect((await repo.queue({ themeId: 'nope' })).total).toBe(0);

    expect(await repo.decide({ ids: [top.id], decision: 'accepted', decidedBy: 'owner', note: 'так' })).toBe(1);
    expect((await repo.queue()).items.map((a) => a.questionId)).toEqual(['mid', 'low']);
    const decided = await repo.queue({ decided: 'decided' });
    expect(decided.items[0]).toMatchObject({ questionId: 'top', decision: 'accepted', decidedBy: 'owner', decisionNote: 'так' });
    expect(decided.items[0].decidedAt).toEqual(expect.any(String));
  });

  it('tracks decisions until they are applied to the bank', async () => {
    const repo = await setup();
    const a = await repo.addAi(assessment({ questionId: 'a', verdict: 'reclassify', suggestedDifficulty: 'teacher' }));
    const b = await repo.addAi(assessment({ questionId: 'b', verdict: 'reject' }));
    const c = await repo.addAi(assessment({ questionId: 'c', verdict: 'repair' }));
    await repo.decide({ ids: [a.id], decision: 'overridden', decidedBy: 'owner', patch: { difficulty: 'preacher' } });
    await repo.decide({ ids: [b.id], decision: 'accepted', decidedBy: 'owner', patch: { exclude: true } });
    await repo.decide({ ids: [c.id], decision: 'dismissed', decidedBy: 'owner' });

    const pending = await repo.queue({ decided: 'decided', unappliedOnly: true });
    expect(pending.items.map((x) => x.questionId).sort()).toEqual(['a', 'b']);
    expect(pending.items.find((x) => x.questionId === 'a')?.decisionPatch).toEqual({ difficulty: 'preacher' });

    let summary = await repo.summary();
    expect(summary.ai).toMatchObject({ total: 3, undecided: 0, decidedUnapplied: 2 });
    expect(summary.ai.byVerdict).toMatchObject({ reclassify: 1, reject: 1, repair: 1 });

    expect(await repo.markApplied([a.id, b.id], '2026-09-24T10:00:00.000Z')).toBe(2);
    expect((await repo.queue({ decided: 'decided', unappliedOnly: true })).total).toBe(0);
    summary = await repo.summary();
    expect(summary.ai.decidedUnapplied).toBe(0);
    expect((await repo.getById(a.id))?.appliedAt).toBe('2026-09-24T10:00:00.000Z');
  });

  it('never records a decision on a golden label', async () => {
    const repo = await setup();
    const g = await repo.upsertGolden(assessment({ source: 'golden', assessor: 'owner' }));
    expect(await repo.decide({ ids: [g.id], decision: 'accepted', decidedBy: 'owner' })).toBe(0);
    expect(await repo.decide({ ids: [], decision: 'accepted', decidedBy: 'owner' })).toBe(0);
    expect((await repo.summary()).golden.total).toBe(1);
  });

  it('round-trips the subject snapshot, suggestions and meta', async () => {
    const repo = await setup();
    const saved = await repo.addAi(
      assessment({
        verdict: 'repair',
        suggestedExplanationShort: 'Нове коротке.',
        suggestedExplanationDeep: 'Нове розширене.',
        suggestedTopicNodeId: 'genesis-flood',
        meta: { provider: 'gemini', verse: { text: 'Зроби собі ковчега' } },
      }),
    );
    const read = await repo.getById(saved.id);
    expect(read).toMatchObject({
      suggestedExplanationShort: 'Нове коротке.',
      suggestedExplanationDeep: 'Нове розширене.',
      suggestedTopicNodeId: 'genesis-flood',
      meta: { provider: 'gemini', verse: { text: 'Зроби собі ковчега' } },
      subject: { options: ['Ной', 'Мойсей', 'Аарон', 'Лот'], correctIndex: 0 },
      confidence: 0.8,
    });
    expect(await repo.getById('nope')).toBeNull();
  });
}
