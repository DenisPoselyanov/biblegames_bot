import { describe, expect, it } from 'vitest';
import { createInMemoryValidationFindingRepository } from '../../shared/inMemoryValidationFindings';
import { createInMemoryContentRepositories } from '../inMemoryRepository';
import {
  QUESTION_CHECKS_VERSION,
  isValidatedWith,
  questionRevisionFindings,
  validateQuestionRevision,
} from '../revisionValidation';

async function revision(over: Record<string, unknown> = {}) {
  const content = createInMemoryContentRepositories();
  const { revision: r } = await content.revisions.appendRevision({
    questionId: 'q1',
    themeId: 'pentateuch',
    difficulty: 'youth',
    text: 'Хто збудував ковчег?',
    options: ['Ной', 'Мойсей', 'Авраам', 'Давид'],
    correctIndex: 0,
    explanationShort: 'Ной збудував ковчег за Божим наказом перед потопом.',
    reference: 'Бут. 6:14',
    ...over,
  });
  return r;
}

describe('questionRevisionFindings', () => {
  it('keys every finding to the revision id, not the question id, and appends the run marker', async () => {
    const r = await revision({ reference: 'Дії 2:2' });
    const findings = questionRevisionFindings(r);
    expect(findings.every((f) => f.revisionId === r.id)).toBe(true);
    expect(findings.map((f) => f.kind)).toEqual(expect.arrayContaining(['theme_canon_mismatch', 'validation_run']));
    expect(findings.find((f) => f.kind === 'validation_run')).toMatchObject({ severity: 'info', detail: QUESTION_CHECKS_VERSION });
  });
});

describe('validateQuestionRevision / isValidatedWith', () => {
  it('a clean revision is recorded as validated with only the run marker (plus info)', async () => {
    const findings = createInMemoryValidationFindingRepository();
    const r = await revision();
    const stored = await validateQuestionRevision({ findings }, r);
    expect(isValidatedWith(stored)).toBe(true);
    expect(stored.filter((f) => f.severity !== 'info')).toEqual([]);
  });

  it('never-checked and older-version runs do not count as validated', async () => {
    expect(isValidatedWith([])).toBe(false);
    const findings = createInMemoryValidationFindingRepository();
    const r = await revision();
    const stale = await findings.record('question', r.id, [
      { revisionType: 'question', revisionId: r.id, kind: 'validation_run', severity: 'info', label: 'x', detail: 'question-checks@1' },
    ]);
    expect(isValidatedWith(stale)).toBe(false);
  });

  it('a re-run replaces the previous finding set', async () => {
    const findings = createInMemoryValidationFindingRepository();
    const r = await revision({ reference: null });
    await findings.record('question', r.id, [
      { revisionType: 'question', revisionId: r.id, kind: 'stale_kind', severity: 'warning', label: 'x', detail: 'x' },
    ]);
    const stored = await validateQuestionRevision({ findings }, r);
    expect(stored.map((f) => f.kind)).not.toContain('stale_kind');
    expect(stored).toContainEqual(expect.objectContaining({ kind: 'missing_reference', severity: 'blocking' }));
  });
});
