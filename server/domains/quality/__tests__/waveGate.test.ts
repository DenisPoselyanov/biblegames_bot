import { describe, expect, it } from 'vitest';
import { ALL_PASS, type AssessmentVerdict } from '../../../../src/lib/contentAssessment';
import type { QuestionAssessment } from '../assessment';
import { gateWave, isEffectiveReject } from '../waveGate';

const ai = (questionId: string, verdict: AssessmentVerdict, over: Partial<QuestionAssessment> = {}): QuestionAssessment =>
  ({
    id: `a-${questionId}`,
    questionId,
    contentHash: `h-${questionId}`,
    source: 'ai',
    rubricVersion: 'assessment@1',
    verdict,
    criteria: { ...ALL_PASS },
    decision: null,
    decisionPatch: null,
    ...over,
  }) as QuestionAssessment;

const items = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'].map((q) => ({ questionId: q, contentHash: `h-${q}` }));

describe('wave gate', () => {
  const latest = [
    ai('q1', 'pass'),
    ai('q2', 'reject'),
    ai('q3', 'reject', { decision: 'dismissed' }),
    ai('q4', 'repair', { contentHash: 'older-body' }),
    ai('q5', 'reclassify', { rubricVersion: 'assessment@0' }),
  ];

  it('admits reviewed questions, drops AI rejects, holds back the unreviewed', () => {
    const r = gateWave(items, latest);
    expect(r.admit).toEqual(['q1', 'q3']);
    expect(r.rejected).toEqual(['q2']);
    expect(r.unreviewed).toEqual(['q4', 'q5', 'q6']);
    expect(r.verdicts).toEqual({ q1: 'pass', q3: 'reject' });
    expect(r.byVerdict).toEqual({ pass: 1, reject: 2 });
  });

  it('lets the unreviewed through only when asked', () => {
    expect(gateWave(items, latest, { allowUnreviewed: true }).admit).toEqual(['q1', 'q3', 'q4', 'q5', 'q6']);
  });

  it('a reviewer override keeps a rejected question unless it excludes it', () => {
    expect(isEffectiveReject(ai('q', 'reject', { decision: 'overridden', decisionPatch: { difficulty: 'teacher' } }))).toBe(false);
    expect(isEffectiveReject(ai('q', 'reject', { decision: 'overridden', decisionPatch: { exclude: true } }))).toBe(true);
    expect(isEffectiveReject(ai('q', 'reject', { decision: 'accepted' }))).toBe(true);
  });
});
