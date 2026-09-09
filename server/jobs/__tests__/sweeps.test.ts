import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../../infrastructure/database/testing';
import {
  idempotencySweepHandler,
  rateLimitSweepHandler,
  telemetryRetentionHandler,
  type SweepQuery,
} from '../sweeps';
import type { JobContext } from '../../domains/jobs/types';
import type { RetentionPayload } from '../../domains/jobs/catalog';

function ctx(payload: RetentionPayload = {}): {
  ctx: JobContext<RetentionPayload>;
  checkpoint: Record<string, unknown>;
} {
  const checkpoint: Record<string, unknown> = {};
  return {
    checkpoint,
    ctx: {
      job: { payload, checkpoint: null } as JobContext<RetentionPayload>['job'],
      signal: new AbortController().signal,
      async checkpoint(patch) {
        Object.assign(checkpoint, patch);
      },
    },
  };
}

describe('retention sweep handlers — SQL shape', () => {
  const NOW = new Date('2026-09-09T12:00:00.000Z');

  it('rate-limit sweep deletes rows older than the default 1 day', async () => {
    const query = vi.fn<SweepQuery>().mockResolvedValue({ rowCount: 7 });
    const { ctx: c, checkpoint } = ctx();
    await rateLimitSweepHandler({ query, now: () => NOW })(c);

    expect(query).toHaveBeenCalledWith('delete from rate_limit_counters where reset_at < $1', [
      '2026-09-08T12:00:00.000Z',
    ]);
    expect(checkpoint).toEqual({ deleted: 7, cutoff: '2026-09-08T12:00:00.000Z', days: 1 });
  });

  it('idempotency sweep uses created_at and a 2-day default', async () => {
    const query = vi.fn<SweepQuery>().mockResolvedValue({ rowCount: 0 });
    await idempotencySweepHandler({ query, now: () => NOW })(ctx().ctx);
    expect(query).toHaveBeenCalledWith('delete from idempotency_keys where created_at < $1', [
      '2026-09-07T12:00:00.000Z',
    ]);
  });

  it('telemetry sweep honours a payload override', async () => {
    const query = vi.fn<SweepQuery>().mockResolvedValue({ rowCount: 3 });
    await telemetryRetentionHandler({ query, now: () => NOW })(ctx({ olderThanDays: 30 }).ctx);
    expect(query).toHaveBeenCalledWith('delete from telemetry_events where created_at < $1', [
      '2026-08-10T12:00:00.000Z',
    ]);
  });
});

describe('retention sweep handlers — against pglite', () => {
  let tdb: TestDatabase;
  const query: SweepQuery = async (sql, params) => {
    const res = await tdb.client.query(sql, params as unknown[]);
    return { rowCount: res.affectedRows ?? null };
  };

  beforeEach(async () => {
    tdb = await createTestDatabase();
  });
  afterEach(async () => {
    await tdb.close();
  });

  it('prunes stale rate_limit_counters and keeps live windows', async () => {
    await tdb.client.query(
      `insert into rate_limit_counters(bucket, count, reset_at) values
        ('old:a', 1, now() - interval '10 days'),
        ('fresh:b', 1, now() + interval '1 minute')`,
    );
    const { ctx: c, checkpoint } = ctx();
    await rateLimitSweepHandler({ query })(c);

    const rows = await tdb.client.query<{ bucket: string }>('select bucket from rate_limit_counters');
    expect(rows.rows.map((r) => r.bucket)).toEqual(['fresh:b']);
    expect(checkpoint.deleted).toBe(1);
  });

  it('prunes expired idempotency_keys', async () => {
    await tdb.client.query(
      `insert into idempotency_keys(key, result, created_at) values
        ('k-old', '{}'::jsonb, now() - interval '5 days'),
        ('k-new', '{}'::jsonb, now())`,
    );
    await idempotencySweepHandler({ query })(ctx().ctx);
    const rows = await tdb.client.query<{ key: string }>('select key from idempotency_keys');
    expect(rows.rows.map((r) => r.key)).toEqual(['k-new']);
  });

  it('prunes old telemetry_events', async () => {
    await tdb.client.query(
      `insert into telemetry_events(user_id, event_name, created_at) values
        ('u1', 'old', now() - interval '200 days'),
        ('u1', 'recent', now() - interval '1 day')`,
    );
    await telemetryRetentionHandler({ query })(ctx().ctx);
    const rows = await tdb.client.query<{ event_name: string }>(
      'select event_name from telemetry_events',
    );
    expect(rows.rows.map((r) => r.event_name)).toEqual(['recent']);
  });
});
