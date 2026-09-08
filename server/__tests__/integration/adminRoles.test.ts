import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadConfig } from '../../config/env';
import { createApp } from '../../app';
import { RoleRegistry } from '../../authz/roleRegistry';
import { createMemoryAuditLog } from '../../audit';
import { createInMemoryIdentityRepositories } from '../../domains/identity/inMemoryRepository';
import { createMemoryStore } from '../helpers/memoryStore';

function persistedApp() {
  const { config } = loadConfig({ NODE_ENV: 'test', AUTH_MODE: 'development' });
  const auditLog = createMemoryAuditLog();
  const identity = createInMemoryIdentityRepositories();
  // '500' is admin via the config floor only (never signed in).
  const roleRegistry = new RoleRegistry([{ userId: '500', roles: ['admin'] }]);
  const app = createApp({
    config,
    dbStore: createMemoryStore(),
    auditLog,
    roleRegistry,
    identity,
  });
  return { app, auditLog, identity };
}

const asAdmin = (app: ReturnType<typeof persistedApp>['app'], m: 'get' | 'post' | 'delete', url: string) =>
  request(app)[m](url).set('x-user-id', '500');

describe('/api/v1/admin/roles (persisted RBAC)', () => {
  it('403s a non-admin caller', async () => {
    const { app } = persistedApp();
    const res = await request(app).get('/api/v1/admin/roles/u1').set('x-user-id', '999');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('forbidden_role');
  });

  it('grants a role, reflects it in the history and in the target’s own /me', async () => {
    const { app, identity, auditLog } = persistedApp();
    await identity.users.upsertFromIdentity({ id: 'u1' }, { provider: 'telegram', externalId: 'u1' });

    const granted = await asAdmin(app, 'post', '/api/v1/admin/roles/u1').send({ role: 'support' });
    expect(granted.status).toBe(201);
    expect(granted.body.grant).toMatchObject({ userId: 'u1', role: 'support', grantedBy: '500' });

    const list = await asAdmin(app, 'get', '/api/v1/admin/roles/u1');
    expect(list.body.roles).toEqual(['user', 'support']);
    expect(list.body.history).toHaveLength(1);

    // The resolver was invalidated — u1 sees the new role on the next request.
    const me = await request(app).get('/api/v1/me').set('x-user-id', 'u1');
    expect(me.body.roles).toEqual(['user', 'support']);
    expect(me.body.permissions).toContain('users:manage');

    const audit = await auditLog.query({ action: 'rbac.role_granted' });
    expect(audit[0]).toMatchObject({ actor: { userId: '500' }, target: 'u1' });
  });

  it('revokes a role', async () => {
    const { app, identity } = persistedApp();
    await identity.users.upsertFromIdentity({ id: 'u1' }, { provider: 'telegram', externalId: 'u1' });
    await asAdmin(app, 'post', '/api/v1/admin/roles/u1').send({ role: 'support' });

    const revoked = await asAdmin(app, 'delete', '/api/v1/admin/roles/u1/support');
    expect(revoked.status).toBe(200);
    expect(revoked.body.revoked).toMatchObject({ role: 'support', revokedBy: '500' });

    const me = await request(app).get('/api/v1/me').set('x-user-id', 'u1');
    expect(me.body.roles).toEqual(['user']);
  });

  it('rejects an unknown role name', async () => {
    const { app, identity } = persistedApp();
    await identity.users.upsertFromIdentity({ id: 'u1' }, { provider: 'telegram', externalId: 'u1' });
    const res = await asAdmin(app, 'post', '/api/v1/admin/roles/u1').send({ role: 'wizard' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_role');
  });

  it('404s a grant to a user that never signed in', async () => {
    const { app } = persistedApp();
    const res = await asAdmin(app, 'post', '/api/v1/admin/roles/ghost').send({ role: 'support' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('user_not_found');
  });

  it('a plain authenticated request registers the user so a later grant lands', async () => {
    const { app } = persistedApp();
    // No manual upsertFromIdentity — the authed chain persists u9 on first request.
    await request(app).get('/api/v1/me').set('x-user-id', 'u9').expect(200);

    const granted = await asAdmin(app, 'post', '/api/v1/admin/roles/u9').send({ role: 'support' });
    expect(granted.status).toBe(201);
    expect(granted.body.grant).toMatchObject({ userId: 'u9', role: 'support' });
  });

  it('404s a revoke against a user that never signed in', async () => {
    const { app } = persistedApp();
    const res = await asAdmin(app, 'delete', '/api/v1/admin/roles/ghost/support');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('user_not_found');
  });

  it('refuses a self-revoke of admin', async () => {
    const { app } = persistedApp();
    const res = await asAdmin(app, 'delete', '/api/v1/admin/roles/500/admin');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('cannot_revoke_own_admin');
  });

  it('is not mounted without a persisted identity store', async () => {
    const { config } = loadConfig({ NODE_ENV: 'test', AUTH_MODE: 'development' });
    const app = createApp({
      config,
      dbStore: createMemoryStore(),
      roleRegistry: new RoleRegistry([{ userId: '500', roles: ['admin'] }]),
    });
    const res = await request(app).get('/api/v1/admin/roles/u1').set('x-user-id', '500');
    expect(res.status).toBe(404);
  });
});
