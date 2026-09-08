/**
 * Migration runner (Phase 2 WS2, ADR-012 · §18.1).
 *
 * Wraps `drizzle-orm`'s node-postgres migrator — which already gives ordered IDs,
 * the `meta/_journal.json` journal, per-file checksums, per-migration
 * transactions and a journal-guarded safe rerun — and adds the two properties
 * §18.1 asks for that the migrator does not emit: **status and timing**.
 *
 * Usage:
 *   npm run db:migrate                 # against $DATABASE_URL
 *   DATABASE_URL=... npm run db:migrate # e.g. a staging URL for rehearsal
 *
 * The pglite-backed test database runs the same folder through its own migrator
 * (`./testing.ts`); keep this file node-postgres-only so `pg` stays a prod dep
 * and `@electric-sql/pglite` stays dev-only.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { log } from '../../lib/logger';

const MIGRATIONS_FOLDER = resolve(dirname(fileURLToPath(import.meta.url)), '../../migrations');

interface JournalEntry {
  idx: number;
  tag: string;
}

function journalTags(): string[] {
  const raw = readFileSync(resolve(MIGRATIONS_FOLDER, 'meta/_journal.json'), 'utf8');
  const parsed = JSON.parse(raw) as { entries: JournalEntry[] };
  return parsed.entries.sort((a, b) => a.idx - b.idx).map((e) => e.tag);
}

/** PG error codes that just mean "the drizzle migration bookkeeping isn't there yet". */
const MISSING_MIGRATION_STATE = new Set([
  '42P01', // undefined_table
  '3F000', // invalid_schema_name
]);

export function isMissingMigrationState(err: unknown): boolean {
  return MISSING_MIGRATION_STATE.has((err as { code?: string } | null)?.code ?? '');
}

async function appliedCount(pool: Pool): Promise<number> {
  try {
    const { rows } = await pool.query<{ n: string }>(
      'select count(*)::text as n from drizzle.__drizzle_migrations',
    );
    return Number(rows[0]?.n ?? 0);
  } catch (err) {
    if (isMissingMigrationState(err)) return 0; // not created yet — first run
    throw err; // a real failure — don't silently report every migration as pending
  }
}

export interface RunMigrationsResult {
  pending: string[];
  appliedNow: number;
  durationMs: number;
}

/**
 * Apply every pending migration. Idempotent: a run with nothing pending logs
 * `db.migrate.noop` and returns `appliedNow: 0`.
 */
export async function runMigrations(databaseUrl: string): Promise<RunMigrationsResult> {
  if (!databaseUrl || databaseUrl.includes('[password]')) {
    throw new Error('runMigrations: a real DATABASE_URL is required');
  }

  // SSL handling mirrors `server/db/pgPool.ts` (managed Postgres / Supabase).
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    max: 1,
  });

  try {
    const tags = journalTags();
    const before = await appliedCount(pool);
    const pending = tags.slice(before);

    if (pending.length === 0) {
      log.info('db.migrate.noop', { total: tags.length });
      return { pending: [], appliedNow: 0, durationMs: 0 };
    }

    log.info('db.migrate.start', { pending, total: tags.length, alreadyApplied: before });
    const started = Date.now();
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    const durationMs = Date.now() - started;

    const after = await appliedCount(pool);
    const appliedNow = after - before;
    log.info('db.migrate.done', { appliedNow, pending, durationMs });

    // Record run timing — the migrator's own table has no duration column (§18.1).
    await pool
      .query(
        `create table if not exists drizzle.__migration_runs (
           id bigserial primary key,
           applied_now int not null,
           tags text not null,
           duration_ms int not null,
           ran_at timestamptz not null default now()
         )`,
      )
      .then(() =>
        pool.query(
          'insert into drizzle.__migration_runs(applied_now, tags, duration_ms) values ($1,$2,$3)',
          [appliedNow, pending.join(','), durationMs],
        ),
      )
      .catch((err: unknown) => {
        log.warn('db.migrate.run_record_failed', { error: (err as Error).message });
      });

    return { pending, appliedNow, durationMs };
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  const { loadConfig } = await import('../../config/env');
  const { config } = loadConfig();
  try {
    await runMigrations(config.databaseUrl);
  } catch (err) {
    log.error('db.migrate.failed', { error: (err as Error).message });
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  void main();
}
