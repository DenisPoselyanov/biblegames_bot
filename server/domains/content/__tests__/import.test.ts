import { describe, expect, it } from 'vitest';
import { importLegacyQuestions } from '../import';
import { createInMemoryContentRepositories } from '../inMemoryRepository';
import { buildSnapshot } from '../snapshot';
import { validateQuestion, type RawQuestionInput } from '../validation';

const raw = (over: Partial<RawQuestionInput> = {}): RawQuestionInput => ({
  id: 'q1',
  themeId: 'genesis',
  difficulty: 'youth',
  text: 'Who built the ark?',
  options: ['Noah', 'Moses', 'Abraham'],
  correctIndex: 0,
  ...over,
});

describe('validateQuestion (§14 — no first-option fallback)', () => {
  it('accepts a well-formed body', () => {
    const r = validateQuestion(raw());
    expect(r.ok).toBe(true);
  });

  it('reports a missing correctIndex rather than defaulting it to 0', () => {
    const r = validateQuestion(raw({ correctIndex: undefined, correct: undefined }));
    expect(r).toEqual({ ok: false, issues: ['missing_correct_index'] });
  });

  it('reports an out-of-range correctIndex', () => {
    const r = validateQuestion(raw({ correctIndex: 7 }));
    expect(r).toEqual({ ok: false, issues: ['correct_index_out_of_range'] });
  });

  it('accepts the legacy `correct` field name', () => {
    const r = validateQuestion(raw({ correctIndex: undefined, correct: 2 }));
    expect(r.ok && r.draft.correctIndex).toBe(2);
  });

  it('rejects structurally broken bodies', () => {
    expect(validateQuestion(raw({ text: '   ' })).ok).toBe(false);
    expect(validateQuestion(raw({ options: ['only one'] })).ok).toBe(false);
    expect(validateQuestion(raw({ difficulty: 'wizard' })).ok).toBe(false);
  });
});

describe('importLegacyQuestions (§18.3)', () => {
  it('imports valid questions as legacy_unreviewed and is idempotent', async () => {
    const repos = createInMemoryContentRepositories();
    const first = await importLegacyQuestions(repos, [raw({ id: 'a' }), raw({ id: 'b', text: 'b?' })]);
    expect(first).toMatchObject({ total: 2, created: 2, unchanged: 0, quarantined: 0 });
    expect((await repos.revisions.getById((await repos.revisions.listRevisions('a'))[0].id))?.status).toBe(
      'legacy_unreviewed',
    );

    const again = await importLegacyQuestions(repos, [raw({ id: 'a' }), raw({ id: 'b', text: 'b?' })]);
    expect(again).toMatchObject({ created: 0, unchanged: 2 });
  });

  it('quarantines a body whose only fault is the answer key', async () => {
    const repos = createInMemoryContentRepositories();
    const report = await importLegacyQuestions(repos, [raw({ id: 'bad', correctIndex: 9 })]);
    expect(report.quarantined).toBe(1);
    expect(report.created).toBe(0);
    const revs = await repos.revisions.listRevisions('bad');
    expect(revs[0].status).toBe('quarantined');
    expect(revs[0].quarantineReason).toContain('correct_index_out_of_range');
    expect(await repos.revisions.getPublished('bad')).toBeNull();
  });

  it('rejects structurally broken bodies without writing anything', async () => {
    const repos = createInMemoryContentRepositories();
    const report = await importLegacyQuestions(repos, [raw({ id: 'broken', options: ['x'] })]);
    expect(report.rejected).toEqual([{ id: 'broken', issues: ['too_few_options'] }]);
    expect(await repos.revisions.listRevisions('broken')).toEqual([]);
  });
});

describe('buildSnapshot (§14 — output, not a source)', () => {
  it('is a stable hash of the published revisions', async () => {
    const repos = createInMemoryContentRepositories();
    await importLegacyQuestions(repos, [raw({ id: 'a' }), raw({ id: 'b', text: 'b?' })]);
    for (const q of ['a', 'b']) {
      const rev = (await repos.revisions.listRevisions(q))[0];
      await repos.revisions.publishRevision(rev.id);
    }
    const published = await repos.revisions.listPublished({});
    const filter = { themeIds: ['genesis'], difficulty: null, topicNodeId: null, questionIds: [] };
    const s1 = buildSnapshot('snapshot:genesis', filter, published);
    const s2 = buildSnapshot('snapshot:genesis', filter, [...published].reverse());
    expect(s1.set.contentHash).toBe(s2.set.contentHash);
    expect(s1.questions.map((q) => q.id)).toEqual(['a', 'b']);
    expect(s1.set.kind).toBe('snapshot');
  });
});
