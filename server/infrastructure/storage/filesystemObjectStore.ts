/**
 * Filesystem `ObjectStore` (Phase 2 §19) — the default adapter.
 *
 * Objects live under a root directory (one file per key, plus a `<key>.meta`
 * JSON sidecar for content-type + metadata + etag). Writes are atomic
 * (temp-file + `rename`, same primitive as the JSON stores, ADR-006). This is
 * the single-VPS home for content snapshots; the S3 adapter is the scale path.
 */
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { randomBytes } from 'node:crypto';
import {
  assertValidObjectKey,
  type GotObject,
  type ObjectInfo,
  type ObjectStore,
  type PutOptions,
} from '../../domains/storage/objectStore';

interface Sidecar {
  contentType: string;
  etag: string;
  lastModified: string;
  metadata: Record<string, string>;
}

function writeAtomic(path: string, body: Buffer): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const tmp = `${path}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  writeFileSync(tmp, body);
  renameSync(tmp, path);
}

export function createFilesystemObjectStore(rootDir: string): ObjectStore {
  const root = resolve(rootDir);

  const pathFor = (key: string): string => {
    assertValidObjectKey(key);
    const full = resolve(root, key);
    if (full !== root && !full.startsWith(root + sep)) {
      throw new Error(`object key escapes the store root: ${key}`);
    }
    return full;
  };
  const metaPathFor = (key: string): string => `${pathFor(key)}.meta`;

  const readSidecar = (key: string): Sidecar | null => {
    const p = metaPathFor(key);
    if (!existsSync(p)) return null;
    try {
      return JSON.parse(readFileSync(p, 'utf8')) as Sidecar;
    } catch {
      return null;
    }
  };

  const infoOf = (key: string): ObjectInfo | null => {
    const p = pathFor(key);
    if (!existsSync(p) || !statSync(p).isFile()) return null;
    const body = readFileSync(p);
    const sidecar = readSidecar(key);
    return {
      key,
      size: body.byteLength,
      contentType: sidecar?.contentType ?? 'application/octet-stream',
      etag: sidecar?.etag ?? createHash('sha256').update(body).digest('hex'),
      lastModified: sidecar?.lastModified ?? statSync(p).mtime.toISOString(),
      metadata: sidecar?.metadata ?? {},
    };
  };

  return {
    async put(key, body, options: PutOptions = {}) {
      const buf = Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8');
      const info: ObjectInfo = {
        key,
        size: buf.byteLength,
        contentType: options.contentType ?? 'application/octet-stream',
        etag: createHash('sha256').update(buf).digest('hex'),
        lastModified: new Date().toISOString(),
        metadata: { ...(options.metadata ?? {}) },
      };
      writeAtomic(pathFor(key), buf);
      const sidecar: Sidecar = {
        contentType: info.contentType,
        etag: info.etag,
        lastModified: info.lastModified,
        metadata: info.metadata,
      };
      writeAtomic(metaPathFor(key), Buffer.from(`${JSON.stringify(sidecar, null, 2)}\n`));
      return info;
    },

    async get(key): Promise<GotObject | null> {
      const info = infoOf(key);
      if (!info) return null;
      return { ...info, body: readFileSync(pathFor(key)) };
    },

    async head(key) {
      return infoOf(key);
    },

    async delete(key) {
      const p = pathFor(key);
      if (existsSync(p)) rmSync(p);
      const m = metaPathFor(key);
      if (existsSync(m)) rmSync(m);
    },

    async list(prefix = '') {
      if (!existsSync(root)) return [];
      const out: string[] = [];
      const walk = (dir: string): void => {
        for (const name of readdirSync(dir)) {
          const full = join(dir, name);
          if (statSync(full).isDirectory()) {
            walk(full);
          } else if (!full.endsWith('.meta')) {
            out.push(relative(root, full).split(sep).join('/'));
          }
        }
      };
      walk(root);
      return out.filter((k) => k.startsWith(prefix)).sort();
    },
  };
}
