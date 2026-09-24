import { describe, expect, it } from 'vitest';
import type { Difficulty } from '../../../../contracts/index';
import { buildGoldenSample, stratumOf, type GoldenCandidate } from '../goldenSample';

const LEVELS: Difficulty[] = ['baby', 'child', 'youth', 'student', 'preacher', 'teacher', 'theologian'];
const THEMES = ['pentateuch', 'gospels', 'prophets', 'paul'];

function candidates(n: number, findings: (i: number) => string[]): GoldenCandidate[] {
  return Array.from({ length: n }, (_, i) => ({
    subject: {
      questionId: `q${i}`,
      contentHash: `h${i}`,
      themeId: THEMES[i % THEMES.length],
      difficulty: LEVELS[i % LEVELS.length],
      topicNodeId: null,
      text: `Питання ${i}?`,
      options: ['А', 'Б', 'В', 'Г'],
      correctIndex: 0,
      explanationShort: null,
      explanationDeep: null,
      reference: null,
    },
    findings: findings(i),
  }));
}

const bank = candidates(3000, (i) =>
  i % 10 === 0 ? ['theme_canon_mismatch'] : i % 10 === 1 ? ['missing_reference'] : i % 50 === 2 ? ['mixed_language'] : i % 10 === 3 ? ['answer_leakage'] : i % 10 === 4 ? ['missing_deep_explanation'] : [],
);

describe('golden sample (WS11c)', () => {
  it('buckets by the strongest suspicion and ignores heuristic noise', () => {
    expect(stratumOf(['missing_reference', 'theme_canon_mismatch'])).toBe('canon_mismatch');
    expect(stratumOf(['reference_ambiguous'])).toBe('reference');
    expect(stratumOf(['mixed_language', 'answer_leakage'])).toBe('language');
    expect(stratumOf(['answer_leakage'])).toBe('other_findings');
    expect(stratumOf(['missing_deep_explanation', 'option_length_imbalance', 'validation_run'])).toBe('clean');
  });

  it('draws 200 unique items with the planned stratum split', () => {
    const sample = buildGoldenSample(bank);
    expect(sample.size).toBe(200);
    expect(new Set(sample.items.map((i) => i.subject.questionId)).size).toBe(200);
    expect(sample.byStratum).toEqual({ canon_mismatch: 60, reference: 30, language: 10, other_findings: 30, clean: 70 });
  });

  it('spreads every stratum across levels and themes', () => {
    const sample = buildGoldenSample(bank);
    const clean = sample.items.filter((i) => i.stratum === 'clean');
    expect(new Set(clean.map((i) => i.subject.difficulty)).size).toBe(LEVELS.length);
    expect(new Set(clean.map((i) => i.subject.themeId)).size).toBe(THEMES.length);
    const perLevel = LEVELS.map((l) => clean.filter((i) => i.subject.difficulty === l).length);
    expect(Math.max(...perLevel) - Math.min(...perLevel)).toBeLessThanOrEqual(1);
  });

  it('is deterministic per seed, mixes strata in order, and changes with the seed', () => {
    const a = buildGoldenSample(bank, { now: () => new Date(0) });
    const b = buildGoldenSample(bank, { now: () => new Date(0) });
    expect(a).toEqual(b);
    expect(a.items.slice(0, 20).map((i) => i.stratum)).not.toEqual(Array(20).fill(a.items[0].stratum));
    const c = buildGoldenSample(bank, { seed: 'other' });
    expect(c.items.map((i) => i.subject.questionId)).not.toEqual(a.items.map((i) => i.subject.questionId));
  });

  it('hands a short stratum’s share to the others', () => {
    const noLanguage = candidates(3000, (i) => (i % 10 === 0 ? ['theme_canon_mismatch'] : []));
    const sample = buildGoldenSample(noLanguage);
    expect(sample.size).toBe(200);
    expect(sample.byStratum.language).toBe(0);
    expect(sample.byStratum.reference).toBe(0);
    expect(sample.byStratum.canon_mismatch + sample.byStratum.clean).toBe(200);
  });
});
