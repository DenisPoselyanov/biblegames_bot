import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadConfig } from '../../config/env';
import { createApp } from '../../app';
import { RoleRegistry } from '../../authz/roleRegistry';
import { createMemoryAuditLog } from '../../audit';
import { createQuestionsAdminRouter } from '../../routes/questionsAdmin';
import { errorHandler } from '../../middleware/errorHandler';
import { createMemoryStore } from '../helpers/memoryStore';

afterEach(() => {
  delete process.env.FEATURE_RBACV2;
  delete process.env.QUESTION_ADMIN_ENABLED;
});

function devApp(opts: { admins?: string[]; env?: Record<string, string> } = {}) {
  const { config } = loadConfig({ NODE_ENV: 'test', AUTH_MODE: 'development', ...opts.env });
  const auditLog = createMemoryAuditLog();
  const roleRegistry = new RoleRegistry((opts.admins ?? []).map((userId) => ({ userId, roles: ['admin'] })));
  const app = createApp({ config, dbStore: createMemoryStore(), auditLog, roleRegistry });
  return { app, auditLog };
}

describe('RBAC — admin question routes', () => {
  it('403s an authenticated non-admin and audits the denial', async () => {
    const { app, auditLog } = devApp({ admins: ['500'] });
    const res = await request(app)
      .put('/api/admin/questions/q-123')
      .set('x-user-id', '999')
      .send({ text: 'edited' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('forbidden_permission');

    const denied = await auditLog.query({ action: 'authz.denied' });
    expect(denied).toHaveLength(1);
    expect(denied[0].actor.userId).toBe('999');
  });

  it('lets an admin through to the handler and audits the mutation', async () => {
    const { app, auditLog } = devApp({ admins: ['500'] });
    const res = await request(app)
      .put('/api/admin/questions/does-not-exist')
      .set('x-user-id', '500')
      .send({ text: 'edited' });

    // The permission check passed; the handler ran and failed to find the id.
    expect(res.status).not.toBe(403);
    const records = await auditLog.query({ action: 'question.update' });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ actor: { userId: '500' }, target: 'does-not-exist' });
  });

  it('401s when unauthenticated', async () => {
    const { app } = devApp();
    const res = await request(app).put('/api/admin/questions/q-1').send({ text: 'x' });
    expect(res.status).toBe(401);
  });

  it('FEATURE_RBACV2=false lets any authenticated user through (break-glass)', async () => {
    process.env.FEATURE_RBACV2 = 'false';
    const { app } = devApp({ admins: ['500'] });
    const res = await request(app)
      .put('/api/admin/questions/does-not-exist')
      .set('x-user-id', '999')
      .send({ text: 'edited' });
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(401);
  });
});

describe('self-scoped /api/v1/me', () => {
  it('reports roles and permissions for the caller', async () => {
    const { app } = devApp({ admins: ['500'] });
    const res = await request(app).get('/api/v1/me').set('x-user-id', '500');
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('500');
    expect(res.body.roles).toContain('admin');
    expect(res.body.permissions).toContain('questions:admin');
  });

  it('a plain user gets the user role only', async () => {
    const { app } = devApp();
    const res = await request(app).get('/api/v1/me').set('x-user-id', '7');
    expect(res.body.roles).toEqual(['user']);
    expect(res.body.permissions).toEqual([]);
  });

  it('serves and updates the caller profile with no :userId in the path', async () => {
    const { app } = devApp();
    const empty = await request(app).get('/api/v1/me/profile').set('x-user-id', '7');
    expect(empty.status).toBe(200);
    expect(empty.body.userId).toBe('7');

    await request(app)
      .put('/api/v1/me/profile')
      .set('x-user-id', '7')
      .send({ displayName: 'Grace' })
      .expect(200);

    const after = await request(app).get('/api/v1/me/profile').set('x-user-id', '7');
    expect(after.body.displayName).toBe('Grace');
  });

  it('401s without an identity', async () => {
    const { app } = devApp();
    await request(app).get('/api/v1/me').expect(401);
  });
});

describe('questions admin router — production FS-write guard', () => {
  function mount(env: Record<string, string>) {
    process.env.QUESTION_ADMIN_ENABLED = 'true';
    const { config } = loadConfig({
      NODE_ENV: 'production',
      AUTH_MODE: 'telegram',
      TELEGRAM_BOT_TOKEN: 'x',
      CLIENT_ORIGIN: 'https://app.example.com',
      ...env,
    });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.auth = { userId: '500', authSource: 'telegram' } as (typeof req)['auth'];
      next();
    });
    app.use('/q', createQuestionsAdminRouter({ auditLog: createMemoryAuditLog(), config }));
    app.use(errorHandler);
    return app;
  }

  it('403s a direct write in production by default', async () => {
    const res = await request(mount({})).put('/q/q-1').send({ text: 'edited' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('question_admin_fs_write_disabled');
  });

  it('allows it when QUESTION_ADMIN_FS_WRITES=true', async () => {
    const res = await request(mount({ QUESTION_ADMIN_FS_WRITES: 'true' }))
      .put('/q/does-not-exist')
      .send({ text: 'edited' });
    expect(res.status).not.toBe(403);
  });
});
