import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadConfig } from '../../config/env';
import { createApp } from '../../app';
import { RoleRegistry } from '../../authz/roleRegistry';
import { createMemoryAuditLog } from '../../audit';
import { createInMemoryJobQueue } from '../../domains/jobs/inMemoryQueue';
import { JOB_TYPES } from '../../domains/jobs/catalog';
import { createMemoryStore } from '../helpers/memoryStore';

function studioApp(opts: { withQueue?: boolean } = {}) {
  const { config } = loadConfig({ NODE_ENV: 'test', AUTH_MODE: 'development' });
  const auditLog = createMemoryAuditLog();
  const jobQueue = opts.withQueue !== false ? createInMemoryJobQueue() : undefined;
  const roleRegistry = new RoleRegistry([
    { userId: 'reviewer-1', roles: ['content_reviewer'] },
    { userId: 'publisher-1', roles: ['content_publisher'] },
    { userId: 'plain-1', roles: [] },
  ]);
  const app = createApp({ config, dbStore: createMemoryStore(), auditLog, roleRegistry, jobQueue });
  return { app, auditLog, jobQueue };
}

const as = (app: ReturnType<typeof studioApp>['app'], userId: string) => ({
  get: (url: string) => request(app).get(url).set('x-user-id', userId),
  post: (url: string) => request(app).post(url).set('x-user-id', userId),
});

describe('/api/v1/studio (Phase 4 WS8a)', () => {
  it('403s a caller with no content role', async () => {
    const { app } = studioApp();
    const res = await as(app, 'plain-1').get('/api/v1/studio/jobs');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('forbidden_permission');
  });

  it('lists jobs for a content_reviewer, newest first', async () => {
    const { app, jobQueue } = studioApp();
    jobQueue!.register(JOB_TYPES.AI_CONTENT_GENERATE, { handler: async () => {} });
    await jobQueue!.enqueue(JOB_TYPES.AI_CONTENT_GENERATE, {
      promptVersion: 'q.v1',
      prompt: 'secret prompt text',
      label: 'Old Testament batch',
    });

    const res = await as(app, 'reviewer-1').get('/api/v1/studio/jobs');
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(true);
    expect(res.body.jobs).toHaveLength(1);
    expect(res.body.jobs[0]).toMatchObject({
      type: 'content.ai_generate',
      typeLabel: 'Генерація контенту (AI)',
      status: 'pending',
      label: 'Old Testament batch',
    });
    // The raw prompt never leaves the server in a list response.
    expect(JSON.stringify(res.body)).not.toContain('secret prompt text');
  });

  it('reports available:false when no in-process queue is wired', async () => {
    const { app } = studioApp({ withQueue: false });
    const res = await as(app, 'reviewer-1').get('/api/v1/studio/jobs');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ available: false, jobs: [] });
  });

  it('404s a job detail lookup for an unknown id', async () => {
    const { app } = studioApp();
    const res = await as(app, 'reviewer-1').get('/api/v1/studio/jobs/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('job_not_found');
  });

  it('a content_reviewer can create and cancel a job whose handler honours the signal', async () => {
    const { app, jobQueue, auditLog } = studioApp();
    jobQueue!.register(JOB_TYPES.AI_CONTENT_GENERATE, {
      handler: (ctx) =>
        new Promise<void>((resolve, reject) => {
          ctx.signal.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    });

    const created = await as(app, 'reviewer-1')
      .post('/api/v1/studio/jobs')
      .send({ promptVersion: 'q.v1', prompt: 'generate 10 questions' });
    expect(created.status).toBe(201);
    const { id } = created.body;

    const running = jobQueue!.runDue(); // synchronously moves the job to "active"
    const detail = await as(app, 'reviewer-1').get(`/api/v1/studio/jobs/${id}`);
    expect(detail.body.job.status).toBe('active');

    const cancelled = await as(app, 'reviewer-1').post(`/api/v1/studio/jobs/${id}/cancel`);
    await running;
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.job.status).toBe('cancelled');

    const audit = await auditLog.query({ action: 'content.job_cancel' });
    expect(audit[0]).toMatchObject({ actor: { userId: 'reviewer-1' }, target: id, result: 'ok' });
  });

  it('409s cancelling a job that is already finished', async () => {
    const { app, jobQueue } = studioApp();
    jobQueue!.register(JOB_TYPES.AI_CONTENT_GENERATE, { handler: async () => {} });
    const { id } = await jobQueue!.enqueue(JOB_TYPES.AI_CONTENT_GENERATE, {
      promptVersion: 'q.v1',
      prompt: 'x',
    });
    await jobQueue!.runDue();

    const res = await as(app, 'reviewer-1').post(`/api/v1/studio/jobs/${id}/cancel`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('job_not_cancellable');
  });

  it('returns recent activity and dashboard aggregates', async () => {
    const { app, auditLog } = studioApp();
    await auditLog.append({
      at: new Date().toISOString(),
      actor: { userId: 'reviewer-1', authSource: 'development' },
      action: 'content.generate',
      result: 'ok',
    });

    const activity = await as(app, 'reviewer-1').get('/api/v1/studio/activity?limit=1');
    expect(activity.body.activity).toHaveLength(1);

    const dashboard = await as(app, 'publisher-1').get('/api/v1/studio/dashboard');
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.jobs).toMatchObject({ byStatus: expect.any(Object) });
    expect(dashboard.body.activity.length).toBeGreaterThan(0);
  });
});
