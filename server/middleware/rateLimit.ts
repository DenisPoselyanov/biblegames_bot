/**
 * Fixed-window rate limiting (Phase 1 §13, shared store Phase 2 WS2 part 4).
 *
 * The counting lives behind a `RateLimitStore` (`./rateLimitStore.ts`): the
 * in-memory adapter is the default and only store when no database is wired; a
 * Postgres adapter is installed by the composition root
 * (`configureRateLimitStore`) so multiple instances share one set of counters.
 * Keyed by `req.auth?.userId ?? req.ip` (a shared NAT'd network is not one
 * bucket).
 *
 * Over the limit → `429` via `AppError('rate_limited', …)` (standard error
 * envelope) with a `Retry-After` header, and `rate_limited_total{name}` is
 * incremented. A store outage fails **open** (allow + `rate_limit_store_error_total`)
 * — a limiter must never take the request path down.
 */

import type { Request, RequestHandler, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors';
import { log } from '../lib/logger';
import { metrics } from '../lib/metrics';
import {
  createMemoryRateLimitStore,
  type RateLimitDecision,
  type RateLimitStore,
} from './rateLimitStore';

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

let store: RateLimitStore = createMemoryRateLimitStore();

/**
 * Swap the process-wide store. Called once by the composition root when a
 * database is available; also used by tests to install a pglite-backed store.
 * Closes the previous store's timers.
 */
export function configureRateLimitStore(next: RateLimitStore): void {
  if (next === store) return;
  store.close();
  store = next;
}

/**
 * Test/shutdown helper — clears counters and resets to a fresh in-memory store
 * so one test's backing store never leaks into the next.
 */
export function resetRateLimits(): void {
  store.close();
  store = createMemoryRateLimitStore();
}

function defaultKey(req: Request): string {
  return req.auth?.userId ?? req.ip ?? 'unknown';
}

/**
 * Core check shared by the Express middleware and the socket limiter. Returns
 * the allowance decision; on a store outage it fails open (`ok: true`) after
 * logging, so callers never need their own catch.
 */
export async function hitLimit(
  name: string,
  key: string,
  windowMs: number,
  max: number,
): Promise<RateLimitDecision> {
  let decision: RateLimitDecision;
  try {
    decision = await store.hit({ name, key, windowMs, max });
  } catch (err) {
    metrics.inc('rate_limit_store_error_total', { name });
    log.error('rate_limit.store_error', {
      name,
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: true, retryAfterSec: 0 };
  }
  if (!decision.ok) metrics.inc('rate_limited_total', { name });
  return decision;
}

export function createRateLimit(opts: RateLimitOptions): RequestHandler {
  const by = opts.by ?? defaultKey;
  return function rateLimit(req: Request, res: Response, next: NextFunction): void {
    if (opts.disabled) {
      next();
      return;
    }
    // `.catch(next)` routes both a store rejection and any throw in the handler
    // (e.g. `res.setHeader` after the client aborted) to the error handler —
    // never an unhandled rejection off the back of `void`.
    void hitLimit(opts.name, by(req), opts.windowMs, opts.max)
      .then(({ ok, retryAfterSec }) => {
        if (ok) {
          next();
          return;
        }
        if (!res.headersSent) res.setHeader('Retry-After', String(retryAfterSec));
        next(new AppError('rate_limited', 'Too many requests, slow down', 429));
      })
      .catch(next);
  };
}
