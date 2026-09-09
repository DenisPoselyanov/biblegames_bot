/**
 * S3-compatible `ObjectStore` (Phase 2 §19) — the scale path.
 *
 * Talks the S3 REST API over `fetch` with hand-rolled SigV4 (`./sigv4.ts`), so
 * it works against AWS S3, MinIO, Cloudflare R2, Backblaze B2 — anything
 * S3-compatible — with no `aws-sdk`. Path-style addressing by default
 * (`{endpoint}/{bucket}/{key}`), which every S3-compatible server accepts;
 * set `forcePathStyle: false` for virtual-host addressing on AWS.
 */
import { createHash } from 'node:crypto';
import {
  assertValidObjectKey,
  type GotObject,
  type ObjectInfo,
  type ObjectStore,
  type PutOptions,
} from '../../domains/storage/objectStore';
import { signV4 } from './sigv4';

export interface S3ObjectStoreConfig {
  endpoint: string; // e.g. https://s3.us-east-1.amazonaws.com or http://localhost:9000
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  forcePathStyle?: boolean; // default true
  /** Prefix every key with this (no leading/trailing slash). */
  keyPrefix?: string;
}

const META_PREFIX = 'x-amz-meta-';

export function createS3ObjectStore(config: S3ObjectStoreConfig): ObjectStore {
  const pathStyle = config.forcePathStyle !== false;
  const prefix = config.keyPrefix ? `${config.keyPrefix.replace(/^\/+|\/+$/g, '')}/` : '';

  const urlFor = (key: string): string => {
    const encoded = key.split('/').map(encodeURIComponent).join('/');
    if (pathStyle) return `${config.endpoint.replace(/\/+$/, '')}/${config.bucket}/${encoded}`;
    const u = new URL(config.endpoint);
    return `${u.protocol}//${config.bucket}.${u.host}/${encoded}`;
  };

  const send = async (
    method: string,
    key: string,
    opts: { body?: Buffer; query?: string; extraHeaders?: Record<string, string> } = {},
  ): Promise<Response> => {
    const url = urlFor(key) + (opts.query ? `?${opts.query}` : '');
    const signed = signV4({
      method,
      url,
      region: config.region,
      service: 's3',
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      sessionToken: config.sessionToken,
      body: opts.body,
      headers: opts.extraHeaders,
      signPayloadHeader: true,
    });
    return fetch(url, {
      method,
      headers: signed.headers,
      body: opts.body ? new Uint8Array(opts.body) : undefined,
    });
  };

  const infoFromResponse = (key: string, res: Response, size: number): ObjectInfo => {
    const metadata: Record<string, string> = {};
    res.headers.forEach((value, name) => {
      if (name.toLowerCase().startsWith(META_PREFIX)) {
        metadata[name.slice(META_PREFIX.length)] = value;
      }
    });
    return {
      key,
      size,
      contentType: res.headers.get('content-type') ?? 'application/octet-stream',
      etag: (res.headers.get('etag') ?? '').replace(/"/g, ''),
      lastModified: res.headers.get('last-modified')
        ? new Date(res.headers.get('last-modified')!).toISOString()
        : new Date().toISOString(),
      metadata,
    };
  };

  return {
    async put(key, body, options: PutOptions = {}) {
      assertValidObjectKey(key);
      const buf = Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8');
      const extraHeaders: Record<string, string> = {
        'content-type': options.contentType ?? 'application/octet-stream',
      };
      for (const [k, v] of Object.entries(options.metadata ?? {})) {
        extraHeaders[`${META_PREFIX}${k}`] = v;
      }
      const res = await send('PUT', prefix + key, { body: buf, extraHeaders });
      if (!res.ok) throw new Error(`S3 put ${key} failed: ${res.status} ${await res.text()}`);
      return {
        key,
        size: buf.byteLength,
        contentType: extraHeaders['content-type'],
        etag:
          (res.headers.get('etag') ?? '').replace(/"/g, '') ||
          createHash('sha256').update(buf).digest('hex'),
        lastModified: new Date().toISOString(),
        metadata: { ...(options.metadata ?? {}) },
      };
    },

    async get(key): Promise<GotObject | null> {
      const res = await send('GET', prefix + key);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`S3 get ${key} failed: ${res.status}`);
      const body = Buffer.from(await res.arrayBuffer());
      return { ...infoFromResponse(key, res, body.byteLength), body };
    },

    async head(key) {
      const res = await send('HEAD', prefix + key);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`S3 head ${key} failed: ${res.status}`);
      return infoFromResponse(key, res, Number(res.headers.get('content-length') ?? 0));
    },

    async delete(key) {
      const res = await send('DELETE', prefix + key);
      if (!res.ok && res.status !== 404) {
        throw new Error(`S3 delete ${key} failed: ${res.status}`);
      }
    },

    async list(listPrefix = '') {
      const query = `list-type=2&prefix=${encodeURIComponent(prefix + listPrefix)}`;
      const res = await send('GET', '', { query });
      if (!res.ok) throw new Error(`S3 list failed: ${res.status}`);
      const xml = await res.text();
      const keys = [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) =>
        m[1].startsWith(prefix) ? m[1].slice(prefix.length) : m[1],
      );
      return keys.sort();
    },
  };
}
