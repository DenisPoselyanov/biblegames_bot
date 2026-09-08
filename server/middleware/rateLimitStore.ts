/**
 * Rate-limit store seam (Phase 2 WS2 part 4 — closes the Phase 1 §13 handoff).
 *
 * Phase 1 kept fixed-window counters in a module `Map`, which is correct only
 * for a single process. The counting is now behind a `RateLimitStore`
 * interface: the in-memory adapter here stays the default, and a Postgres
 * adapter (`server/infrastructure/database/repositories/rateLimitStore.ts`) is
 * selected when a database is wired, so a multi-instance deployment shares one
 * set of counters. The `createRateLimit(...)` / `hitLimit(...)` call sites do
 * not change.
 *
 * Semantics: fixed window. The first hit for a key opens a window of
 * `windowMs`; hits within it increment; the hit that pushes `count` past `max`
 * is rejected with the seconds remaining. The window rolls on the first hit
 * after it elapses.
 */

/** One rate-limit check. */
export interface RateLimitHit {
  /** Low-cardinality policy label (also the metrics label + bucket prefix). */
  name: string;
  /** Principal id, else client IP — never a payload-supplied value. */
  key: string;
  windowMs: number;
  max: number;
}

export interface RateLimitDecision {
  ok: boolean;
  /** Seconds until the window resets — only meaningful when `ok` is false. */
  retryAfterSec: number;
}

export interface RateLimitStore {
  /**
   * Atomically count one hit in the current window and report whether it is
   * within `max`. Implementations must not throw for normal operation; a
   * backing-store outage should reject so the caller can fail open.
   */
  hit(input: RateLimitHit): Promise<RateLimitDecision>;
  /** Drop all counters (tests / shutdown). */
  reset(): Promise<void> | void;
  /** Stop any background timers. Idempotent. */
  close(): void;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export interface MemoryRateLimitStoreOptions {
  /** Injectable clock (tests). */
  now?: () => number;
  /** Lazy-sweep interval for expired buckets. Default 60s; `0` disables. */
  sweepMs?: number;
}

/**
 * In-process fixed-window store. Counters live in a `Map` keyed by
 * `${name}:${key}`, swept lazily on access and on a low-frequency timer.
 */
export function createMemoryRateLimitStore(
  opts: MemoryRateLimitStoreOptions = {},
): RateLimitStore {
  const now = opts.now ?? Date.now;
  const sweepMs = opts.sweepMs ?? 60_000;
  const buckets = new Map<string, Bucket>();
  let sweepTimer: ReturnType<typeof setInterval> | null = null;

  const ensureSweep = (): void => {
    if (sweepTimer || sweepMs <= 0) return;
    sweepTimer = setInterval(() => {
      const t = now();
      for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= t) buckets.delete(key);
      }
    }, sweepMs);
    sweepTimer.unref?.();
  };

  return {
    async hit({ name, key, windowMs, max }) {
      ensureSweep();
      const t = now();
      const bucketKey = `${name}:${key}`;
      const existing = buckets.get(bucketKey);

      if (!existing || existing.resetAt <= t) {
        buckets.set(bucketKey, { count: 1, resetAt: t + windowMs });
        return { ok: true, retryAfterSec: 0 };
      }

      existing.count += 1;
      if (existing.count > max) {
        return { ok: false, retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - t) / 1000)) };
      }
      return { ok: true, retryAfterSec: 0 };
    },
    reset() {
      buckets.clear();
    },
    close() {
      if (sweepTimer) {
        clearInterval(sweepTimer);
        sweepTimer = null;
      }
    },
  };
}
