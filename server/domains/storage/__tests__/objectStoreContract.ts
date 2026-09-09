/**
 * Shared `ObjectStore` contract (Phase 2 §19). Every adapter must satisfy it:
 * the filesystem adapter and the in-memory peer here; the S3 adapter against a
 * live MinIO in a manual/integration lane.
 */
import { expect, it } from 'vitest';
import type { ObjectStore } from '../objectStore';

export function runObjectStoreContract(makeStore: () => Promise<ObjectStore>): void {
  it('round-trips a body with content type and metadata', async () => {
    const store = await makeStore();
    const info = await store.put('snapshots/set-a/v1.json', '{"ok":true}', {
      contentType: 'application/json',
      metadata: { contentHash: 'abc', questionCount: '3' },
    });
    expect(info.size).toBe(11);
    expect(info.contentType).toBe('application/json');
    expect(info.etag).toMatch(/^[a-f0-9]{64}$/);

    const got = await store.get('snapshots/set-a/v1.json');
    expect(got?.body.toString('utf8')).toBe('{"ok":true}');
    expect(got?.contentType).toBe('application/json');
    expect(got?.metadata).toEqual({ contentHash: 'abc', questionCount: '3' });
    expect(got?.etag).toBe(info.etag);
  });

  it('head returns info without the body; missing keys are null', async () => {
    const store = await makeStore();
    await store.put('a/b.txt', 'hi');
    const head = await store.head('a/b.txt');
    expect(head?.size).toBe(2);
    expect('body' in (head as object)).toBe(false);

    expect(await store.head('nope')).toBeNull();
    expect(await store.get('nope')).toBeNull();
  });

  it('overwrites in place and updates the etag', async () => {
    const store = await makeStore();
    const first = await store.put('k', 'one');
    const second = await store.put('k', 'two');
    expect(second.etag).not.toBe(first.etag);
    expect((await store.get('k'))?.body.toString('utf8')).toBe('two');
  });

  it('deletes idempotently', async () => {
    const store = await makeStore();
    await store.put('gone', 'x');
    await store.delete('gone');
    await store.delete('gone');
    expect(await store.get('gone')).toBeNull();
  });

  it('lists keys under a prefix, sorted', async () => {
    const store = await makeStore();
    await store.put('snapshots/s1/latest.json', '{}');
    await store.put('snapshots/s1/aaa.json', '{}');
    await store.put('snapshots/s2/latest.json', '{}');
    await store.put('other/x', '{}');

    expect(await store.list('snapshots/s1/')).toEqual([
      'snapshots/s1/aaa.json',
      'snapshots/s1/latest.json',
    ]);
    expect((await store.list()).length).toBe(4);
  });

  it('rejects unsafe keys', async () => {
    const store = await makeStore();
    await expect(store.put('/leading', 'x')).rejects.toThrow(/invalid object key/i);
    await expect(store.put('a/../b', 'x')).rejects.toThrow(/invalid object key/i);
    await expect(store.put('a//b', 'x')).rejects.toThrow(/invalid object key/i);
  });
}
