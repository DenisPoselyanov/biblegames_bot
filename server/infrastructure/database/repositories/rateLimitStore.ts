/**
 * Postgres fixed-window rate-limit store (Phase 2 WS2 part 4).
 *
 * The production adapter for `server/middleware/rateLimitStore.ts` — selected
 * by the composition root when a database is wired so every instance shares one
 * set of counters. Runs on the same Drizzle handle / `pg.Pool` as everything
 * else (ADR-012).
 *
 * Each `hit` is a single atomic `INSERT … ON CONFLICT DO UPDATE`: the window
 * rolls inside the `CASE` (reset `count` to 1 and push `reset_at` out when it
 * has passed, otherwise increment), so concurrent hits from different instances
 * cannot race past the limit. `now` is supplied by the app (injectable for
 * tests) rather than read from the database, which keeps the semantics
 * identical to the in-memory adapter.
 */
import { sql } from 'drizzle-orm';
import type { RateLimitStore } from '../../../middleware/rateLimitStore';
import type { Database } from '../client';
import { rateLimitCounters } from '../schema/platform';

export interface SqlRateLimitStoreOptions {
  /** Injectable clock (tests). */
  now?: () => Date;
}

export function createSqlRateLimitStore(
  db: Database,
  opts: SqlRateLimitStoreOptions = {},
): RateLimitStore {
  const now = opts.now ?? (() => new Date());

  return {
    async hit({ name, key, windowMs, max }) {
      const at = now();
      const atIso = at.toISOString();
      const nextResetIso = new Date(at.getTime() + windowMs).toISOString();
      const bucket = `${name}:${key}`;

      const [row] = await db
        .insert(rateLimitCounters)
        .values({ bucket, count: 1, resetAt: nextResetIso })
        .onConflictDoUpdate({
          target: rateLimitCounters.bucket,
          set: {
            count: sql`case when ${rateLimitCounters.resetAt} <= ${atIso} then 1 else ${rateLimitCounters.count} + 1 end`,
            resetAt: sql`case when ${rateLimitCounters.resetAt} <= ${atIso} then ${nextResetIso} else ${rateLimitCounters.resetAt} end`,
          },
        })
        .returning({ count: rateLimitCounters.count, resetAt: rateLimitCounters.resetAt });

      if (!row || row.count <= max) return { ok: true, retryAfterSec: 0 };

      const remainingMs = new Date(row.resetAt).getTime() - at.getTime();
      return { ok: false, retryAfterSec: Math.max(1, Math.ceil(remainingMs / 1000)) };
    },
    async reset() {
      await db.delete(rateLimitCounters);
    },
    close() {},
  };
}
