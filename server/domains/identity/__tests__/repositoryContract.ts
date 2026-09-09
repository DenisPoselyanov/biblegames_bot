/**
 * Shared identity-repository contract (Phase 2 §10). Run against every adapter
 * (`server/infrastructure/database/repositories/identity.ts` on pglite, and the
 * in-memory peer). Read behaviour must match; the in-memory adapter is exempt
 * only from real transaction support.
 */
import { expect, it } from 'vitest';
import type { IdentityRepositories } from '../repository';

export interface ContractHarness {
  repos: IdentityRepositories;
  /** Called before each `it` with a fresh, empty store. */
  reset: () => Promise<void>;
}

export function runIdentityRepositoryContract(makeHarness: () => Promise<ContractHarness>): void {
  let h: ContractHarness;

  const setup = async (): Promise<IdentityRepositories> => {
    h = await makeHarness();
    await h.reset();
    return h.repos;
  };

  it('upsertFromIdentity inserts then updates the same row', async () => {
    const { users } = await setup();
    const created = await users.upsertFromIdentity(
      { id: 'u1', displayName: 'Ann', username: 'ann' },
      { provider: 'telegram', externalId: '555' },
    );
    expect(created.id).toBe('u1');
    expect(created.accountStatus).toBe('active');

    const updated = await users.upsertFromIdentity(
      { id: 'u1', displayName: 'Ann R.' },
      { provider: 'telegram', externalId: '555' },
    );
    expect(updated.displayName).toBe('Ann R.');
    expect(updated.username).toBe('ann'); // untouched
    expect(updated.createdAt).toBe(created.createdAt);
  });

  it('getByExternalId resolves the bound user and misses cleanly', async () => {
    const { users } = await setup();
    await users.upsertFromIdentity(
      { id: 'u1', displayName: 'Ann' },
      { provider: 'telegram', externalId: '555' },
    );
    const found = await users.getByExternalId({ provider: 'telegram', externalId: '555' });
    expect(found?.id).toBe('u1');
    expect(await users.getByExternalId({ provider: 'telegram', externalId: 'nope' })).toBeNull();
  });

  it('activeRoles always includes the implicit user role', async () => {
    const { users, roles } = await setup();
    await users.upsertFromIdentity({ id: 'u1' }, { provider: 'telegram', externalId: '1' });
    expect(await roles.activeRoles('u1')).toEqual(['user']);
  });

  it('grant is idempotent and revoke removes from the active set', async () => {
    const { users, roles } = await setup();
    await users.upsertFromIdentity({ id: 'u1' }, { provider: 'telegram', externalId: '1' });

    const g1 = await roles.grant({ userId: 'u1', role: 'support', grantedBy: 'admin1' });
    const g2 = await roles.grant({ userId: 'u1', role: 'support', grantedBy: 'admin2' });
    expect(g1.grantedAt).toBe(g2.grantedAt); // second grant is a no-op
    expect(await roles.activeRoles('u1')).toEqual(['user', 'support']);

    const revoked = await roles.revoke({ userId: 'u1', role: 'support', revokedBy: 'admin1' });
    expect(revoked?.revokedBy).toBe('admin1');
    expect(await roles.activeRoles('u1')).toEqual(['user']);

    // revoking again is a clean no-op
    expect(await roles.revoke({ userId: 'u1', role: 'support', revokedBy: 'admin1' })).toBeNull();
  });

  it('preferences upsert is partial and get overlays only set fields (§18.2)', async () => {
    const { users, preferences } = await setup();
    await users.upsertFromIdentity({ id: 'u1' }, { provider: 'telegram', externalId: '1' });

    expect(await preferences.get('u1')).toBeNull();

    const first = await preferences.upsert('u1', { activeTheme: 'dawn', avatar: 'lamb' });
    expect(first).toMatchObject({
      userId: 'u1',
      schemaVersion: 1,
      activeTheme: 'dawn',
      avatar: 'lamb',
      bibleTranslation: null,
    });

    // a partial patch leaves the untouched fields alone
    const second = await preferences.upsert('u1', { bibleTranslation: 'UTT' });
    expect(second.activeTheme).toBe('dawn');
    expect(second.avatar).toBe('lamb');
    expect(second.bibleTranslation).toBe('UTT');

    // an explicit null clears
    const third = await preferences.upsert('u1', { avatar: null });
    expect(third.avatar).toBeNull();
    expect(third.activeTheme).toBe('dawn');

    expect(await preferences.get('u1')).toEqual(third);
  });

  it('re-granting a revoked role reactivates it and history keeps every transition', async () => {
    const { users, roles } = await setup();
    await users.upsertFromIdentity({ id: 'u1' }, { provider: 'telegram', externalId: '1' });

    await roles.grant({ userId: 'u1', role: 'admin', grantedBy: 'root' });
    await roles.revoke({ userId: 'u1', role: 'admin', revokedBy: 'root' });
    const regranted = await roles.grant({ userId: 'u1', role: 'admin', grantedBy: 'root2' });
    expect(regranted.revokedAt).toBeNull();
    expect(await roles.activeRoles('u1')).toEqual(['user', 'admin']);

    const history = await roles.history('u1');
    expect(history).toHaveLength(1); // one row per (user, role), current state
    expect(history[0].grantedBy).toBe('root2');
  });
}
