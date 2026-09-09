import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadConfig } from '../../config/env';
import { createApp } from '../../app';
import { importLegacyQuestions } from '../../domains/content/import';
import { createInMemoryContentRepositories } from '../../domains/content/inMemoryRepository';
import { resetCanonicalContent } from '../../services/questionService';
import { createMemoryStore } from '../helpers/memoryStore';

async function seededContentRepos() {
  const repos = createInMemoryContentRepositories();
  await importLegacyQuestions(repos, [
    { id: 'a', themeId: 'genesis', difficulty: 'youth', text: 'a?', options: ['x', 'y'], correctIndex: 1 },
    { id: 'b', themeId: 'genesis', difficulty: 'youth', text: 'b?', options: ['x', 'y'], correctIndex: 0 },
  ]);
  for (const id of ['a', 'b']) {
    const rev = (await repos.revisions.listRevisions(id))[0];
    await repos.revisions.publishRevision(rev.id);
  }
  return repos;
}

afterEach(() => resetCanonicalContent());

describe('canonical content repository cutover (Phase 2 WS3 §14)', () => {
  it('serves /api/questions from published revisions when the flag is `canonical`', async () => {
    const { config } = loadConfig({
      NODE_ENV: 'test',
      AUTH_MODE: 'development',
      CANONICAL_CONTENT_REPOSITORY: 'canonical',
    });
    const app = createApp({
      config,
      dbStore: createMemoryStore(),
      contentRepositories: await seededContentRepos(),
    });

    const res = await request(app).get('/api/questions?themeId=genesis&difficulty=youth&count=5');
    expect(res.status).toBe(200);
    expect(res.body.questions.map((q: { id: string }) => q.id).sort()).toEqual(['a', 'b']);
    const a = res.body.questions.find((q: { id: string }) => q.id === 'a');
    expect(a.correctIndex).toBe(1); // real answer key, not a first-option fallback
  });

  it('leaves the legacy path untouched when the flag is `off`', async () => {
    const { config } = loadConfig({ NODE_ENV: 'test', AUTH_MODE: 'development' });
    const app = createApp({
      config,
      dbStore: createMemoryStore(),
      contentRepositories: await seededContentRepos(),
    });
    const res = await request(app).get('/api/questions?themeId=__unknown__&difficulty=youth');
    expect(res.status).toBe(200);
    expect(res.body.questions).toEqual([]);
  });
});
