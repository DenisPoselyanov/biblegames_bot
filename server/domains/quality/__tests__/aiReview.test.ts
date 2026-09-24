import { describe, expect, it } from 'vitest';
import { ALL_PASS, type AssessmentSubject } from '../../../../src/lib/contentAssessment';
import { AiProviderError } from '../../ai/types';
import { createMockAiProvider } from '../../../infrastructure/ai/mockProvider';
import { createMockScriptureSourceAdapter } from '../../../infrastructure/scripture/mockSourceAdapter';
import { reviewSubject, runAiReview, stricterVerdict, subjectKey } from '../aiReview';
import { buildAiReviewPrompt, fetchReviewPassages } from '../aiReviewPrompt';
import { createInMemoryAssessmentRepository } from '../inMemoryAssessments';

const subject = (over: Partial<AssessmentSubject> = {}): AssessmentSubject => ({
  questionId: 'q1',
  contentHash: 'h1',
  themeId: 'pentateuch',
  difficulty: 'youth',
  topicNodeId: null,
  text: 'Хто збудував ковчег?',
  options: ['Ной', 'Мойсей', 'Аарон', 'Лот'],
  correctIndex: 0,
  explanationShort: 'Бог звелів Ноєві збудувати ковчег.',
  explanationDeep: null,
  reference: 'Буття 6:14',
  ...over,
});

const scripture = createMockScriptureSourceAdapter([
  { bookId: 1, chapter: 6, verse: 14, text: 'Зроби собі ковчега з дерева ґофер.' },
  { bookId: 9, chapter: 17, verse: 4, text: 'І вийшов борець із филистимських таборів, Ґоліят на ім’я.' },
  { bookId: 11, chapter: 17, verse: 4, text: 'І ти будеш пити з потоку, а крукам Я звелів годувати тебе там.' },
]);

const output = (over: Record<string, unknown> = {}) => ({
  criteria: { ...ALL_PASS },
  verdict: 'pass',
  confidence: 0.9,
  suggestedDifficulty: null,
  suggestedThemeId: null,
  suggestedExplanationShort: null,
  suggestedExplanationDeep: null,
  notes: '',
  ...over,
});

describe('AI review prompt', () => {
  it('grounds the prompt in the fetched verse, the theme books and the level', async () => {
    const s = subject();
    const passages = await fetchReviewPassages(s.reference, scripture);
    const prompt = buildAiReviewPrompt(s, passages);
    expect(passages).toEqual([{ cited: 'Буття 6:14', label: 'Буття 6:14', text: '14 Зроби собі ковчега з дерева ґофер.' }]);
    expect(prompt).toContain('Зроби собі ковчега');
    expect(prompt).toContain('← позначена правильною');
    expect(prompt).toContain('Книги теми: Буття–Повторення Закону');
    expect(prompt).toContain('answer_supported');
    expect(prompt).toContain('suggestedThemeId');
  });

  it('fetches both readings of an ambiguous «1 Цар.»', async () => {
    const passages = await fetchReviewPassages('1 Цар. 17:4', scripture);
    expect(passages.map((p) => p.label)).toEqual(['1 Царів 17:4', '1 Самуїлова 17:4']);
    expect(passages.every((p) => p.text)).toBe(true);
  });

  it('keeps unparsed and missing verses visible instead of throwing', async () => {
    const passages = await fetchReviewPassages('Невідома 1:1; Буття 50:99', scripture);
    expect(passages).toEqual([
      { cited: 'Невідома 1:1', label: 'Невідома 1:1', text: null, note: 'посилання не розпізнано' },
      { cited: 'Буття 50:99', label: 'Буття 50:99', text: null },
    ]);
  });
});

