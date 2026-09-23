import { describe, expect, it } from 'vitest';
import { computeAnswerPositionBias, runQuestionQualityChecks } from '../qualityChecks';
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

describe('runQuestionQualityChecks — explanations fit the level (contentLevelRubric)', () => {
  const deep400 = 'Контекст. '.repeat(40);

  it('requires explanationDeep from «Проповідник» up (warning), not below (info)', () => {
    expect(runQuestionQualityChecks(body({ difficulty: 'preacher', explanationDeep: null }))).toContainEqual(
      expect.objectContaining({ kind: 'missing_deep_explanation', severity: 'warning' }),
    );
    expect(runQuestionQualityChecks(body({ difficulty: 'child', explanationDeep: null }))).toContainEqual(
      expect.objectContaining({ kind: 'missing_deep_explanation', severity: 'info' }),
    );
  });

  it('flags a short explanation that is too long for «Немовля»', () => {
    const long = 'Ной збудував ковчег за наказом Бога. '.repeat(6);
    expect(runQuestionQualityChecks(body({ difficulty: 'baby', explanationShort: long }))).toContainEqual(
      expect.objectContaining({ kind: 'explanation_length_for_level', severity: 'warning' }),
    );
  });

  it('flags a deep explanation that is too thin for «Богослов»', () => {
    expect(
      runQuestionQualityChecks(body({ difficulty: 'theologian', explanationDeep: 'Коротко про контекст ковчега.' })),
    ).toContainEqual(expect.objectContaining({ kind: 'deep_explanation_length_for_level' }));
  });

  it('accepts level-appropriate explanations', () => {
    const findings = runQuestionQualityChecks(
      body({
        difficulty: 'teacher',
        explanationShort: 'Ной збудував ковчег за наказом Бога, щоб він і його родина пережили потоп (Бут. 6:14).',
        explanationDeep: deep400,
      }),
    );
    expect(findings.filter((f) => f.kind.includes('explanation'))).toEqual([]);
  });

  it('skips the per-level checks when the level is unknown', () => {
    expect(runQuestionQualityChecks(body({ explanationShort: 'Ной. '.repeat(80) }))).not.toContainEqual(
      expect.objectContaining({ kind: 'explanation_length_for_level' }),
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

describe('runQuestionQualityChecks — Scripture reference (quality gate L1)', () => {
  const ref = (over: Partial<QuestionBody>) => runQuestionQualityChecks(body({ themeId: 'pentateuch', ...over }));
  const kinds = (over: Partial<QuestionBody>) => ref(over).map((f) => f.kind);

  it('skips the reference checks when the caller carries no reference field', () => {
    expect(kinds({}).some((k) => k.includes('reference') || k === 'theme_canon_mismatch')).toBe(false);
  });

  it('blocks a question with no reference — the fact cannot be checked', () => {
    expect(ref({ reference: null })).toContainEqual(expect.objectContaining({ kind: 'missing_reference', severity: 'blocking' }));
    expect(ref({ reference: '  ' })).toContainEqual(expect.objectContaining({ kind: 'missing_reference', severity: 'blocking' }));
  });

  it('blocks a reference that is not a Bible book', () => {
    expect(ref({ reference: 'Медична енциклопедія, с. 12' })).toContainEqual(
      expect.objectContaining({ kind: 'reference_unparsed', severity: 'blocking' }),
    );
  });

  it("accepts a reference to one of the theme's own books", () => {
    expect(kinds({ reference: 'Бут. 6:14' })).toEqual([]);
    expect(kinds({ reference: 'Повт. зак. 5:7' })).toEqual([]);
  });

  it('flags a book outside the theme — the Pentecost of Acts 2 filed under the Pentateuch', () => {
    expect(ref({ reference: 'Дії 2:2' })).toContainEqual(
      expect.objectContaining({ kind: 'theme_canon_mismatch', severity: 'warning' }),
    );
  });

  it('accepts a secondary cross-reference without a finding', () => {
    expect(kinds({ themeId: 'paul', reference: 'Дії 9:3' })).toEqual([]);
  });

  it('flags "1 Цар." as ambiguous and reads it as either Samuel or Kings for the theme fit', () => {
    const findings = ref({ themeId: 'judges', reference: '1 Цар. 7:15' });
    expect(findings).toContainEqual(expect.objectContaining({ kind: 'reference_ambiguous', severity: 'warning' }));
    expect(findings.find((f) => f.kind === 'theme_canon_mismatch')).toBeUndefined();
    expect(kinds({ themeId: 'kings', reference: '1 Царів 3:9' })).toEqual([]);
  });
});

describe('runQuestionQualityChecks — Russian text (quality gate L0)', () => {
  it('blocks a Russian word that uses only letters Ukrainian shares', () => {
    expect(runQuestionQualityChecks(body({ text: 'Кто был первым из пророков?' }))).toContainEqual(
      expect.objectContaining({ kind: 'mixed_language', severity: 'blocking' }),
    );
    expect(runQuestionQualityChecks(body({ text: 'Кто написал книгу Иова?' }))).toContainEqual(
      expect.objectContaining({ kind: 'mixed_language' }),
    );
  });

  it('does not flag Ukrainian words that look Russian-adjacent', () => {
    const findings = runQuestionQualityChecks(body({ text: 'Що сказала Рахав перед тим, як один розвідник пішов?' }));
    expect(findings.find((f) => f.kind === 'mixed_language')).toBeUndefined();
  });
});

describe('runQuestionQualityChecks — sensitivity routing for the seventh commandment', () => {
  it('routes adultery-in-thought questions to a reviewer even without the word «перелюб»', () => {
    const findings = runQuestionQualityChecks(
      body({ text: 'Чи можна вважати порушенням сьомої заповіді невірність у думках?' }),
    );
    expect(findings).toContainEqual(expect.objectContaining({ kind: 'sensitivity_sexuality_relationships', severity: 'blocking' }));
  });
});

describe('computeAnswerPositionBias', () => {
  it("catches the legacy bank's skew at B, which a first-option-only check missed", () => {
    const batch = [...Array(54).fill(1), ...Array(22).fill(0), ...Array(22).fill(2), ...Array(2).fill(3)];
    const report = computeAnswerPositionBias(batch);
    expect(report.sampleSize).toBe(100);
    expect(report.shares[1]).toBeCloseTo(0.54);
    expect(report.skewedPositions).toEqual([1, 3]);
    expect(report.flagged).toBe(true);
  });

  it('is not flagged for an even distribution', () => {
    expect(computeAnswerPositionBias([0, 1, 2, 3, 0, 1, 2, 3]).flagged).toBe(false);
  });

  it('handles an empty batch without dividing by zero', () => {
    expect(computeAnswerPositionBias([])).toEqual({ sampleSize: 0, shares: [0, 0, 0, 0], skewedPositions: [], flagged: false });
  });
});
