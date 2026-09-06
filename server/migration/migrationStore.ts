/**
 * Legacy profile migration record (Phase 1 §9, ADR-003).
 *
 * Records the one-time, bounded import of a client-authored legacy profile:
 * what was accepted, what was capped/rejected, and the wallet opening entry it
 * created. A user has at most one record; a repeat migration request returns
 * the stored record and does nothing.
 */

import { resolve } from 'node:path';
import type { ServerConfig } from '../config/env';
import { getPool } from '../db/pgPool';
import { readJsonFile, withFileMutex, writeJsonFileAtomic } from '../db/atomicJson';

export const MIGRATION_VERSION = 1;

export interface MigrationRecord {
  userId: string;
  sourceVersion: number;
  migrationVersion: number;
  submittedHash: string;
  accepted: Record<string, unknown>;
  rejected: Record<string, unknown>;
  walletOpeningEntryId: string | null;
  status: 'applied' | 'applied_with_caps';
  createdAt: string;
}

export interface MigrationStore {
  get(userId: string): Promise<MigrationRecord | null>;
  put(record: MigrationRecord): Promise<MigrationRecord>;
}

export function createJsonMigrationStore(filePath?: string): MigrationStore {
  const file = filePath ?? resolve(process.cwd(), '.data', 'migrations.json');
  type Persisted = Record<string, MigrationRecord>;
  const read = (): Persisted => readJsonFile<Persisted>(file, {});

  return {
    async get(userId) {
      return read()[userId] ?? null;
    },
    async put(record) {
      return withFileMutex(file, async () => {
        const db = read();
        if (db[record.userId]) return db[record.userId];
        db[record.userId] = record;
        writeJsonFileAtomic(file, db);
        return record;
      });
    },
  };
}

export function createSqlMigrationStore(): MigrationStore {
  const rowToRecord = (row: Record<string, unknown>): MigrationRecord => ({
    userId: String(row.user_id),
    sourceVersion: Number(row.source_version),
    migrationVersion: Number(row.migration_version),
    submittedHash: String(row.submitted_hash),
    accepted: (row.accepted as Record<string, unknown> | null) ?? {},
    rejected: (row.rejected as Record<string, unknown> | null) ?? {},
    walletOpeningEntryId: (row.wallet_opening_entry_id as string | null) ?? null,
    status: row.status as MigrationRecord['status'],
    createdAt:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  });

  return {
    async get(userId) {
      const pool = await getPool();
      const result = await pool.query(
        'select * from migration_records where user_id = $1 limit 1',
        [userId],
      );
      return result.rows[0] ? rowToRecord(result.rows[0]) : null;
    },
    async put(record) {
      const pool = await getPool();
      await pool.query(
        `insert into migration_records(
           user_id, source_version, migration_version, submitted_hash,
           accepted, rejected, wallet_opening_entry_id, status, created_at)
         values($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9::timestamptz)
         on conflict (user_id) do nothing`,
        [
          record.userId,
          record.sourceVersion,
          record.migrationVersion,
          record.submittedHash,
          JSON.stringify(record.accepted),
          JSON.stringify(record.rejected),
          record.walletOpeningEntryId,
          record.status,
          record.createdAt,
        ],
      );
      const stored = await this.get(record.userId);
      return stored ?? record;
    },
  };
}

export function createMigrationStore(config: ServerConfig): MigrationStore {
  return config.storageProvider === 'sql'
    ? createSqlMigrationStore()
    : createJsonMigrationStore();
}

export function createMemoryMigrationStore(): MigrationStore {
  const map = new Map<string, MigrationRecord>();
  return {
    async get(userId) {
      return map.get(userId) ?? null;
    },
    async put(record) {
      if (map.has(record.userId)) return map.get(record.userId)!;
      map.set(record.userId, record);
      return record;
    },
  };
}
