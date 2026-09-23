import { describe, expect, it } from 'vitest';
import { analyzeAccuracy, bandOf, positionBias } from '../analytics';
import { buildRepairPrompt } from '../repairPrompt';
import type { QuestionRevisionRecord } from '../../content/types';

describe('quality analytics (Phase 4 WS9)', () => {
  it('bands both tails as bad', () => {
    expect(bandOf(0.18)).toBe('too_hard');
    expect(bandOf(0.5)).toBe('hard');
    expect(bandOf(0.75)).toBe('normal');
    expect(bandOf(0.9)).toBe('easy');
    expect(bandOf(0.97)).toBe('too_easy');
    expect(bandOf(1)).toBe('too_easy');
  });

  it('ignores thin evidence, counts the distribution, ranks outliers by distance × evidence', () => {
    const result = analyzeAccuracy(
      [
        { questionId: 'noise', attempts: 5, correct: 0 },
        { questionId: 'ok', attempts: 100, correct: 75 },
        { questionId: 'hard-a-bit', attempts: 40, correct: 14 },
        { questionId: 'very-hard', attempts: 200, correct: 20 },
        { questionId: 'trivial', attempts: 50, correct: 50 },
      ],
      20,
    );
    expect(result.sampleSize).toBe(4);
    expect(result.distribution.find((d) => d.band === 'too_hard')?.count).toBe(2);
    expect(result.distribution.find((d) => d.band === 'normal')?.count).toBe(1);
    expect(result.outliers.map((o) => o.questionId)).toEqual(['very-hard', 'trivial', 'hard-a-bit']);
    expect(result.outliers[0]).toMatchObject({ issue: 'too_hard', accuracy: 0.1, attempts: 200 });
  });

  it('measures first-option share against the no-bias expectation', () => {
    const bias = positionBias([
      { revisionId: 'r1', questionId: 'q1', optionIndex: 0, optionCount: 4, picks: 60 },
      { revisionId: 'r1', questionId: 'q1', optionIndex: 1, optionCount: 4, picks: 20 },
      { revisionId: 'r2', questionId: 'q2', optionIndex: 0, optionCount: 2, picks: 10 },
      { revisionId: 'r2', questionId: 'q2', optionIndex: 1, optionCount: 2, picks: 10 },
    ]);
    expect(bias.picks).toBe(100);
    expect(bias.firstOptionShare).toBeCloseTo(0.7);
    expect(bias.expectedShare).toBeCloseTo((80 / 4 + 20 / 2) / 100);
    expect(bias.byPosition).toEqual([0.7, 0.3]);
    expect(positionBias([])).toMatchObject({ picks: 0, firstOptionShare: 0, expectedShare: 0 });
  });

  it('builds a repair prompt carrying the question, the key and the signal', () => {
    const revision = {
      text: 'Хто збудував ковчег?',
      options: ['Ной', 'Мойсей'],
      correctIndex: 0,
      explanationShort: 'Бут 6',
      reference: 'Бут 6:14',
    } as QuestionRevisionRecord;
    const accuracy = buildRepairPrompt(revision, { kind: 'accuracy', issue: 'too_easy', accuracy: 0.98, attempts: 300 });
    expect(accuracy).toContain('1. Ной (правильна)');
    expect(accuracy).toContain('98% із 300');
    const reports = buildRepairPrompt(revision, {
      kind: 'reports',
      categories: { wrong_answer: 2 },
      comments: ['Мойсей теж будував'],
    });
    expect(reports).toContain('неправильна відповідь (2)');
    expect(reports).toContain('«Мойсей теж будував»');
  });
});
