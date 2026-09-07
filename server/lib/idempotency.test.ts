import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createJsonIdempotencyStore, createMemoryIdempotencyStore } from './idempotency';

let dir: string;
let file: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'idem-'));
  file = join(dir, 'idempotency.json');
});

afterEach(() => {
  vi.useRealTimers();
  rmSync(dir, { recursive: true, force: true });
});

describe('idempotency store (json)', () => {
  it('recalls a remembered result', async () => {
    const store = createJsonIdempotencyStore(file);
    await store.remember('k1', { outcome: 42 });
    expect((await store.recall('k1'))?.result).toEqual({ outcome: 42 });
    expect(await store.recall('missing')).toBeNull();
  });

  it('expires entries older than the TTL', async () => {
    vi.useFakeTimers();
    const store = createJsonIdempotencyStore(file);
    await store.remember('k1', { v: 1 });
    vi.setSystemTime(Date.now() + 25 * 60 * 60 * 1000);
    expect(await store.recall('k1')).toBeNull();
  });
});

describe('idempotency store (memory)', () => {
  it('round-trips', async () => {
    const store = createMemoryIdempotencyStore();
    await store.remember('a', 'b');
    expect((await store.recall('a'))?.result).toBe('b');
  });
});
