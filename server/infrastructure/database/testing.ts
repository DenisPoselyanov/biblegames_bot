/**
 * In-process Postgres for tests (Phase 2 WS2, ADR-012).
 *
 * `@electric-sql/pglite` is real Postgres compiled to WASM — the repository
 * contract tests (§10) run against it *and* against the in-memory adapters, and
 * both must satisfy the same read contracts. No Docker, no external service.
 *
 * dev-only: `@electric-sql/pglite` is a `devDependency`; never import this from
 * runtime code.
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { schema } from './schema';
import type { Database } from './client';

const MIGRATIONS_FOLDER = resolve(dirname(fileURLToPath(import.meta.url)), '../../migrations');

export interface TestDatabase {
  /** Typed exactly like the production handle — repositories can't tell them apart. */
  db: Database;
  /** The underlying pglite Drizzle instance (for raw `.execute()` in test setup). */
  raw: PgliteDatabase<typeof schema>;
  /** The pglite client — `client.query(text, params)` for parametrised raw SQL in tests. */
  client: PGlite;
  close: () => Promise<void>;
}

/** Fresh migrated database per call. Cheap enough to make one per test file. */
export async function createTestDatabase(): Promise<TestDatabase> {
  const client = new PGlite();
  const raw = drizzle(client, { schema });
  await migrate(raw, { migrationsFolder: MIGRATIONS_FOLDER });
  return {
    db: raw as unknown as Database,
    raw,
    client,
    close: () => client.close(),
  };
}
