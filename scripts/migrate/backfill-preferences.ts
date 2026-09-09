/**
 * Backfill `user_preferences` from the legacy `player_profiles` blob
 * (Phase 2 §18.2 step 2 — "copy validated preferences").
 *
 * Idempotent: re-running only writes rows whose typed value differs from the
 * blob. Read-only in `--dry`. After a clean run + verification window, set
 * `LEGACY_STORE_READONLY=true` so preference writes stop touching the blob.
 *
 * Usage:  DATABASE_URL=postgres://… npx tsx scripts/migrate/backfill-preferences.ts [--dry]
 */
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isBollsTranslation } from '../../src/lib/bollsConstants';
import { getPool, isDatabaseConfigured } from '../../server/db/pgPool';
import { createDatabase } from '../../server/infrastructure/database/client';
import { createSqlIdentityRepositories } from '../../server/infrastructure/database/repositories/identity';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

function loadRootEnv(): void {
  const envPath = join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let value = t.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = value;
  }
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function main(): Promise<void> {
  loadRootEnv();
  const dry = process.argv.includes('--dry');

  if (!isDatabaseConfigured()) {
    console.error('DATABASE_URL is required.');
    process.exit(1);
  }

  const pool = await getPool();
  const db = createDatabase(pool);
  const { preferences } = createSqlIdentityRepositories(db);

  const { rows } = await pool.query<{ user_id: string; payload: Record<string, unknown> }>(
    'select user_id, payload from player_profiles',
  );

  let scanned = 0;
  let written = 0;
  let unchanged = 0;
  let noUserRow = 0;
  const mismatches: string[] = [];

  for (const { user_id: userId, payload } of rows) {
    scanned += 1;
    const activeTheme = str(payload.activeTheme);
    const avatar = payload.avatar === '' ? '' : str(payload.avatar);
    const bibleTranslation = (() => {
      const v = str(payload.bibleTranslation);
      return v && isBollsTranslation(v) ? v : null;
    })();

    // the FK requires a users row (created on auth by attachPersistedIdentity)
    const userExists = await pool.query('select 1 from users where id = $1 limit 1', [userId]);
    if (userExists.rowCount === 0) {
      noUserRow += 1;
      mismatches.push(`${userId}: no users row (never authenticated post-WS2) — skipped`);
      continue;
    }

    const current = await preferences.get(userId);
    const same =
      current &&
      current.activeTheme === activeTheme &&
      current.avatar === avatar &&
      current.bibleTranslation === bibleTranslation;
    if (same) {
      unchanged += 1;
      continue;
    }

    if (!dry) {
      await preferences.upsert(userId, { activeTheme, avatar, bibleTranslation });
    }
    written += 1;
  }

  console.log(
    JSON.stringify(
      { dry, scanned, written, unchanged, noUserRow, sampleSkips: mismatches.slice(0, 20) },
      null,
      2,
    ),
  );
  await pool.end();
}

void main().catch((err) => {
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
});
