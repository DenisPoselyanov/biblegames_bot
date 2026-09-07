/**
 * In-memory fixed-window rate limiting (Phase 1 §13).
 *
 * Single-instance only: counters live in a module `Map`, keyed by
 * `req.auth?.userId ?? req.ip` (so a shared NAT'd network is not one bucket)
 * and swept lazily plus on a low-frequency timer. Phase 2/7 swaps the store for
 * a shared backend; the `createRateLimit(...)` call sites do not change.
 *
 * Over the limit → `429` via `AppError('rate_limited', …)` (flows through the
 * standard error envelope) with a `Retry-After` header, and
 * `rate_limited_total{name}` is incremented.
 */

import type { Request, RequestHandler, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors';
import { metrics } from '../lib/metrics';

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  /** Low-cardinality label for metrics + the reused window store. */
  name: string;
  windowMs: number;
  max: number;
  /** Key derivation; defaults to principal id, else client IP. */
  by?: (req: Request) => string;
  /** Skip entirely (tests / `RATE_LIMIT_DISABLED`). */
  disabled?: boolean;
}

const buckets = new Map<string, Bucket>();

let sweepTimer: ReturnType<typeof setInterval> | null = null;
function ensureSweep(): void {
  if (sweepTimer) return;
  sweepTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, 60_000);
  sweepTimer.unref?.();
}

/** Test/shutdown helper — clears counters and stops the sweep timer. */
export function resetRateLimits(): void {
  buckets.clear();
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
}

function defaultKey(req: Request): string {
  return req.auth?.userId ?? req.ip ?? 'unknown';
}

/**
 * Core check shared by the Express middleware and the socket limiter. Returns
 * the remaining allowance and, when tripped, the seconds until the window
 * resets.
 */
export function hitLimit(
  name: string,
  key: string,
  windowMs: number,
  max: number,
): { ok: boolean; retryAfterSec: number } {
  ensureSweep();
  const now = Date.now();
  const bucketKey = `${name}:${key}`;
  const existing = buckets.get(bucketKey);

  if (!existing || existing.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }

  existing.count += 1;
  if (existing.count > max) {
    metrics.inc('rate_limited_total', { name });
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  }
  return { ok: true, retryAfterSec: 0 };
}

export function createRateLimit(opts: RateLimitOptions): RequestHandler {
  const by = opts.by ?? defaultKey;
  return function rateLimit(req: Request, res: Response, next: NextFunction): void {
    if (opts.disabled) {
      next();
      return;
    }
    const { ok, retryAfterSec } = hitLimit(opts.name, by(req), opts.windowMs, opts.max);
    if (ok) {
      next();
      return;
    }
    res.setHeader('Retry-After', String(retryAfterSec));
    next(new AppError('rate_limited', 'Too many requests, slow down', 429));
  };
}
