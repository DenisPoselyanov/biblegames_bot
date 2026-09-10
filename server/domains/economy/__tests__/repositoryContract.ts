/**
 * Shared economy-repository contract (Phase 2 §10, ADR-016). Run against every
 * adapter (`server/infrastructure/database/repositories/economy.ts` on pglite,
 * and the in-memory peer). Read behaviour must match; the in-memory adapter is
 * exempt only from real transaction support.
 */
import { expect, it } from 'vitest';
import type { EconomyRepositories } from '../entitlements';

export interface EconomyContractHarness {
  repos: EconomyRepositories;
  /** Ensure a `users` row exists (the SQL adapter has an FK; the peer is a no-op). */
  ensureUser: (id: string) => Promise<void>;
  /** Called before each `it` with a fresh, empty store. */
  reset: () => Promise<void>;
}

export function runEconomyRepositoryContract(
  makeHarness: () => Promise<EconomyContractHarness>,
): void {
  let h: EconomyContractHarness;

  const setup = async (): Promise<EconomyRepositories> => {
    h = await makeHarness();
    await h.reset();
    await h.ensureUser('u1');
    return h.repos;
  };

  it('grant creates an active row and is idempotent on (sourceType, sourceId)', async () => {
    const { entitlements } = await setup();

    const first = await entitlements.grant({
      userId: 'u1',
      productId: 'dawn',
      productKind: 'theme',
      sourceType: 'purchase',
      sourceId: 'shop.theme:dawn',
    });
    expect(first).toMatchObject({
      userId: 'u1',
      productId: 'dawn',
      productKind: 'theme',
      status: 'active',
      revokedAt: null,
    });

    const replay = await entitlements.grant({
      userId: 'u1',
      productId: 'dawn',
      productKind: 'theme',
      sourceType: 'purchase',
      sourceId: 'shop.theme:dawn',
    });
    expect(replay.id).toBe(first.id);
    expect(replay.grantedAt).toBe(first.grantedAt);

    expect(await entitlements.list('u1')).toHaveLength(1);
  });

  it('a second live grant for the same (user, product) is rejected', async () => {
    const { entitlements } = await setup();
    await entitlements.grant({
      userId: 'u1',
      productId: 'dawn',
      productKind: 'theme',
      sourceType: 'purchase',
      sourceId: 'shop.theme:dawn',
    });
    await expect(
      entitlements.grant({
        userId: 'u1',
        productId: 'dawn',
        productKind: 'theme',
        sourceType: 'grant',
        sourceId: 'admin:dawn:1',
      }),
    ).rejects.toThrow();
  });

  it('findBySource hits and misses cleanly', async () => {
    const { entitlements } = await setup();
    await entitlements.grant({
      userId: 'u1',
      productId: 'lamb',
      productKind: 'avatar',
      sourceType: 'migration',
      sourceId: 'migration:u1:lamb',
    });
    const hit = await entitlements.findBySource('migration', 'migration:u1:lamb');
    expect(hit?.productId).toBe('lamb');
    expect(await entitlements.findBySource('migration', 'nope')).toBeNull();
  });

  it('revoke sets status/revoked_at, is idempotent, and frees the product for a re-grant', async () => {
    const { entitlements } = await setup();
    await entitlements.grant({
      userId: 'u1',
      productId: 'dawn',
      productKind: 'theme',
      sourceType: 'purchase',
      sourceId: 'shop.theme:dawn',
    });

    const revoked = await entitlements.revoke({ userId: 'u1', productId: 'dawn', revokedBy: 'admin' });
    expect(revoked?.status).toBe('revoked');
    expect(revoked?.revokedAt).not.toBeNull();
    expect(revoked?.revokedBy).toBe('admin');

    // revoking again is a clean no-op
    expect(await entitlements.revoke({ userId: 'u1', productId: 'dawn', revokedBy: 'admin' })).toBeNull();

    // the live-product uniqueness only counts non-revoked rows
    const regranted = await entitlements.grant({
      userId: 'u1',
      productId: 'dawn',
      productKind: 'theme',
      sourceType: 'purchase',
      sourceId: 'shop.theme:dawn:2',
    });
    expect(regranted.status).toBe('active');
  });

  it('listActive excludes revoked and expired grants', async () => {
    const { entitlements } = await setup();
    const now = new Date('2026-06-01T00:00:00.000Z');

    await entitlements.grant({
      userId: 'u1',
      productId: 'dawn',
      productKind: 'theme',
      sourceType: 'purchase',
      sourceId: 'shop.theme:dawn',
    });
    await entitlements.grant({
      userId: 'u1',
      productId: 'dusk',
      productKind: 'theme',
      sourceType: 'grant',
      sourceId: 'promo:dusk',
      expiresAt: '2026-01-01T00:00:00.000Z',
    });
    await entitlements.grant({
      userId: 'u1',
      productId: 'lamb',
      productKind: 'avatar',
      sourceType: 'purchase',
      sourceId: 'shop.avatar:lamb',
    });
    await entitlements.revoke({ userId: 'u1', productId: 'lamb', revokedBy: 'admin' });

    const active = await entitlements.listActive('u1', now);
    expect(active.map((e) => e.productId).sort()).toEqual(['dawn']);
  });
}
