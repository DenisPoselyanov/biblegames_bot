import { describe, expect, it, vi } from 'vitest';
import { createInMemoryIdentityRepositories } from '../domains/identity/inMemoryRepository';
import { RoleRegistry } from './roleRegistry';
import { createConfigRoleResolver, createPersistedRoleResolver } from './roleResolver';

const floor = (grants: { userId: string; roles: Array<'admin' | 'support'> }[] = []) =>
  new RoleRegistry(grants);

describe('createConfigRoleResolver', () => {
  it('mirrors the registry and treats invalidate as a no-op', async () => {
    const resolver = createConfigRoleResolver(floor([{ userId: 'a', roles: ['admin'] }]));
    expect(await resolver.resolve('a')).toEqual({
      roles: ['user', 'admin'],
      permissions: expect.arrayContaining(['questions:admin']),
    });
    expect(await resolver.resolve('b')).toEqual({ roles: ['user'], permissions: [] });
    resolver.invalidate('a'); // does not throw
  });
});

describe('createPersistedRoleResolver', () => {
  it('unions the persisted set with the config floor', async () => {
    const { roles } = createInMemoryIdentityRepositories();
    await roles.grant({ userId: 'u1', role: 'support', grantedBy: 'root' });
    const resolver = createPersistedRoleResolver({
      roleRepo: roles,
      floor: floor([{ userId: 'u1', roles: ['admin'] }]),
    });

    const resolved = await resolver.resolve('u1');
    expect(resolved.roles).toEqual(['user', 'support', 'admin']);
  });

  it('caches within the TTL and refetches after invalidate', async () => {
    const { roles } = createInMemoryIdentityRepositories();
    const spy = vi.spyOn(roles, 'activeRoles');
    const resolver = createPersistedRoleResolver({ roleRepo: roles, floor: floor(), ttlMs: 10_000 });

    await resolver.resolve('u1');
    await resolver.resolve('u1');
    expect(spy).toHaveBeenCalledTimes(1); // second read served from cache

    await roles.grant({ userId: 'u1', role: 'support', grantedBy: 'root' });
    resolver.invalidate('u1');
    expect((await resolver.resolve('u1')).roles).toEqual(['user', 'support']);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('expires the cache entry once the TTL elapses', async () => {
    const { roles } = createInMemoryIdentityRepositories();
    const spy = vi.spyOn(roles, 'activeRoles');
    let ms = 0;
    const resolver = createPersistedRoleResolver({
      roleRepo: roles,
      floor: floor(),
      ttlMs: 1_000,
      now: () => new Date(ms),
    });

    await resolver.resolve('u1');
    ms = 1_500;
    await resolver.resolve('u1');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('degrades to the config floor when the store read throws and does not cache it', async () => {
    const { roles } = createInMemoryIdentityRepositories();
    const spy = vi
      .spyOn(roles, 'activeRoles')
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce(['user', 'support']);
    const resolver = createPersistedRoleResolver({
      roleRepo: roles,
      floor: floor([{ userId: 'u1', roles: ['admin'] }]),
    });

    expect((await resolver.resolve('u1')).roles).toEqual(['user', 'admin']); // floor only
    expect((await resolver.resolve('u1')).roles).toEqual(['user', 'support', 'admin']); // recovered
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
