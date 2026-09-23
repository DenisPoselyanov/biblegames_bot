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
import { createInMemoryQualityRepositories } from '../../domains/quality/inMemory';
import { createInMemoryJobQueue } from '../../domains/jobs/inMemoryQueue';
import { JOB_TYPES } from '../../domains/jobs/catalog';
import { createMemoryStore } from '../helpers/memoryStore';

function qualityApp(opts: { withRepos?: boolean; withQueue?: boolean } = {}) {
  const { config } = loadConfig({ NODE_ENV: 'test', AUTH_MODE: 'development' });
  const auditLog = createMemoryAuditLog();
  const answers: Array<{ questionId: string; isCorrect: boolean }> = [];
  const review = {
    content: createInMemoryContentRepositories(),
    learning: createInMemoryLearningRepositories(),
    findings: createInMemoryValidationFindingRepository(),
    scripture: createInMemoryScriptureEvidenceRepository(),
  };
  const quality = createInMemoryQualityRepositories({ answers: async () => answers });
  const jobQueue = opts.withQueue ? createInMemoryJobQueue({ onEvent: () => {} }) : undefined;
  // Register the repair type's payload schema by enqueue-time validation only; no handler run needed.
  jobQueue?.register(JOB_TYPES.AI_CONTENT_REPAIR, { handler: async () => {} });
  const roleRegistry = new RoleRegistry([
    { userId: 'reviewer-1', roles: ['content_reviewer'] },
    { userId: 'player-1', roles: [] },
    { userId: 'player-2', roles: [] },
  ]);
  const withRepos = opts.withRepos !== false;
  const app = createApp({
    config,
    dbStore: createMemoryStore(),
    auditLog,
    roleRegistry,
    studioReview: withRepos ? review : undefined,
    quality: withRepos ? quality : undefined,
    jobQueue,
  });
  return { app, auditLog, review, quality, answers, jobQueue };
}

const as = (app: ReturnType<typeof qualityApp>['app'], userId: string) => ({
  get: (url: string) => request(app).get(url).set('x-user-id', userId),
  post: (url: string, body?: object) =>
    request(app).post(url).set('x-user-id', userId).send(body ?? {}),
});

async function seedQuestion(review: ReturnType<typeof qualityApp>['review'], questionId = 'q-ark') {
  const { revision } = await review.content.revisions.appendRevision({
    questionId,
    themeId: 'genesis',
    difficulty: 'youth',
    text: 'Хто збудував ковчег?',
    options: ['Ной', 'Мойсей', 'Авраам'],
    correctIndex: 0,
    status: 'draft',
  });
  await review.content.revisions.publishRevision(revision.id);
  return revision;
}

describe('/api/v1/content-reports (Phase 4 WS9, player side)', () => {
  it('stores a report, treats a repeat as a duplicate, shows only the player’s own reports', async () => {
    const { app, review, auditLog } = qualityApp();
    const revision = await seedQuestion(review);
    const body = { entityType: 'question', entityId: 'q-ark', revisionId: revision.id, category: 'wrong_answer', comment: 'Б теж вірно' };

    const first = await as(app, 'player-1').post('/api/v1/content-reports', body);
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ duplicate: false, report: { status: 'open', entityId: 'q-ark' } });
    expect(first.body.report).not.toHaveProperty('reporterUserId');

    const repeat = await as(app, 'player-1').post('/api/v1/content-reports', body);
    expect(repeat.status).toBe(200);
    expect(repeat.body.duplicate).toBe(true);

    await as(app, 'player-2').post('/api/v1/content-reports', { ...body, category: 'wording' });
    const mine = await as(app, 'player-1').get('/api/v1/content-reports/mine');
    expect(mine.body.reports).toHaveLength(1);

    const [record] = await auditLog.query({ action: 'content.report_create' });
    expect(record.metadata).toMatchObject({ category: 'wording' });
    expect(JSON.stringify(await auditLog.query({ action: 'content.report_create' }))).not.toContain('Б теж вірно');
  });

  it('validates the body and the revision ↔ question link', async () => {
    const { app, review } = qualityApp();
    await seedQuestion(review);
    expect((await as(app, 'player-1').post('/api/v1/content-reports', { entityType: 'question', entityId: 'q-ark', category: 'bogus' })).status).toBe(400);
    expect(
      (await as(app, 'player-1').post('/api/v1/content-reports', { entityType: 'question', entityId: 'q-ark', category: 'wording', comment: 'x'.repeat(501) })).status,
    ).toBe(400);
    const mismatch = await as(app, 'player-1').post('/api/v1/content-reports', {
      entityType: 'question',
      entityId: 'q-other',
      revisionId: (await review.content.revisions.getPublished('q-ark'))!.id,
      category: 'wording',
    });
    expect(mismatch.status).toBe(400);
    expect(mismatch.body.error.code).toBe('revision_mismatch');
  });

  it('answers 503 without a database rather than losing reports', async () => {
    const { app } = qualityApp({ withRepos: false });
    const res = await as(app, 'player-1').post('/api/v1/content-reports', { entityType: 'question', entityId: 'q', category: 'wording' });
    expect(res.status).toBe(503);
  });
});

