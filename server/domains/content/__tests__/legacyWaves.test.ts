import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSqlContentRepositories } from '../../../infrastructure/database/repositories/content';
import { createSqlValidationFindingRepository } from '../../../infrastructure/database/repositories/validationFindings';
import { createTestDatabase, type TestDatabase } from '../../../infrastructure/database/testing';
import { importWave, rollbackWave } from '../legacyWaves';
import { isValidatedWith } from '../revisionValidation';
import type { RawQuestionInput } from '../validation';

const raw = (id: string, over: Partial<RawQuestionInput> = {}): RawQuestionInput => ({
  id,
  themeId: 'kings',
  difficulty: 'youth',
  text: `Питання ${id}?`,
  options: ['А', 'Б', 'В'],
  correctIndex: 1,
  reference: '1 Цар 1:1',
  explanationShort: 'Пояснення достатньої довжини.',
  ...over,
});

describe('migration waves on real SQL adapters (Phase 4 WS10, §12.3)', () => {
  let tdb: TestDatabase;
  beforeAll(async () => {
    tdb = await createTestDatabase();
  });
  afterAll(async () => {
    await tdb.close();
  });

  it('imports as legacy_unreviewed, never published; is idempotent; rollback quarantines only what it created', async () => {
    const repos = createSqlContentRepositories(tdb.db);
    // A question that existed (and was published) before the wave.
    const prior = (
      await repos.revisions.appendRevision({ questionId: 'q-prior', themeId: 'kings', difficulty: 'youth', text: 'Старе?', options: ['А', 'Б'], correctIndex: 0, status: 'draft' })
    ).revision;
    await repos.revisions.publishRevision(prior.id);

    const wave = [raw('q-1'), raw('q-2'), raw('q-prior', { text: 'Оновлене старе?' }), raw('q-bad', { correctIndex: 9 })];
    const first = await importWave(repos, wave);
    expect(first).toMatchObject({ created: 3, unchanged: 0, skippedInvalid: 1, createdQuestionIds: ['q-1', 'q-2'] });
    expect(first.after.legacy_unreviewed - first.before.legacy_unreviewed).toBe(3);
    expect(first.after.published).toBe(first.before.published);

    const again = await importWave(repos, wave);
    expect(again).toMatchObject({ created: 0, unchanged: 3, createdQuestionIds: [] });

    expect(await rollbackWave(repos, 1, first.createdQuestionIds)).toBe(2);
    expect((await repos.revisions.listRevisions('q-1'))[0].status).toBe('quarantined');
    // The pre-existing question — and what players see — is untouched by the rollback.
    expect((await repos.revisions.getPublished('q-prior'))?.id).toBe(prior.id);
  });

  it('records quality findings + the run marker for every imported revision when checks are supplied', async () => {
    const repos = createSqlContentRepositories(tdb.db);
    const findings = createSqlValidationFindingRepository(tdb.db);
    await importWave(repos, [raw('q-checked'), raw('q-offtheme', { reference: 'Дії 2:2' })], { findings });

    const [checked] = await repos.revisions.listRevisions('q-checked');
    expect(isValidatedWith(await findings.listFor('question', checked.id))).toBe(true);

    const [offTheme] = await repos.revisions.listRevisions('q-offtheme');
    const kinds = (await findings.listFor('question', offTheme.id)).map((f) => f.kind);
    expect(kinds).toContain('theme_canon_mismatch');
  });
});
