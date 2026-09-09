/**
 * In-memory `ObjectStore` (Phase 2 §19) — tests only.
 */
import { createHash } from 'node:crypto';
import {
  assertValidObjectKey,
  type GotObject,
  type ObjectInfo,
  type ObjectStore,
  type PutOptions,
} from '../../domains/storage/objectStore';

interface Entry {
  body: Buffer;
  info: ObjectInfo;
}

export function createMemoryObjectStore(now: () => Date = () => new Date()): ObjectStore {
  const entries = new Map<string, Entry>();

  return {
    async put(key, body, options: PutOptions = {}) {
      assertValidObjectKey(key);
      const buf = Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8');
      const info: ObjectInfo = {
        key,
        size: buf.byteLength,
        contentType: options.contentType ?? 'application/octet-stream',
        etag: createHash('sha256').update(buf).digest('hex'),
        lastModified: now().toISOString(),
        metadata: { ...(options.metadata ?? {}) },
      };
      entries.set(key, { body: buf, info });
      return info;
    },

    async get(key): Promise<GotObject | null> {
      const entry = entries.get(key);
      return entry ? { ...entry.info, body: Buffer.from(entry.body) } : null;
    },

    async head(key) {
      return entries.get(key)?.info ?? null;
    },

    async delete(key) {
      entries.delete(key);
    },

    async list(prefix = '') {
      return [...entries.keys()].filter((k) => k.startsWith(prefix)).sort();
    },
  };
}
