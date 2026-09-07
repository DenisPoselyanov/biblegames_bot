/**
 * Drizzle database client (Phase 2 WS2, ADR-012).
 *
 * Wraps the SAME `pg.Pool` the raw-SQL path uses (`server/db/pgPool.ts`), so
 * adoption is incremental — a repository can move to Drizzle while the rest of
 * the server still issues raw queries against the one shared pool.
 */
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import { schema } from './schema';

/**
 * The application database handle. Repository implementations depend on this type
 * (or on `Transaction` below) — never on `pg` or a concrete driver.
 *
 * The pglite-backed test database (`./testing.ts`) is structurally compatible and
 * is handed to repositories through the same type.
 */
export type Database = NodePgDatabase<typeof schema>;

/** Transaction handle — the concrete type behind `ServiceContext.tx` (§11, §12.4). */
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export function createDatabase(pool: Pool): Database {
  return drizzle(pool, { schema });
}
