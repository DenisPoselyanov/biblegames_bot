import { describe, expect, it } from 'vitest';
import { ALL_PASS, type AssessmentVerdict } from '../../../../src/lib/contentAssessment';
import type { AssessmentDecision } from '../../../../src/lib/contentAssessment';
import type { AssessmentPatch, QuestionAssessment } from '../assessment';
import { acceptedPatch, effectivePatch, planReviewApplication } from '../reviewDecisions';

function ai(
  questionId: string,
  verdict: AssessmentVerdict,
  decision: AssessmentDecision | null,
  over: Partial<QuestionAssessment> = {},
): QuestionAssessment {
  return {
    id: `a-${questionId}`,
    questionId,
    contentHash: `h-${questionId}`,
    source: 'ai',
    assessor: 'mock:model',
    rubricVersion: 'assessment@1',
    verdict,
    criteria: { ...ALL_PASS },
    suggestedDifficulty: null,
    suggestedThemeId: null,
    suggestedTopicNodeId: null,
    suggestedExplanationShort: null,
    suggestedExplanationDeep: null,
    notes: null,
    confidence: 0.8,
    risk: 50,
    subject: {} as QuestionAssessment['subject'],
    meta: {},
    decision,
    decisionNote: null,
    decisionPatch: null,
    decidedBy: decision ? 'owner' : null,
    decidedAt: decision ? '2026-09-24T00:00:00.000Z' : null,
    appliedAt: null,
    createdAt: '2026-09-24T00:00:00.000Z',
    updatedAt: '2026-09-24T00:00:00.000Z',
    ...over,
  };
}

describe('review decisions', () => {
  it('accepting a verdict applies what the AI suggested', () => {
    expect(acceptedPatch(ai('q', 'reject', 'accepted'))).toEqual({ exclude: true });
    expect(
      acceptedPatch(ai('q', 'reclassify', 'accepted', { suggestedDifficulty: 'child', suggestedThemeId: 'gospels' })),
    ).toEqual({ difficulty: 'child', themeId: 'gospels' });
    expect(acceptedPatch(ai('q', 'repair', 'accepted', { suggestedExplanationShort: 'Нове.' }))).toEqual({
      explanationShort: 'Нове.',
    });
    expect(acceptedPatch(ai('q', 'repair', 'accepted'))).toBeNull();
    expect(acceptedPatch(ai('q', 'pass', 'accepted'))).toBeNull();
  });

  it('an override uses the reviewer patch; a dismissal changes nothing', () => {
    const patch: AssessmentPatch = { difficulty: 'teacher' };
    expect(effectivePatch(ai('q', 'reject', 'overridden', { decisionPatch: patch }))).toEqual(patch);
    expect(effectivePatch(ai('q', 'reject', 'dismissed'))).toBeNull();
    expect(effectivePatch(ai('q', 'reject', null))).toBeNull();
  });

  it('plans exclusions and overrides, skipping stale and vanished questions', () => {
    const plan = planReviewApplication(
      [
        ai('q1', 'reject', 'accepted'),
        ai('q2', 'reclassify', 'accepted', { suggestedDifficulty: 'youth' }),
        ai('q3', 'repair', 'overridden', { decisionPatch: { explanationDeep: 'Глибше.' } }),
        ai('q4', 'reject', 'accepted'),
        ai('q5', 'reject', 'accepted'),
        ai('q6', 'repair', 'accepted'),
        ai('q7', 'reject', 'dismissed'),
        ai('q8', 'reject', 'accepted', { appliedAt: '2026-09-24T01:00:00.000Z' }),
      ],
      (id) => (id === 'q4' ? 'changed' : id === 'q5' ? null : `h-${id}`),
    );
    expect(plan.exclude).toEqual(['q1']);
    expect(plan.overrides).toEqual({ q2: { difficulty: 'youth' }, q3: { explanationDeep: 'Глибше.' } });
    expect(plan.applied).toEqual(['a-q1', 'a-q2', 'a-q3', 'a-q6']);
    expect(plan.changed).toEqual(['a-q1', 'a-q2', 'a-q3']);
    expect(plan.skipped).toEqual([
      { id: 'a-q4', questionId: 'q4', reason: 'stale' },
      { id: 'a-q5', questionId: 'q5', reason: 'not_in_bank' },
    ]);
  });
});
