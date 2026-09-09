import { afterEach, describe, expect, it } from 'vitest';
import { importLegacyQuestions } from '../../domains/content/import';
import { createInMemoryContentRepositories } from '../../domains/content/inMemoryRepository';
import type { RawQuestionInput } from '../../domains/content/validation';
import { createContentQueryService, revisionToLegacyQuestion } from '../contentQuery';
import {
  configureCanonicalContent,
  getQuestionsByIds,
  pickQuestions,
  resetCanonicalContent,
} from '../questionService';

const raw = (over: Partial<RawQuestionInput> = {}): RawQuestionInput => ({
  id: 'q1',
  themeId: 'genesis',
  difficulty: 'youth',
  text: 'Who built the ark?',
  options: ['Noah', 'Moses', 'Abraham'],
  correctIndex: 0,
  ...over,
});

async function seededQuery() {
  const repos = createInMemoryContentRepositories();
  await importLegacyQuestions(repos, [
    raw({ id: 'a', text: 'a?' }),
    raw({ id: 'b', text: 'b?' }),
    raw({ id: 'c', themeId: 'exodus', text: 'c?' }),
  ]);
  for (const id of ['a', 'b', 'c']) {
    const rev = (await repos.revisions.listRevisions(id))[0];
    await repos.revisions.publishRevision(rev.id);
  }
  return { repos, query: createContentQueryService(repos) };
}

afterEach(() => resetCanonicalContent());

describe('revisionToLegacyQuestion', () => {
  it('maps id from questionId and drops nulls', async () => {
    const { repos } = await seededQuery();
    const rev = await repos.revisions.getPublished('a');
    const q = revisionToLegacyQuestion(rev!);
    expect(q.id).toBe('a');
    expect(q.reference).toBeUndefined();
    expect(q.options).toEqual(['Noah', 'Moses', 'Abraham']);
  });
});

describe('createContentQueryService', () => {
  it('does not truncate a large theme pool (regression: was hard-capped at 500)', async () => {
    const repos = createInMemoryContentRepositories();
    const bulk = Array.from({ length: 640 }, (_, i) =>
      raw({ id: `q${i}`, text: `q${i}?` }),
    );
    await importLegacyQuestions(repos, bulk);
    for (const q of bulk) {
      const rev = (await repos.revisions.listRevisions(q.id))[0];
      await repos.revisions.publishRevision(rev.id);
    }
    const query = createContentQueryService(repos);
    expect((await query.listPublished({ themeIds: ['genesis'] })).length).toBe(640);
    expect((await query.getPublishedByIds(bulk.map((b) => b.id))).length).toBe(640);
  });

  it('lists published by filter and resolves ids in order', async () => {
    const { query } = await seededQuery();
    const genesis = await query.listPublished({ themeIds: ['genesis'] });
    expect(genesis.map((q) => q.id).sort()).toEqual(['a', 'b']);

    const byIds = await query.getPublishedByIds(['c', 'a']);
    expect(byIds.map((q) => q.id)).toEqual(['c', 'a']);
  });
});

describe('questionService canonical seam (§14, WS3 part 3)', () => {
  it('canonical mode serves published revisions', async () => {
    const { query } = await seededQuery();
    configureCanonicalContent({ mode: 'canonical', query });

    const picked = await pickQuestions({ themeId: 'genesis', difficulty: 'youth', count: 5 });
    expect(picked.map((q) => q.id).sort()).toEqual(['a', 'b']);

    const byIds = await getQuestionsByIds(['b', 'a']);
    expect(byIds.map((q) => q.id)).toEqual(['b', 'a']);
  });

  it('off mode (configure with null) does not touch the canonical repo', async () => {
    const { query } = await seededQuery();
    configureCanonicalContent({ mode: 'canonical', query });
    configureCanonicalContent(null);
    // No DB configured and canonical disabled → falls through to the JSON fallback,
    // which returns nothing for an unknown theme rather than throwing.
    const picked = await pickQuestions({ themeId: '__none__', difficulty: 'youth', count: 3 });
    expect(picked).toEqual([]);
  });
});
