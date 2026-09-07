/**
 * Command-level idempotency (Phase 1 §7.3).
 *
 * A retried mutation presents the same `idempotencyKey`; `recall` returns the
 * stored outcome so the caller replays it verbatim instead of recomputing (and
 * re-emitting a celebration-worthy event). The wallet ledger's
 * `(sourceType, sourceId)` uniqueness is the money-level guarantee; this store
 * is the response-level cache layered on top.
 */

import { resolve } from 'node:path';
import type { ServerConfig } from '../config/env';
import { getPool } from '../db/pgPool';
import { readJsonFile, withFileMutex, writeJsonFileAtomic } from '../db/atomicJson';

export interface IdempotencyRecord {
  result: unknown;
  storedAt: string;
}

export interface IdempotencyStore {
  recall(key: string): Promise<IdempotencyRecord | null>;
  remember(key: string, result: unknown): Promise<void>;
}

const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_KEYS = 5000;

function isFresh(record: { storedAt: string }, now: number): boolean {
  const at = Date.parse(record.storedAt);
  return Number.isFinite(at) && now - at < TTL_MS;
}

export function createJsonIdempotencyStore(filePath?: string): IdempotencyStore {
  const file = filePath ?? resolve(process.cwd(), '.data', 'idempotency.json');
  type Persisted = Record<string, IdempotencyRecord>;
  const read = (): Persisted => readJsonFile<Persisted>(file, {});

  return {
    async recall(key) {
      const record = read()[key];
      if (!record) return null;
      return isFresh(record, Date.now()) ? record : null;
    },

    async remember(key, result) {
      await withFileMutex(file, async () => {
        const now = Date.now();
        const db = read();
        db[key] = { result, storedAt: new Date(now).toISOString() };

        let keys = Object.keys(db).filter((k) => isFresh(db[k], now));
        if (keys.length > MAX_KEYS) {
          keys = keys
            .sort((a, b) => Date.parse(db[a].storedAt) - Date.parse(db[b].storedAt))
            .slice(keys.length - MAX_KEYS);
        }
        writeJsonFileAtomic(
          file,
          Object.fromEntries(keys.map((k) => [k, db[k]])),
        );
      });
    },
  };
}

export function createSqlIdempotencyStore(): IdempotencyStore {
  return {
    async recall(key) {
      const pool = await getPool();
      const result = await pool.query(
        'select result, created_at from idempotency_keys where key = $1 limit 1',
        [key],
      );
      const row = result.rows[0];
      if (!row) return null;
      const storedAt =
        row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at);
      if (!isFresh({ storedAt }, Date.now())) return null;
      return { result: row.result, storedAt };
    },

    async remember(key, result) {
      const pool = await getPool();
      await pool.query(
        `insert into idempotency_keys(key, result, created_at)
         values($1, $2::jsonb, now())
         on conflict (key) do nothing`,
        [key, JSON.stringify(result ?? null)],
      );
    },
  };
}

export function createIdempotencyStore(config: ServerConfig): IdempotencyStore {
  return config.storageProvider === 'sql'
    ? createSqlIdempotencyStore()
    : createJsonIdempotencyStore();
}

/** In-memory adapter for tests. */
export function createMemoryIdempotencyStore(): IdempotencyStore {
  const map = new Map<string, IdempotencyRecord>();
  return {
    async recall(key) {
      const record = map.get(key);
      if (!record) return null;
      return isFresh(record, Date.now()) ? record : null;
    },
    async remember(key, result) {
      map.set(key, { result, storedAt: new Date().toISOString() });
    },
  };
}
