import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `eventDedup.ts` runs in the browser and reaches for the global
 * `localStorage`; this suite's `environment: 'node'` (see vitest.config.ts)
 * has no such global, so we install a minimal in-memory stand-in before each
 * test and tear it down after, mirroring `resetEventDedupForTests()`'s own
 * "start clean" contract.
 */
function installFakeLocalStorage(): Storage {
  const store = new Map<string, string>();
  const fake: Storage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
  (globalThis as { localStorage?: Storage }).localStorage = fake;
  return fake;
}

describe('consumeEventOnce (ADR-010 §4.3 authoritative-celebration idempotency)', () => {
  beforeEach(() => {
    installFakeLocalStorage();
  });

  afterEach(async () => {
    const { resetEventDedupForTests } = await import('./eventDedup');
    resetEventDedupForTests();
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  it('returns true the first time an event id is seen', async () => {
    const { consumeEventOnce } = await import('./eventDedup');
    expect(consumeEventOnce('level-up:42')).toBe(true);
  });

  it('returns false on every subsequent call for the same id', async () => {
    const { consumeEventOnce } = await import('./eventDedup');
    expect(consumeEventOnce('achievement:first-lesson')).toBe(true);
    expect(consumeEventOnce('achievement:first-lesson')).toBe(false);
    expect(consumeEventOnce('achievement:first-lesson')).toBe(false);
  });

  it('treats distinct ids independently', async () => {
    const { consumeEventOnce } = await import('./eventDedup');
    expect(consumeEventOnce('rank-up:1')).toBe(true);
    expect(consumeEventOnce('rank-up:2')).toBe(true);
    expect(consumeEventOnce('rank-up:1')).toBe(false);
  });

  it('survives a page reload by reading persisted ids back from storage', async () => {
    const storage = installFakeLocalStorage();
    const mod = await import('./eventDedup');
    expect(mod.consumeEventOnce('purchase:success:9')).toBe(true);

    // Simulate a real reload: `vi.resetModules()` forces a fresh module
    // instance with `cache` back at its initial `null`, so this can only
    // pass if the id came from `storage`, not a session-lifetime Set.
    vi.resetModules();
    (globalThis as { localStorage?: Storage }).localStorage = storage;
    const reloaded = await import('./eventDedup');
    expect(reloaded.consumeEventOnce('purchase:success:9')).toBe(false);
  });

  it('degrades to in-memory-only when localStorage throws', async () => {
    (globalThis as { localStorage?: Storage }).localStorage = {
      getItem: () => {
        throw new Error('storage disabled');
      },
      setItem: () => {
        throw new Error('storage disabled');
      },
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    };
    const { consumeEventOnce } = await import('./eventDedup');
    expect(consumeEventOnce('offline:event')).toBe(true);
    expect(consumeEventOnce('offline:event')).toBe(false);
  });
});
