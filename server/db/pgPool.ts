import type { Pool } from 'pg';

/**
 * The one shared `pg.Pool` for the whole server. The raw-SQL adapters and the
 * Drizzle handle (`server/infrastructure/database/client.ts`) both run on this
 * pool (ADR-012) — never open a second one.
 */
export type PgPool = Pool;

let poolPromise: Promise<PgPool> | null = null;

export function isDatabaseConfigured(): boolean {
  const url = process.env.DATABASE_URL ?? '';
  return Boolean(url) && !url.includes('[password]') && !url.includes('ТВІЙ_РЕАЛЬНИЙ_ПАРОЛЬ');
}

export function useQuestionsSql(): boolean {
  const provider = process.env.QUESTIONS_PROVIDER ?? 'sql';
  if (provider === 'json') return false;
  return isDatabaseConfigured();
}

export async function getPool(): Promise<PgPool> {
  if (!isDatabaseConfigured()) {
    throw new Error('DATABASE_URL is required for SQL question storage');
  }
  if (!poolPromise) {
    poolPromise = (async () => {
      const mod = (await import('pg')) as {
        Pool: new (opts: Record<string, unknown>) => PgPool;
      };
      return new mod.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
      });
    })();
  }
  return poolPromise;
}

export async function queryRows(sql: string, params?: unknown[]): Promise<Array<Record<string, unknown>>> {
  const pool = await getPool();
  const result = await pool.query(sql, params);
  return result.rows;
}