describe('/api/v1/studio/quality (Phase 4 WS9, Studio side)', () => {
  it('403s a player', async () => {
    const { app } = qualityApp();
    expect((await as(app, 'player-1').get('/api/v1/studio/quality')).status).toBe(403);
    expect((await as(app, 'player-1').get('/api/v1/studio/quality/reports')).status).toBe(403);
  });

  it('reports available:false without repositories', async () => {
    const { app } = qualityApp({ withRepos: false });
    const res = await as(app, 'reviewer-1').get('/api/v1/studio/quality');
    expect(res.body).toMatchObject({ available: false });
  });

  it('computes distribution + outliers from answers and enriches them with the live revision', async () => {
    const { app, review, answers, quality } = qualityApp();
    const revision = await seedQuestion(review);
    for (let i = 0; i < 30; i += 1) answers.push({ questionId: 'q-ark', isCorrect: i < 3 });
    for (let i = 0; i < 30; i += 1) answers.push({ questionId: 'q-ok', isCorrect: i < 22 });
    await quality.signals.recordPick({ revisionId: revision.id, questionId: 'q-ark', optionIndex: 0, optionCount: 3 });

    const res = await as(app, 'reviewer-1').get('/api/v1/studio/quality');
    expect(res.status).toBe(200);
    expect(res.body.analysis.sampleSize).toBe(2);
    expect(res.body.analysis.outliers).toEqual([
      expect.objectContaining({ questionId: 'q-ark', issue: 'too_hard', revisionId: revision.id, text: 'Хто збудував ковчег?' }),
    ]);
    expect(res.body.positionBias).toMatchObject({ picks: 1, firstOptionShare: 1 });
  });

  it('repairing an outlier needs content:ai:run and a queue, and enqueues content.ai_repair', async () => {
    const { app, review, answers, jobQueue, auditLog } = qualityApp({ withQueue: true });
    await seedQuestion(review);
    for (let i = 0; i < 30; i += 1) answers.push({ questionId: 'q-ark', isCorrect: false });

    const res = await as(app, 'reviewer-1').post('/api/v1/studio/quality/outliers/q-ark/repair');
    expect(res.status).toBe(201);
    const job = await jobQueue!.get(res.body.jobId);
    expect(job).toMatchObject({ type: JOB_TYPES.AI_CONTENT_REPAIR, payload: { questionId: 'q-ark', signal: 'accuracy:too_hard' } });
    expect((job!.payload as { prompt: string }).prompt).toContain('Хто збудував ковчег?');
    expect((await auditLog.query({ action: 'content.repair_request' }))[0]).toMatchObject({ target: 'q-ark' });

    expect((await as(app, 'player-1').post('/api/v1/studio/quality/outliers/q-ark/repair')).status).toBe(403);
    for (let i = 0; i < 30; i += 1) answers.push({ questionId: 'q-fine', isCorrect: i % 4 !== 0 });
    expect((await as(app, 'reviewer-1').post('/api/v1/studio/quality/outliers/q-fine/repair')).status).toBe(409);
  });

  it('repair without a queue is an honest 409', async () => {
    const { app, review, answers } = qualityApp();
    await seedQuestion(review);
    for (let i = 0; i < 30; i += 1) answers.push({ questionId: 'q-ark', isCorrect: false });
    const res = await as(app, 'reviewer-1').post('/api/v1/studio/quality/outliers/q-ark/repair');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('queue_unavailable');
  });

  it('groups reports without reporter ids, resolves them with a revision link, audited', async () => {
    const { app, review, auditLog } = qualityApp();
    const revision = await seedQuestion(review);
    for (const [user, category] of [['player-1', 'wrong_answer'], ['player-2', 'wrong_answer'], ['player-2', 'reference']] as const) {
      await as(app, user).post('/api/v1/content-reports', { entityType: 'question', entityId: 'q-ark', revisionId: revision.id, category, comment: `від ${user}` });
    }

    const groups = await as(app, 'reviewer-1').get('/api/v1/studio/quality/reports');
    expect(groups.body.groups).toEqual([
      expect.objectContaining({ entityId: 'q-ark', openCount: 3, categories: { wrong_answer: 2, reference: 1 }, title: 'Хто збудував ковчег?' }),
    ]);
    const detail = await as(app, 'reviewer-1').get('/api/v1/studio/quality/reports/question/q-ark');
    expect(detail.body.reports).toHaveLength(3);
    expect(JSON.stringify(detail.body)).not.toContain('reporterUserId');

    const bad = await as(app, 'reviewer-1').post('/api/v1/studio/quality/reports/question/q-ark/resolve', { status: 'resolved', revisionId: 'nope' });
    expect(bad.status).toBe(400);
    const ok = await as(app, 'reviewer-1').post('/api/v1/studio/quality/reports/question/q-ark/resolve', {
      status: 'resolved',
      note: 'Уточнили варіанти',
      revisionId: revision.id,
    });
    expect(ok.body).toEqual({ ok: true, closed: 3 });
    expect((await auditLog.query({ action: 'content.report_resolve' }))[0]).toMatchObject({
      actor: { userId: 'reviewer-1' },
      metadata: { closed: 3, resolvedRevisionId: revision.id },
    });
    expect((await as(app, 'reviewer-1').post('/api/v1/studio/quality/reports/question/q-ark/resolve', { status: 'dismissed' })).status).toBe(409);

    const mine = await as(app, 'player-1').get('/api/v1/content-reports/mine');
    expect(mine.body.reports[0]).toMatchObject({ status: 'resolved' });
    expect(mine.body.reports[0]).not.toHaveProperty('resolutionNote');
  });
});
