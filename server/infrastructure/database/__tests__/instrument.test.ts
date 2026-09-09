import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { metrics } from '../../../lib/metrics';
import { instrumentPool, summariseSql } from '../instrument';

describe('summariseSql', () => {
  it.each([
    ['select result from idempotency_keys where key = $1', 'select idempotency_keys'],
    ['DELETE FROM rate_limit_counters WHERE reset_at < $1', 'delete rate_limit_counters'],
    ['insert into telemetry_events(user_id) values ($1)', 'insert telemetry_events'],
    ['update user_roles set revoked_at = now()', 'update user_roles'],
    ['begin', 'begin'],
    ['select 1', 'select'],
  ])('%s → %s', (sql, expected) => {
    expect(summariseSql(sql)).toBe(expected);
  });
});

describe('instrumentPool', () => {
  afterEach(() => metrics.reset());

  it('counts queries and passes results through', async () => {
    const inner = vi.fn().mockResolvedValue({ rows: [{ n: 1 }] });
    const pool = { query: inner } as unknown as Pool;
    const wrapped = instrumentPool(pool);

    const result = await (wrapped.query as (s: string, p?: unknown[]) => Promise<unknown>)(
      'select 1 from telemetry_events',
      [],
    );
    expect(result).toEqual({ rows: [{ n: 1 }] });
    expect(inner).toHaveBeenCalledWith('select 1 from telemetry_events', []);

    const snap = metrics.snapshot();
    expect(Object.keys(snap).some((k) => k.startsWith('db_queries_total'))).toBe(true);
  });

  it('instruments queries on a checked-out client (transaction path)', async () => {
    const clientQuery = vi.fn().mockResolvedValue({ rows: [] });
    const client = { query: clientQuery };
    const pool = {
      query: vi.fn(),
      connect: vi.fn().mockResolvedValue(client),
    } as unknown as Pool;

    instrumentPool(pool);
    const checkedOut = await pool.connect();
    await (checkedOut.query as (s: string) => Promise<unknown>)('update wallet_ledger set x = 1');

    expect(clientQuery).toHaveBeenCalledWith('update wallet_ledger set x = 1');
    const ops = Object.keys(metrics.snapshot()).filter((k) => k.includes('wallet_ledger'));
    expect(ops.length).toBeGreaterThan(0);
  });
});
