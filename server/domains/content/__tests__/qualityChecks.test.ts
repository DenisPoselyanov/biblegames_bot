import { describe, expect, it } from 'vitest';
import { computeFirstOptionBias, runQuestionQualityChecks } from '../qualityChecks';
import type { QuestionBody } from '../qualityChecks';

const body = (over: Partial<QuestionBody> = {}): QuestionBody => ({
  questionId: 'q1',
  themeId: 'genesis',
  text: 'Хто збудував ковчег?',
  options: ['Ной', 'Лот', 'Хам'],
  correctIndex: 0,
  explanationShort: 'Ной збудував ковчег за наказом Бога, щоб пережити потоп.',
  explanationDeep: 'Розширене пояснення про будівництво ковчега та причини потопу.',
  ...over,
});

describe('runQuestionQualityChecks — duplicates', () => {
  it('flags an exact duplicate against a sibling as blocking', () => {
    const findings = runQuestionQualityChecks(body(), {
      siblings: [{ questionId: 'q2', text: 'Хто збудував ковчег?', options: ['Ной'] }],
    });
    expect(findings).toContainEqual(
      expect.objectContaining({ kind: 'duplicate_exact', severity: 'blocking' }),
    );
  });

  it('flags a near-duplicate as a warning, not blocking', () => {
    const findings = runQuestionQualityChecks(
      body({ text: 'Хто збудував великий дерев’яний ковчег для порятунку тварин від потопу?' }),
      {
        siblings: [
          {
            questionId: 'q2',
            text: 'Хто збудував великий дерев’яний ковчег для порятунку тварин від жахливого потопу?',
            options: [],
          },
        ],
      },
    );
    expect(findings).toContainEqual(
      expect.objectContaining({ kind: 'duplicate_near', severity: 'warning' }),
    );
  });

  it('ignores a sibling with the same questionId (self-comparison)', () => {
    const findings = runQuestionQualityChecks(body(), {
      siblings: [{ questionId: 'q1', text: 'Хто збудував ковчег?', options: [] }],
    });
    expect(findings.find((f) => f.kind.startsWith('duplicate'))).toBeUndefined();
  });

  it('does not flag an unrelated question', () => {
    const findings = runQuestionQualityChecks(body(), {
      siblings: [{ questionId: 'q2', text: 'Скільки днів тривав потоп?', options: [] }],
    });
    expect(findings.find((f) => f.kind.startsWith('duplicate'))).toBeUndefined();
  });
});

describe('runQuestionQualityChecks — options', () => {
  it('flags repeated option text as blocking', () => {
    const findings = runQuestionQualityChecks(body({ options: ['Ной', 'ной', 'Авраам'] }));
    expect(findings).toContainEqual(
      expect.objectContaining({ kind: 'duplicate_options', severity: 'blocking' }),
    );
  });

  it('flags a correct option markedly longer than the others', () => {
    const findings = runQuestionQualityChecks(
      body({
        options: ['Ной, який отримав від Бога наказ будувати ковчег перед потопом', 'Мойсей', 'Авраам'],
        correctIndex: 0,
      }),
    );
    expect(findings).toContainEqual(expect.objectContaining({ kind: 'option_length_imbalance' }));
  });

  it('does not flag well-balanced options', () => {
    const findings = runQuestionQualityChecks(body({ options: ['Ной', 'Лот', 'Хам'] }));
    expect(findings.find((f) => f.kind === 'option_length_imbalance')).toBeUndefined();
  });
});

describe('runQuestionQualityChecks — answer leakage', () => {
  it('flags when the correct option is quoted verbatim in the question text', () => {
    const findings = runQuestionQualityChecks(
      body({
        text: 'Кому Бог дав обітницю про Авраама, як записано в Букові Буття?',
        options: ['Авраама', 'Мойсея', 'Ісаака'],
        correctIndex: 0,
      }),
    );
    expect(findings).toContainEqual(expect.objectContaining({ kind: 'answer_leakage' }));
  });

  it('does not flag when the wording is short enough to be noise', () => {
    const findings = runQuestionQualityChecks(body({ options: ['Він', 'Вона', 'Вони'], correctIndex: 0 }));
    expect(findings.find((f) => f.kind === 'answer_leakage')).toBeUndefined();
  });
});

