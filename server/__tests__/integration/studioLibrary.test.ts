import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadConfig } from '../../config/env';
import { createApp } from '../../app';
import { RoleRegistry } from '../../authz/roleRegistry';
import { createMemoryAuditLog } from '../../audit';
import { createInMemoryContentRepositories } from '../../domains/content/inMemoryRepository';
import { createInMemoryLearningRepositories } from '../../domains/learning/inMemoryRepository';
import { createInMemoryScriptureEvidenceRepository } from '../../domains/shared/inMemoryScriptureEvidence';
import { createInMemoryValidationFindingRepository } from '../../domains/shared/inMemoryValidationFindings';
import { createMemoryStore } from '../helpers/memoryStore';

function studioApp(opts: { withRepos?: boolean; env?: Record<string, string> } = {}) {
  const { config } = loadConfig({ NODE_ENV: 'test', AUTH_MODE: 'development', ...opts.env });
  const auditLog = createMemoryAuditLog();
  const repos = {
    content: createInMemoryContentRepositories(),
    learning: createInMemoryLearningRepositories(),
    findings: createInMemoryValidationFindingRepository(),
    scripture: createInMemoryScriptureEvidenceRepository(),
  };
  const roleRegistry = new RoleRegistry([
    { userId: 'reviewer-1', roles: ['content_reviewer'] },
    { userId: 'publisher-1', roles: ['content_publisher'] },
    { userId: 'plain-1', roles: [] },
  ]);
  const app = createApp({
    config,
    dbStore: createMemoryStore(),
    auditLog,
    roleRegistry,
    studioReview: opts.withRepos === false ? undefined : repos,
  });
  return { app, auditLog, repos };
}

const as = (app: ReturnType<typeof studioApp>['app'], userId: string) => ({
  get: (url: string) => request(app).get(url).set('x-user-id', userId),
  post: (url: string, body?: object) =>
    request(app).post(url).set('x-user-id', userId).send(body ?? {}),
});

const draft = (over: Record<string, unknown> = {}) => ({
  questionId: 'q1',
  themeId: 'genesis',
  difficulty: 'youth' as const,
  text: 'Хто збудував ковчег?',
  options: ['Ной', 'Мойсей'],
  correctIndex: 0,
  ...over,
});

const filter = { themeIds: ['genesis'], difficulty: null, topicNodeId: null, questionIds: [] };

describe('/api/v1/studio/library (Phase 4 WS8c)', () => {
  it('403s a caller with no content role', async () => {
    const { app } = studioApp();
    expect((await as(app, 'plain-1').get('/api/v1/studio/library')).status).toBe(403);
  });

  it('reports available:false without repositories', async () => {
    const { app } = studioApp({ withRepos: false });
    const res = await as(app, 'reviewer-1').get('/api/v1/studio/library');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ available: false, themes: [], findings: [] });
  });

  it('lists every catalog theme with status counts, flags uncatalogued themes, summarizes findings', async () => {
    const { app, repos } = studioApp();
    const { revision } = await repos.content.revisions.appendRevision(draft({ themeId: 'kings', status: 'draft' }));
    await repos.content.revisions.appendRevision(draft({ questionId: 'q2', themeId: 'kings' }));
    await repos.content.revisions.appendRevision(draft({ questionId: 'q3', themeId: 'no-such-theme' }));
    await repos.findings.record('question', revision.id, [
      {
        revisionType: 'question',
        revisionId: revision.id,
        kind: 'weak_explanation',
        severity: 'warning',
        label: 'Слабке пояснення',
        detail: '—',
      },
    ]);

    const res = await as(app, 'reviewer-1').get('/api/v1/studio/library');
    expect(res.status).toBe(200);
    const byId = new Map(res.body.themes.map((t: { themeId: string }) => [t.themeId, t]));
    expect(byId.get('kings')).toMatchObject({
      title: 'Царі',
      categoryId: 'old-testament',
      inCatalog: true,
      counts: { draft: 1, legacy_unreviewed: 1, published: 0 },
    });
    // A catalog theme with no revisions at all still appears — that's the gap the library shows.
    expect(byId.get('judges')).toMatchObject({ inCatalog: true, counts: { published: 0, draft: 0 } });
    expect(byId.get('no-such-theme')).toMatchObject({ inCatalog: false, categoryId: null });
    expect(res.body.findings).toEqual([
      { revisionType: 'question', kind: 'weak_explanation', severity: 'warning', label: 'Слабке пояснення', revisions: 1 },
    ]);
  });
});

