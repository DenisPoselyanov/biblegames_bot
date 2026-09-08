import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { getTableName, is, sql } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ROLES } from '../../../authz/roles';
import { createTestDatabase, type TestDatabase } from '../testing';
import { isMissingMigrationState } from '../migrate';
import { schema } from '../schema';

const migrationsFolder = resolve(dirname(fileURLToPath(import.meta.url)), '../../../migrations');

describe('migration framework (§18.1)', () => {
  let tdb: TestDatabase;

  beforeAll(async () => {
    tdb = await createTestDatabase();
  });
  afterAll(async () => {
    await tdb.close();
  });

  it('creates every table the Drizzle schema declares', async () => {
    const expected = new Set(
      Object.values(schema)
        .filter((t) => is(t, PgTable))
        .map((t) => getTableName(t as PgTable)),
    );
    const { rows } = await tdb.raw.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'public'`,
    );
    const actual = new Set(rows.map((r) => r.table_name));
    for (const name of expected) expect(actual, `missing table ${name}`).toContain(name);
  });

  it('records the run in the drizzle journal table', async () => {
    const { rows } = await tdb.raw.execute<{ hash: string }>(
      sql`select hash from drizzle.__drizzle_migrations order by id`,
    );
    const journal = JSON.parse(
      readFileSync(resolve(migrationsFolder, 'meta/_journal.json'), 'utf8'),
    ) as { entries: unknown[] };
    expect(rows.length).toBe(journal.entries.length);
  });

  it('seeds the roles table to match server/authz/roles.ts ROLES', async () => {
    const { rows } = await tdb.raw.execute<{ key: string }>(sql`select key from roles order by key`);
    expect(rows.map((r) => r.key).sort()).toEqual([...ROLES].sort());
  });

  it('is a no-op on re-run (safe rerun policy)', async () => {
    const { migrate } = await import('drizzle-orm/pglite/migrator');
    const before = await tdb.raw.execute<{ n: string }>(
      sql`select count(*)::text as n from drizzle.__drizzle_migrations`,
    );
    await migrate(tdb.raw, { migrationsFolder });
    const after = await tdb.raw.execute<{ n: string }>(
      sql`select count(*)::text as n from drizzle.__drizzle_migrations`,
    );
    expect(after.rows[0]?.n).toBe(before.rows[0]?.n);
  });

  it('treats only "state not created yet" errors as a clean first run', () => {
    expect(isMissingMigrationState({ code: '42P01' })).toBe(true); // undefined_table
    expect(isMissingMigrationState({ code: '3F000' })).toBe(true); // invalid_schema_name
    expect(isMissingMigrationState({ code: '57P01' })).toBe(false); // admin_shutdown
    expect(isMissingMigrationState(new Error('ECONNREFUSED'))).toBe(false);
    expect(isMissingMigrationState(null)).toBe(false);
  });

  it('the adopt migration survives running against an already-populated database', async () => {
    // Simulate a Phase 1 database created from server/db/schema.sql: a second
    // fresh pglite where we apply schema.sql first, then the migration.
    const populated = await createTestDatabase();
    try {
      // createTestDatabase already migrated it; re-applying the raw SQL must not throw
      // because every statement is IF NOT EXISTS.
      const rawSql = readFileSync(resolve(migrationsFolder, '0000_violet_dagger.sql'), 'utf8')
        .split('--> statement-breakpoint')
        .map((s) => s.replace(/^--.*$/gm, '').trim())
        .filter(Boolean);
      for (const stmt of rawSql) {
        await populated.raw.execute(sql.raw(stmt));
      }
    } finally {
      await populated.close();
    }
  });
});
