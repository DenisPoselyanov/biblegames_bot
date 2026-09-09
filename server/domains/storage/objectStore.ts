/**
 * `ObjectStore` — the blob-storage abstraction (Phase 2 §19, ref-arch §3.6).
 *
 * The platform's approved home for **outputs**: published-content snapshots
 * (§14), and later export bundles and raw AI artifacts (Phase 4) and media.
 * Never a competing source of truth — a snapshot written here is regenerated
 * from the canonical store, never read back as a repository (§25).
 *
 * Adapters: `server/infrastructure/storage/filesystemObjectStore.ts` (default,
 * single-VPS), `memoryObjectStore.ts` (tests), and an S3-compatible adapter for
 * the scale path. This module is pure — no `fs`, no network.
 */

export interface PutOptions {
  /** MIME type stored alongside the object and returned by `head`/`get`. */
  contentType?: string;
  /** Small, non-secret key/value pairs (e.g. `{ contentHash, generatedAt }`). */
  metadata?: Record<string, string>;
}

export interface ObjectInfo {
  key: string;
  size: number;
  contentType: string;
  /** Strong validator — the adapter's content hash (hex sha-256 for FS/memory). */
  etag: string;
  lastModified: string;
  metadata: Record<string, string>;
}

export interface GotObject extends ObjectInfo {
  body: Buffer;
}

export interface ObjectStore {
  put(key: string, body: Buffer | string, options?: PutOptions): Promise<ObjectInfo>;
  get(key: string): Promise<GotObject | null>;
  head(key: string): Promise<ObjectInfo | null>;
  delete(key: string): Promise<void>;
  /** Keys under `prefix`, lexicographically sorted. */
  list(prefix?: string): Promise<string[]>;
}

/** Object keys are `/`-separated, no leading slash, no `.` / `..` segments. */
export function assertValidObjectKey(key: string): void {
  if (!key || key.startsWith('/') || key.endsWith('/')) {
    throw new Error(`invalid object key: ${JSON.stringify(key)}`);
  }
  const segments = key.split('/');
  if (segments.some((s) => s === '' || s === '.' || s === '..')) {
    throw new Error(`invalid object key: ${JSON.stringify(key)}`);
  }
}
