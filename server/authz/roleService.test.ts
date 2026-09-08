import { describe, expect, it, vi } from 'vitest';
import { createMemoryAuditLog } from '../audit';
import { AppError } from '../lib/errors';
import { createInMemoryIdentityRepositories } from '../domains/identity/inMemoryRepository';
import type { RoleResolver } from './roleResolver';
import { createRoleService } from './roleService';

function harness() {
  const repos = createInMemoryIdentityRepositories();
  const auditLog = createMemoryAuditLog();
  const resolver: RoleResolver = {
    resolve: vi.fn(async () => ({ roles: ['user'], permissions: [] })),
    invalidate: vi.fn(),
    invalidateAll: vi.fn(),
  };
  const service = createRoleService({
    roleRepo: repos.roles,
    userRepo: repos.users,
    auditLog,
    resolver,
  });
  return { repos, auditLog, resolver, service };
}

const seedUser = (repos: ReturnType<typeof createInMemoryIdentityRepositories>, id = 'u1') =>
  repos.users.upsertFromIdentity({ id }, { provider: 'telegram', externalId: id });

describe('roleService.grant', () => {
  it('404s for a user that never signed in', async () => {
    const { service } = harness();
    await expect(
      service.grant({ actor: 'root', userId: 'ghost', role: 'support' }),
    ).rejects.toMatchObject({ code: 'user_not_found', httpStatus: 404 });
  });

  it('grants, audits the change and invalidates the resolver cache', async () => {
    const { repos, auditLog, resolver, service } = harness();
    await seedUser(repos);

    await service.grant({ actor: 'root', userId: 'u1', role: 'support', requestId: 'r1' });

    expect(await repos.roles.activeRoles('u1')).toEqual(['user', 'support']);
    expect(resolver.invalidate).toHaveBeenCalledWith('u1');
    const [rec] = auditLog.records;
    expect(rec).toMatchObject({
      action: 'rbac.role_granted',
      target: 'u1',
      actor: { userId: 'root' },
      metadata: { role: 'support', outcome: 'changed' },
    });
  });

  it('a repeat grant is a no-op: audited as such, no second invalidation', async () => {
    const { repos, auditLog, resolver, service } = harness();
    await seedUser(repos);
    await service.grant({ actor: 'root', userId: 'u1', role: 'support' });
    (resolver.invalidate as ReturnType<typeof vi.fn>).mockClear();

    await service.grant({ actor: 'root', userId: 'u1', role: 'support' });

    expect(resolver.invalidate).not.toHaveBeenCalled();
    expect(auditLog.records.at(-1)).toMatchObject({ metadata: { outcome: 'noop' } });
  });
});

describe('roleService.revoke', () => {
  it('revokes, audits and invalidates', async () => {
    const { repos, auditLog, resolver, service } = harness();
    await seedUser(repos);
    await service.grant({ actor: 'root', userId: 'u1', role: 'support' });

    const row = await service.revoke({ actor: 'root', userId: 'u1', role: 'support' });

    expect(row?.revokedBy).toBe('root');
    expect(await repos.roles.activeRoles('u1')).toEqual(['user']);
    expect(resolver.invalidate).toHaveBeenLastCalledWith('u1');
    expect(auditLog.records.at(-1)).toMatchObject({
      action: 'rbac.role_revoked',
      metadata: { role: 'support', outcome: 'changed' },
    });
  });

  it('revoking a role the user does not hold is a clean no-op', async () => {
    const { repos, service, auditLog } = harness();
    await seedUser(repos);
    expect(await service.revoke({ actor: 'root', userId: 'u1', role: 'admin' })).toBeNull();
    expect(auditLog.records.at(-1)).toMatchObject({ metadata: { outcome: 'noop' } });
  });

  it('refuses to let an admin revoke their own admin role', async () => {
    const { repos, service } = harness();
    await seedUser(repos, 'boss');
    await service.grant({ actor: 'boss', userId: 'boss', role: 'admin' });

    await expect(
      service.revoke({ actor: 'boss', userId: 'boss', role: 'admin' }),
    ).rejects.toBeInstanceOf(AppError);
  });
});

describe('roleService.list', () => {
  it('returns active roles and full history', async () => {
    const { repos, service } = harness();
    await seedUser(repos);
    await service.grant({ actor: 'root', userId: 'u1', role: 'support' });
    await service.revoke({ actor: 'root', userId: 'u1', role: 'support' });
    await service.grant({ actor: 'root', userId: 'u1', role: 'admin' });

    const view = await service.list('u1');
    expect(view.roles).toEqual(['user', 'admin']);
    expect(view.history).toHaveLength(2);
  });
});
