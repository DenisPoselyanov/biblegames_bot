/**
 * Shared `RateLimitStore` contract (Phase 2 WS2 part 4). Run against every
 * adapter — the in-memory store and the Postgres store on pglite — so the
 * fixed-window semantics stay identical no matter where counters live.
 */
import { expect, it } from 'vitest';
import type { RateLimitStore } from './rateLimitStore';

export interface RateLimitStoreHarness {
  /** A store whose clock is `clock()` below. */
  store: RateLimitStore;
  /** Current mock time in ms. */
  clock: () => number;
  /** Advance the mock clock. */
  advance: (ms: number) => void;
  /** Fresh, empty store state before each `it`. */
  reset: () => Promise<void>;
}

export function runRateLimitStoreContract(
  makeHarness: () => Promise<RateLimitStoreHarness>,
): void {
  const setup = async (): Promise<RateLimitStoreHarness> => {
    const h = await makeHarness();
    await h.reset();
    return h;
  };

  it('allows up to max, then trips with a positive retry-after', async () => {
    const { store } = await setup();
    for (let i = 0; i < 3; i += 1) {
      expect((await store.hit({ name: 't', key: 'k', windowMs: 60_000, max: 3 })).ok).toBe(true);
    }
    const tripped = await store.hit({ name: 't', key: 'k', windowMs: 60_000, max: 3 });
    expect(tripped.ok).toBe(false);
    expect(tripped.retryAfterSec).toBeGreaterThan(0);
    expect(tripped.retryAfterSec).toBeLessThanOrEqual(60);
  });

  it('keeps keys and policy names independent', async () => {
    const { store } = await setup();
    expect((await store.hit({ name: 't', key: 'a', windowMs: 60_000, max: 1 })).ok).toBe(true);
    expect((await store.hit({ name: 't', key: 'b', windowMs: 60_000, max: 1 })).ok).toBe(true);
    expect((await store.hit({ name: 'other', key: 'a', windowMs: 60_000, max: 1 })).ok).toBe(true);
    expect((await store.hit({ name: 't', key: 'a', windowMs: 60_000, max: 1 })).ok).toBe(false);
  });

  it('rolls the window once it elapses', async () => {
    const { store, advance } = await setup();
    expect((await store.hit({ name: 't', key: 'k', windowMs: 1_000, max: 1 })).ok).toBe(true);
    expect((await store.hit({ name: 't', key: 'k', windowMs: 1_000, max: 1 })).ok).toBe(false);
    advance(1_100);
    expect((await store.hit({ name: 't', key: 'k', windowMs: 1_000, max: 1 })).ok).toBe(true);
  });

  it('does not roll the window early on a rejected hit', async () => {
    const { store, advance } = await setup();
    await store.hit({ name: 't', key: 'k', windowMs: 10_000, max: 1 });
    advance(4_000);
    const tripped = await store.hit({ name: 't', key: 'k', windowMs: 10_000, max: 1 });
    expect(tripped.ok).toBe(false);
    // ~6s left in the original window, not a fresh 10s.
    expect(tripped.retryAfterSec).toBeLessThanOrEqual(6);
  });

  it('reset clears every counter', async () => {
    const { store, reset } = await setup();
    await store.hit({ name: 't', key: 'k', windowMs: 60_000, max: 1 });
    expect((await store.hit({ name: 't', key: 'k', windowMs: 60_000, max: 1 })).ok).toBe(false);
    await reset();
    expect((await store.hit({ name: 't', key: 'k', windowMs: 60_000, max: 1 })).ok).toBe(true);
  });
}