describe('reviewSubject', () => {
  it('raises a verdict more lenient than its criteria (fail closed) and records it', async () => {
    const provider = createMockAiProvider();
    provider.enqueue({ text: output({ criteria: { ...ALL_PASS, factual: 'fail' }, verdict: 'pass', notes: 'x'.repeat(900) }) });
    const { assessment } = await reviewSubject(subject(), { provider, scripture });
    expect(assessment.verdict).toBe('reject');
    expect(assessment.meta.verdictAdjusted).toEqual({ from: 'pass', to: 'reject' });
    expect(assessment.notes).toHaveLength(400);
    expect(assessment.assessor).toBe('mock:mock-model');
    expect(assessment.risk).toBeGreaterThanOrEqual(100);
  });

  it('keeps a stricter verdict than implied, and drops unknown or no-op suggestions', async () => {
    const provider = createMockAiProvider();
    provider.enqueue({
      text: output({
        criteria: { ...ALL_PASS, topic_fit: 'fail' },
        verdict: 'repair',
        confidence: 7,
        suggestedThemeId: 'no-such-theme',
        suggestedDifficulty: 'youth',
      }),
    });
    const { assessment } = await reviewSubject(subject(), { provider, scripture });
    expect(assessment.verdict).toBe('repair');
    expect(assessment.meta.verdictAdjusted).toBeUndefined();
    expect(assessment.confidence).toBe(1);
    expect(assessment.suggestedThemeId).toBeNull();
    expect(assessment.suggestedDifficulty).toBeNull();
  });

  it('records the verse evidence and the prompt version', async () => {
    const provider = createMockAiProvider();
    provider.enqueue({ text: output({ suggestedThemeId: 'gospels', criteria: { ...ALL_PASS, topic_fit: 'fail' }, verdict: 'reclassify' }) });
    const { assessment } = await reviewSubject(subject(), { provider, scripture });
    expect(assessment.suggestedThemeId).toBe('gospels');
    expect(assessment.meta).toMatchObject({
      promptVersion: 'question.review.v1',
      scriptureSource: 'mock-scripture-v1',
      passages: [{ label: 'Буття 6:14', found: true }],
    });
  });
});

describe('runAiReview', () => {
  const subjects = ['q1', 'q2', 'q3'].map((id) => subject({ questionId: id, contentHash: `h-${id}` }));

  it('stores each verdict, skips already-reviewed keys and retries retryable errors', async () => {
    const repo = createInMemoryAssessmentRepository();
    const provider = createMockAiProvider();
    provider.enqueue(
      { throw: new AiProviderError('slow down', { kind: 'rate_limited', retryable: true, retryAfterMs: 1 }) },
      { text: output() },
      { text: output({ criteria: { ...ALL_PASS, language: 'fail' }, verdict: 'repair' }) },
    );
    const summary = await runAiReview({
      subjects,
      repo,
      deps: { provider, scripture },
      skipKeys: new Set([subjectKey(subjects[0])]),
      concurrency: 1,
      sleep: async () => {},
    });
    expect(summary).toMatchObject({ total: 3, skipped: 1, reviewed: 2, failed: 0, stopReason: 'done', byVerdict: { pass: 1, repair: 1 } });
    expect((await repo.latestAi()).map((a) => a.questionId).sort()).toEqual(['q2', 'q3']);
  });

  it('counts a schema miss as a failure and moves on', async () => {
    const repo = createInMemoryAssessmentRepository();
    const provider = createMockAiProvider();
    provider.enqueue({ text: { verdict: 'maybe' } }, { text: output() }, { text: output() });
    const summary = await runAiReview({ subjects, repo, deps: { provider, scripture }, concurrency: 1 });
    expect(summary.reviewed).toBe(2);
    expect(summary.failed).toBe(1);
    expect(summary.failures[0].questionId).toBe('q1');
  });

  it('stops on an auth error and on the budget', async () => {
    const provider = createMockAiProvider();
    provider.enqueue({ throw: new AiProviderError('bad key', { kind: 'auth', retryable: false }) });
    const auth = await runAiReview({ subjects, repo: createInMemoryAssessmentRepository(), deps: { provider, scripture }, concurrency: 1 });
    expect(auth.stopReason).toBe('auth');
    expect(auth.reviewed).toBe(0);

    const provider2 = createMockAiProvider();
    provider2.enqueue({ text: output() }, { text: output() }, { text: output() });
    const budget = await runAiReview({
      subjects,
      repo: createInMemoryAssessmentRepository(),
      deps: { provider: provider2, scripture },
      maxRequests: 2,
      concurrency: 1,
    });
    expect(budget).toMatchObject({ reviewed: 2, stopReason: 'budget' });
  });

  it('orders verdicts by severity', () => {
    expect(stricterVerdict('pass', 'repair')).toBe('repair');
    expect(stricterVerdict('reject', 'reclassify')).toBe('reject');
  });
});