describe('runQuestionQualityChecks — explanations', () => {
  it('flags a missing explanationShort', () => {
    const findings = runQuestionQualityChecks(body({ explanationShort: null }));
    expect(findings).toContainEqual(expect.objectContaining({ kind: 'missing_explanation' }));
  });

  it('flags an explanationShort that is present but too short', () => {
    const findings = runQuestionQualityChecks(body({ explanationShort: 'Так.' }));
    expect(findings).toContainEqual(expect.objectContaining({ kind: 'weak_explanation' }));
  });

  it('flags a missing explanationDeep as info, not warning/blocking', () => {
    const findings = runQuestionQualityChecks(body({ explanationDeep: null }));
    expect(findings).toContainEqual(
      expect.objectContaining({ kind: 'missing_deep_explanation', severity: 'info' }),
    );
  });
});

describe('runQuestionQualityChecks — language and topic', () => {
  it('flags a Russian-only letter as a possible mixed-language tell', () => {
    const findings = runQuestionQualityChecks(body({ text: 'Хто збудував ковчег вблизи гор Арарата, объясни?' }));
    expect(findings).toContainEqual(expect.objectContaining({ kind: 'mixed_language' }));
  });

  it('does not flag well-formed Ukrainian text', () => {
    const findings = runQuestionQualityChecks(body());
    expect(findings.find((f) => f.kind === 'mixed_language')).toBeUndefined();
  });

  it('flags an unknown themeId only when knownThemeIds is supplied', () => {
    const withoutContext = runQuestionQualityChecks(body({ themeId: 'nonexistent' }));
    expect(withoutContext.find((f) => f.kind === 'orphan_theme')).toBeUndefined();

    const withContext = runQuestionQualityChecks(body({ themeId: 'nonexistent' }), {
      siblings: [],
      knownThemeIds: ['genesis', 'exodus'],
    });
    expect(withContext).toContainEqual(expect.objectContaining({ kind: 'orphan_theme', severity: 'blocking' }));
  });
});

describe('runQuestionQualityChecks — theological sensitivity', () => {
  it('flags a matched sensitivity category as blocking', () => {
    const findings = runQuestionQualityChecks(
      body({ text: 'Що таке суд божий у Содомі?', explanationShort: 'Опис події детально, більш ніж п’ятнадцять символів.' }),
    );
    expect(findings.some((f) => f.kind.startsWith('sensitivity_'))).toBe(true);
    expect(findings.filter((f) => f.kind.startsWith('sensitivity_')).every((f) => f.severity === 'blocking')).toBe(
      true,
    );
  });

  it('does not flag neutral content', () => {
    const findings = runQuestionQualityChecks(body());
    expect(findings.find((f) => f.kind.startsWith('sensitivity_'))).toBeUndefined();
  });
});

describe('runQuestionQualityChecks — well-formed input', () => {
  it('returns no findings for a clean, unique question', () => {
    expect(runQuestionQualityChecks(body())).toEqual([]);
  });
});

describe('computeFirstOptionBias', () => {
  it('is a batch-level statistic, not a per-question flag', () => {
    const report = computeFirstOptionBias([0, 0, 0, 1, 2]);
    expect(report.sampleSize).toBe(5);
    expect(report.firstOptionCount).toBe(3);
    expect(report.firstOptionRatio).toBeCloseTo(0.6);
    expect(report.flagged).toBe(true);
  });

  it('is not flagged for an even distribution', () => {
    const report = computeFirstOptionBias([0, 1, 2, 3]);
    expect(report.flagged).toBe(false);
  });

  it('handles an empty batch without dividing by zero', () => {
    expect(computeFirstOptionBias([])).toEqual({
      sampleSize: 0,
      firstOptionCount: 0,
      firstOptionRatio: 0,
      flagged: false,
    });
  });
});
