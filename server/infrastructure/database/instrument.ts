/**
 * Database query timing (Phase 2 §20).
 *
 * Wraps `pool.query` to count every query and warn on slow ones. The SQL text
 * is reduced to `<verb> <first table>` (e.g. `select telemetry_events`) so the
 * log/label stays low-cardinality and carries no values.
 */
import type { Pool, PoolClient } from 'pg';
import { log } from '../../lib/logger';
import { metrics } from '../../lib/metrics';

const SLOW_MS = 200;

export function summariseSql(sql: string): string {
  const text = sql.trim().replace(/\s+/g, ' ').toLowerCase();
  const verb = text.split(' ', 1)[0] || 'other';
  const m = text.match(/\b(?:from|into|update|table)\s+"?([a-z_][a-z0-9_.]*)"?/);
  return m ? `${verb} ${m[1]}` : verb;
}

const INSTRUMENTED = Symbol.for('biblegames.pool.instrumented');

/** Wrap a `.query` method (Pool or checked-out Client) with timing + counters. */
function wrapQuery<T extends { query: (...a: unknown[]) => unknown }>(target: T): void {
  const tagged = target as unknown as Record<symbol, boolean>;
  if (tagged[INSTRUMENTED]) return;
  tagged[INSTRUMENTED] = true;

  const original = target.query.bind(target) as (...args: unknown[]) => unknown;
  target.query = ((...args: unknown[]): unknown => {
    // Only instrument the promise form (text[, params]); leave the callback /
    // Submittable / stream forms untouched.
    const last = args[args.length - 1];
    if (
      typeof last === 'function' ||
      (args[0] && typeof args[0] === 'object' && 'submit' in (args[0] as object))
    ) {
      return original(...args);
    }
    const sql =
      typeof args[0] === 'string' ? args[0] : String((args[0] as { text?: string })?.text ?? '');
    const label = summariseSql(sql);
    const start = process.hrtime.bigint();
    return Promise.resolve(original(...args) as Promise<unknown>).then(
      (value) => {
        finish(label, start, null);
        return value;
      },
      (err: unknown) => {
        finish(label, start, err);
        throw err;
      },
    );
  }) as T['query'];
}

/** Idempotent per pool — safe to call more than once on the same handle. */
export function instrumentPool(pool: Pool): Pool {
  const tagged = pool as unknown as Record<symbol, boolean>;
  if (tagged[INSTRUMENTED]) return pool;

  wrapQuery(pool);

  // Checked-out clients (transactions: `db.transaction()`, `BEGIN`/`COMMIT`)
  // run their queries on the client, not the pool — instrument those too.
  if (typeof pool.connect !== 'function') return pool;
  const connect = pool.connect.bind(pool) as Pool['connect'];
  (pool as unknown as { connect: unknown }).connect = ((...args: unknown[]) => {
    const result = (connect as (...a: unknown[]) => unknown)(...args);
    if (result && typeof (result as Promise<PoolClient>).then === 'function') {
      return (result as Promise<PoolClient>).then((client) => {
        wrapQuery(client);
        return client;
      });
    }
    return result;
  }) as Pool['connect'];

  return pool;
}

function finish(label: string, start: bigint, err: unknown): void {
  const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
  metrics.inc('db_queries_total', { op: label });
  if (err) {
    metrics.inc('db_query_errors_total', { op: label });
    return;
  }
  if (durationMs >= SLOW_MS) {
    metrics.inc('db_slow_queries_total', { op: label });
    log.warn('db.slow_query', { op: label, durationMs: Math.round(durationMs) });
  }
}
