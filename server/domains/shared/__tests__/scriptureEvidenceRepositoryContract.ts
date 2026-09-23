/**
 * Shared scripture-evidence-repository contract (Phase 4 WS4). Run against
 * every adapter (SQL on pglite, and the in-memory peer).
 */
import { expect, it } from 'vitest';
import type { NewScriptureEvidence } from '../scriptureEvidence';
import type { ScriptureEvidenceRepository } from '../scriptureEvidenceRepository';

export interface ContractHarness {
  repo: ScriptureEvidenceRepository;
  reset: () => Promise<void>;
}

const evidence = (over: Partial<NewScriptureEvidence> = {}): NewScriptureEvidence => ({
  revisionType: 'question',
  revisionId: 'qrev_1',
  rawReference: 'Ів 3:16',
  bookId: 43,
  chapter: 3,
  verseStart: 16,
  verseEnd: 16,
  translation: 'UTT',
  verdict: 'match',
  quotedText: null,
  sourceText: 'Так бо Бог полюбив світ...',
  adapterVersion: 'mock-scripture-v1',
  ...over,
});

export function runScriptureEvidenceRepositoryContract(
  makeHarness: () => Promise<ContractHarness>,
): void {
  const setup = async (): Promise<ScriptureEvidenceRepository> => {
    const h = await makeHarness();
    await h.reset();
    return h.repo;
  };

  it('records evidence and lists it back for the same revision', async () => {
    const repo = await setup();
    const recorded = await repo.record('question', 'qrev_1', [evidence()]);
    expect(recorded).toHaveLength(1);
    expect(recorded[0]?.id).toBeTruthy();
    expect(recorded[0]?.retrievedAt).toBeTruthy();
    expect(recorded[0]?.reviewerDecision).toBeNull();

    const listed = await repo.listFor('question', 'qrev_1');
    expect(listed).toHaveLength(1);
    expect(listed[0]?.rawReference).toBe('Ів 3:16');
  });

  it('record() replaces the prior evidence set for that revision, not appends', async () => {
    const repo = await setup();
    await repo.record('question', 'qrev_1', [evidence({ rawReference: 'Ів 3:16' })]);
    await repo.record('question', 'qrev_1', [evidence({ rawReference: 'Рим 5:8', verdict: 'mismatch' })]);

    const listed = await repo.listFor('question', 'qrev_1');
    expect(listed.map((e) => e.rawReference)).toEqual(['Рим 5:8']);
  });

  it('keeps question and lesson evidence separate even with the same revisionId', async () => {
    const repo = await setup();
    await repo.record('question', 'rev_1', [evidence({ revisionType: 'question', revisionId: 'rev_1' })]);
    await repo.record('lesson', 'rev_1', [
      evidence({ revisionType: 'lesson', revisionId: 'rev_1', rawReference: 'Рим 5:8' }),
    ]);

    expect((await repo.listFor('question', 'rev_1')).map((e) => e.rawReference)).toEqual(['Ів 3:16']);
    expect((await repo.listFor('lesson', 'rev_1')).map((e) => e.rawReference)).toEqual(['Рим 5:8']);
  });

  it('hasUnresolvedBlocker is true for mismatch/not_found, false for match', async () => {
    const repo = await setup();
    await repo.record('question', 'qrev_1', [evidence({ verdict: 'match' })]);
    expect(await repo.hasUnresolvedBlocker('question', 'qrev_1')).toBe(false);

    await repo.record('question', 'qrev_1', [evidence({ verdict: 'mismatch' })]);
    expect(await repo.hasUnresolvedBlocker('question', 'qrev_1')).toBe(true);

    await repo.record('question', 'qrev_1', [evidence({ verdict: 'not_found' })]);
    expect(await repo.hasUnresolvedBlocker('question', 'qrev_1')).toBe(true);
  });

  it('a paraphrase verdict blocks until a reviewer accepts it', async () => {
    const repo = await setup();
    const [row] = await repo.record('question', 'qrev_1', [evidence({ verdict: 'paraphrase' })]);
    expect(await repo.hasUnresolvedBlocker('question', 'qrev_1')).toBe(true);

    await repo.recordReviewerDecision(row!.id, 'accepted');
    expect(await repo.hasUnresolvedBlocker('question', 'qrev_1')).toBe(false);

    const listed = await repo.listFor('question', 'qrev_1');
    expect(listed[0]?.reviewerDecision).toBe('accepted');
  });

  it('a rejected paraphrase still blocks', async () => {
    const repo = await setup();
    const [row] = await repo.record('question', 'qrev_1', [evidence({ verdict: 'paraphrase' })]);
    await repo.recordReviewerDecision(row!.id, 'rejected');
    expect(await repo.hasUnresolvedBlocker('question', 'qrev_1')).toBe(true);
  });
}