describe('/api/v1/studio/releases (Phase 4 WS8c)', () => {
  async function seedSet(repos: ReturnType<typeof studioApp>['repos']) {
    const a = (await repos.content.revisions.appendRevision(draft({ questionId: 'qa' }))).revision;
    const b = (await repos.content.revisions.appendRevision(draft({ questionId: 'qb', text: 'b' }))).revision;
    await repos.content.sets.publishVersion({ setId: 'quiz:genesis', kind: 'quiz', filter, items: [{ questionId: 'qa', revisionId: a.id }] });
    await repos.content.sets.publishVersion({
      setId: 'quiz:genesis',
      kind: 'quiz',
      filter,
      items: [
        { questionId: 'qa', revisionId: a.id },
        { questionId: 'qb', revisionId: b.id },
      ],
    });
    return { a, b };
  }

  it('reports available:false without repositories but still serves the audit history', async () => {
    const { app } = studioApp({ withRepos: false });
    const res = await as(app, 'reviewer-1').get('/api/v1/studio/releases');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ available: false, sets: [] });
    expect(Array.isArray(res.body.history)).toBe(true);
  });

  it('lists set versions and serves a version with its item preview', async () => {
    const { app, repos } = studioApp();
    const { a } = await seedSet(repos);

    const list = await as(app, 'reviewer-1').get('/api/v1/studio/releases');
    expect(list.status).toBe(200);
    expect(list.body.sets.map((s: { version: number; isLatest: boolean }) => [s.version, s.isLatest]).sort()).toEqual([
      [1, false],
      [2, true],
    ]);

    const v1 = await as(app, 'reviewer-1').get('/api/v1/studio/releases/quiz%3Agenesis/versions/1');
    expect(v1.status).toBe(200);
    expect(v1.body.version).toMatchObject({ setId: 'quiz:genesis', version: 1, isLatest: false, latestVersion: 2 });
    expect(v1.body.items).toEqual([
      expect.objectContaining({ questionId: 'qa', revisionId: a.id, text: 'Хто збудував ковчег?' }),
    ]);
    expect((await as(app, 'reviewer-1').get('/api/v1/studio/releases/quiz%3Agenesis/versions/9')).status).toBe(404);
    expect((await as(app, 'reviewer-1').get('/api/v1/studio/releases/quiz%3Agenesis/versions/x')).status).toBe(400);
  });

  it('rollback needs content:rollback, an explicit confirmation, an older version — and is audited', async () => {
    const { app, repos, auditLog } = studioApp();
    await seedSet(repos);
    const url = '/api/v1/studio/releases/quiz%3Agenesis/rollback';

    expect((await as(app, 'reviewer-1').post(url, { confirmSetId: 'quiz:genesis', toVersion: 1 })).status).toBe(403);

    const unconfirmed = await as(app, 'publisher-1').post(url, { toVersion: 1 });
    expect(unconfirmed.status).toBe(400);
    expect(unconfirmed.body.error.code).toBe('confirmation_required');

    const notOlder = await as(app, 'publisher-1').post(url, { confirmSetId: 'quiz:genesis', toVersion: 2 });
    expect(notOlder.status).toBe(409);
    expect(notOlder.body.error.code).toBe('rollback_not_older');

    const ok = await as(app, 'publisher-1').post(url, { confirmSetId: 'quiz:genesis', toVersion: 1 });
    expect(ok.status).toBe(200);
    // A rollback is a new version carrying the old membership — v1 and v2 stay intact.
    expect(ok.body.version).toMatchObject({ version: 3, questionCount: 1, publishedBy: 'publisher-1' });
    expect((await repos.content.sets.getVersion('quiz:genesis', 2))?.questionCount).toBe(2);

    const [record] = await auditLog.query({ action: 'content.rollback', target: 'quiz:genesis' });
    expect(record).toMatchObject({ actor: { userId: 'publisher-1' }, metadata: { toVersion: 1, fromVersion: 3 } });

    const history = await as(app, 'reviewer-1').get('/api/v1/studio/releases');
    expect(history.body.history[0]).toMatchObject({ action: 'content.rollback', target: 'quiz:genesis' });
  });
});

describe('/api/v1/studio/settings (Phase 4 WS8c)', () => {
  it('describes providers without leaking keys, the job budget and the content permission matrix', async () => {
    const { app, auditLog } = studioApp({ env: { CONTENT_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'secret-key-123' } });
    await auditLog.append({
      at: '2026-09-23T10:00:00.000Z',
      actor: { userId: 'reviewer-1', authSource: 'dev' },
      action: 'content.job_create',
      target: 'job_1',
      result: 'ok',
      metadata: { promptVersion: 'question.generate.v1' },
    });

    const res = await as(app, 'reviewer-1').get('/api/v1/studio/settings');
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain('secret-key-123');
    expect(res.body.aiEnabled).toBe(true);
    expect(res.body.providers.find((p: { id: string }) => p.id === 'gemini')).toMatchObject({
      selected: true,
      configured: true,
    });
    expect(res.body.providers.find((p: { id: string }) => p.id === 'groq')).toMatchObject({
      selected: false,
      configured: false,
    });
    expect(res.body.jobBudget).toMatchObject({ maxRequests: expect.any(Number) });
    expect(res.body.permissions.every((p: string) => p.startsWith('content:'))).toBe(true);
    const reviewer = res.body.roles.find((r: { role: string }) => r.role === 'content_reviewer');
    expect(reviewer.permissions).toContain('content:approve');
    expect(reviewer.permissions).not.toContain('content:publish');
    expect(res.body.promptVersions).toEqual([
      { promptVersion: 'question.generate.v1', lastUsedAt: '2026-09-23T10:00:00.000Z', jobs: 1 },
    ]);
  });

  it('aiEnabled is false when the selected provider has no key', async () => {
    const { app } = studioApp({ env: { CONTENT_AI_PROVIDER: 'groq' } });
    const res = await as(app, 'reviewer-1').get('/api/v1/studio/settings');
    expect(res.body.aiEnabled).toBe(false);
  });
});

describe('/api/v1/studio/activity filters (Phase 4 WS8c journal)', () => {
  it('filters by action and rejects a malformed since', async () => {
    const { app, auditLog } = studioApp();
    for (const action of ['content.publish', 'content.review_decision']) {
      await auditLog.append({ at: new Date().toISOString(), actor: { userId: 'u', authSource: 'dev' }, action, result: 'ok' });
    }
    const res = await as(app, 'reviewer-1').get('/api/v1/studio/activity?action=content.publish&limit=50');
    expect(res.status).toBe(200);
    expect(res.body.activity.map((r: { action: string }) => r.action)).toEqual(['content.publish']);
    expect((await as(app, 'reviewer-1').get('/api/v1/studio/activity?since=yesterday')).status).toBe(400);
  });
});
