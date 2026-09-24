import { describe, expect, it } from 'vitest';
import { ALL_PASS, type AssessmentCriteria, type AssessmentVerdict } from '../../../../src/lib/contentAssessment';
import type { QuestionAssessment } from '../assessment';
import { calibrate } from '../calibration';

let seq = 0;
function a(
  source: 'golden' | 'ai',
  questionId: string,
  verdict: AssessmentVerdict,
  criteria: Partial<AssessmentCriteria> = {},
  over: Partial<QuestionAssessment> = {},
): QuestionAssessment {
  seq += 1;
  return {
    id: `a${seq}`,
    questionId,
    contentHash: `h-${questionId}`,
    source,
    assessor: source === 'golden' ? 'owner' : 'mock:model',
    rubricVersion: 'assessment@1',
    verdict,
    criteria: { ...ALL_PASS, ...criteria },
    suggestedDifficulty: null,
    suggestedThemeId: null,
    suggestedTopicNodeId: null,
    suggestedExplanationShort: null,
    suggestedExplanationDeep: null,
    notes: null,
    confidence: source === 'ai' ? 0.8 : null,
    risk: 0,
    subject: {
      questionId,
      contentHash: `h-${questionId}`,
      themeId: 'pentateuch',
      difficulty: 'youth',
      topicNodeId: null,
      text: `Питання ${questionId}?`,
      options: ['А', 'Б'],
      correctIndex: 0,
      explanationShort: null,
      explanationDeep: null,
      reference: null,
    },
    meta: {},
    decision: null,
    decisionNote: null,
    decisionPatch: null,
    decidedBy: null,
    decidedAt: null,
    appliedAt: null,
    createdAt: '2026-09-24T00:00:00.000Z',
    updatedAt: '2026-09-24T00:00:00.000Z',
    ...over,
  };
}

describe('calibrate', () => {
  it('scores verdicts, criteria and the confusion matrix on same-body pairs only', () => {
    const golden = [
      a('golden', 'q1', 'reject', { factual: 'fail' }),
      a('golden', 'q2', 'reject', { answer_supported: 'fail' }),
      a('golden', 'q3', 'pass'),
      a('golden', 'q4', 'repair', { language: 'fail' }),
      a('golden', 'q5', 'pass'),
    ];
    const ai = [
      a('ai', 'q1', 'reject', { factual: 'fail' }),
      a('ai', 'q2', 'pass', {}, { confidence: 0.4 }),
      a('ai', 'q3', 'pass'),
      a('ai', 'q4', 'repair', { language: 'fail' }),
      // Different body — not a pair.
      a('ai', 'q5', 'pass', {}, { contentHash: 'other' }),
    ];
    const r = calibrate(golden, ai, { minPairs: 1, rejectRecall: 0.9, verdictAgreement: 0.75 });
    expect(r.pairs).toBe(4);
    expect(r.missingAi).toBe(1);
    expect(r.verdictAgreement).toBe(0.75);
    expect(r.confusion.reject).toMatchObject({ reject: 1, pass: 1 });
    expect(r.byVerdict.reject).toMatchObject({ golden: 2, ai: 1, both: 1, precision: 1, recall: 0.5 });
    expect(r.flagRecall).toBeCloseTo(2 / 3);
    expect(r.byCriterion.answer_supported).toMatchObject({ goldenFails: 1, caught: 0, failRecall: 0 });
    expect(r.byCriterion.language).toMatchObject({ goldenFails: 1, caught: 1, agreement: 1 });
    expect(r.confidence.agreed).toBeCloseTo(0.8);
    expect(r.confidence.disagreed).toBeCloseTo(0.4);
    expect(r.trusted).toBe(false);
    expect(r.gateFailures).toEqual(['AI ловить 50% відхилень, потрібно ≥ 90%']);
    expect(r.disagreements[0]).toMatchObject({ questionId: 'q2', golden: 'reject', ai: 'pass', criteria: { answer_supported: ['fail', 'pass'] } });
  });

  it('is trusted only with enough pairs, a measurable reject recall and agreement', () => {
    expect(calibrate([], []).gateFailures).toEqual([
      'замало пар: 0 з потрібних 100',
      'в еталоні немає жодного «Відхилити» — повноту відхилень не виміряти',
    ]);
    const golden = Array.from({ length: 100 }, (_, i) => a('golden', `q${i}`, i < 20 ? 'reject' : 'pass'));
    const ai = Array.from({ length: 100 }, (_, i) => a('ai', `q${i}`, i < 19 ? 'reject' : i < 25 ? 'repair' : 'pass'));
    const r = calibrate(golden, ai);
    expect(r.byVerdict.reject.recall).toBe(0.95);
    expect(r.verdictAgreement).toBe(0.94);
    expect(r.trusted).toBe(true);
  });
});
