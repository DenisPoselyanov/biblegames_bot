/**
 * Shared validation-finding-repository contract (Phase 4 WS3). Run against
 * every adapter (SQL on pglite, and the in-memory peer).
 */
import { expect, it } from 'vitest';
import type { NewValidationFinding } from '../validationFindings';
import type { ValidationFindingRepository } from '../validationFindingsRepository';

export interface ContractHarness {
  repo: ValidationFindingRepository;
  reset: () => Promise<void>;
}

const finding = (over: Partial<NewValidationFinding> = {}): NewValidationFinding => ({
  revisionType: 'question',
  revisionId: 'qrev_1',
  kind: 'weak_explanation',
  severity: 'warning',
  label: 'Слабке пояснення',
  detail: 'explanationShort відсутній',
  ...over,
});

export function runValidationFindingsRepositoryContract(
  makeHarness: () => Promise<ContractHarness>,
): void {
  const setup = async (): Promise<ValidationFindingRepository> => {
    const h = await makeHarness();
    await h.reset();
    return h.repo;
  };

  it('records findings and lists them back for the same revision', async () => {
    const repo = await setup();
    const recorded = await repo.record('question', 'qrev_1', [
      finding({ kind: 'weak_explanation' }),
      finding({ kind: 'mixed_language', severity: 'info', label: 'Мова', detail: 'ок' }),
    ]);
    expect(recorded).toHaveLength(2);
    expect(recorded[0]?.id).toBeTruthy();
    expect(recorded[0]?.checkedAt).toBeTruthy();

    const listed = await repo.listFor('question', 'qrev_1');
    expect(listed.map((f) => f.kind).sort()).toEqual(['mixed_language', 'weak_explanation']);
  });

  it('record() replaces the prior finding set for that revision, not appends', async () => {
    const repo = await setup();
    await repo.record('question', 'qrev_1', [finding({ kind: 'weak_explanation' })]);
    await repo.record('question', 'qrev_1', [finding({ kind: 'duplicate_exact', severity: 'blocking' })]);

    const listed = await repo.listFor('question', 'qrev_1');
    expect(listed.map((f) => f.kind)).toEqual(['duplicate_exact']);
  });

  it('record() with an empty list clears prior findings', async () => {
    const repo = await setup();
    await repo.record('question', 'qrev_1', [finding()]);
    await repo.record('question', 'qrev_1', []);
    expect(await repo.listFor('question', 'qrev_1')).toEqual([]);
  });

  it('keeps question and lesson findings separate even with the same revisionId', async () => {
    const repo = await setup();
    await repo.record('question', 'rev_1', [finding({ revisionType: 'question', revisionId: 'rev_1' })]);
    await repo.record('lesson', 'rev_1', [
      finding({ revisionType: 'lesson', revisionId: 'rev_1', kind: 'missing_field' }),
    ]);

    expect((await repo.listFor('question', 'rev_1')).map((f) => f.kind)).toEqual(['weak_explanation']);
    expect((await repo.listFor('lesson', 'rev_1')).map((f) => f.kind)).toEqual(['missing_field']);
  });

  it('hasBlocking is true only when a blocking finding is present', async () => {
    const repo = await setup();
    await repo.record('question', 'qrev_1', [finding({ severity: 'warning' })]);
    expect(await repo.hasBlocking('question', 'qrev_1')).toBe(false);

    await repo.record('question', 'qrev_1', [
      finding({ severity: 'warning' }),
      finding({ kind: 'theological_sensitivity', severity: 'blocking' }),
    ]);
    expect(await repo.hasBlocking('question', 'qrev_1')).toBe(true);
  });

  it('summarize groups by (type, kind, severity), counting distinct revisions, blocking first (Phase 4 WS8c)', async () => {
    const repo = await setup();
    expect(await repo.summarize()).toEqual([]);

    await repo.record('question', 'qrev_1', [finding(), finding({ detail: 'другий рядок того ж правила' })]);
    await repo.record('question', 'qrev_2', [
      finding({ revisionId: 'qrev_2' }),
      finding({ revisionId: 'qrev_2', kind: 'theological_sensitivity', severity: 'blocking', label: 'Чутлива тема' }),
    ]);
    await repo.record('lesson', 'lrev_1', [finding({ revisionType: 'lesson', revisionId: 'lrev_1' })]);

    expect(await repo.summarize()).toEqual([
      { revisionType: 'question', kind: 'theological_sensitivity', severity: 'blocking', label: 'Чутлива тема', revisions: 1 },
      { revisionType: 'question', kind: 'weak_explanation', severity: 'warning', label: 'Слабке пояснення', revisions: 2 },
      { revisionType: 'lesson', kind: 'weak_explanation', severity: 'warning', label: 'Слабке пояснення', revisions: 1 },
    ]);
  });
}
