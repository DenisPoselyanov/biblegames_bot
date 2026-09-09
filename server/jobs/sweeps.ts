/**
 * Cleanup / expiry job handlers (Phase 2 §17).
 *
 * Three retention sweeps that today have no owner:
 * - `rate_limit_counters` — stale windows (`platform.ts` flagged this as a WS5 job);
 * - `idempotency_keys` — the SQL store never prunes (only the JSON store does);
 * - `telemetry_events` — unbounded append.
 *
 * Each is a single bounded `DELETE`. They take an injected `query` so the same
 * handler runs against the shared `pg.Pool` in the worker and against pglite in
 * tests. `checkpoint` records the last run's delete count for observability.
 */
import type { JobHandler } from '../domains/jobs/queue';
import type { RetentionPayload } from '../domains/jobs/catalog';

export interface SweepResult {
  rowCount: number | null;
}
export type SweepQuery = (sql: string, params?: unknown[]) => Promise<SweepResult>;

export interface SweepDeps {
  query: SweepQuery;
  now?: () => Date;
}

function cutoffIso(now: () => Date, days: number): string {
  return new Date(now().getTime() - days * 86_400_000).toISOString();
}

function retentionHandler(
  table: string,
  column: string,
  defaultDays: number,
  deps: SweepDeps,
): JobHandler<RetentionPayload> {
  const now = deps.now ?? (() => new Date());
  return async (ctx) => {
    const days = ctx.job.payload?.olderThanDays ?? defaultDays;
    const cutoff = cutoffIso(now, days);
    const result = await deps.query(
      `delete from ${table} where ${column} < $1`,
      [cutoff],
    );
    await ctx.checkpoint({ deleted: result.rowCount ?? 0, cutoff, days });
  };
}

export function rateLimitSweepHandler(deps: SweepDeps): JobHandler<RetentionPayload> {
  return retentionHandler('rate_limit_counters', 'reset_at', 1, deps);
}

export function idempotencySweepHandler(deps: SweepDeps): JobHandler<RetentionPayload> {
  return retentionHandler('idempotency_keys', 'created_at', 2, deps);
}

export function telemetryRetentionHandler(deps: SweepDeps): JobHandler<RetentionPayload> {
  return retentionHandler('telemetry_events', 'created_at', 90, deps);
}
