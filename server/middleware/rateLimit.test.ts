import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import {
  configureRateLimitStore,
  createRateLimit,
  hitLimit,
  resetRateLimits,
} from './rateLimit';
import type { RateLimitStore } from './rateLimitStore';
import { metrics } from '../lib/metrics';
import { AppError } from '../lib/errors';

beforeEach(() => {
  resetRateLimits();
  metrics.reset();
});
afterEach(() => {
  vi.useRealTimers();
  resetRateLimits();
});

const tick = () => new Promise((r) => setImmediate(r));

describe('hitLimit', () => {
  it('allows up to max, then trips and counts rate_limited_total', async () => {
    for (let i = 0; i < 3; i += 1) {
      expect((await hitLimit('t', 'k', 60_000, 3)).ok).toBe(true);
    }
    const tripped = await hitLimit('t', 'k', 60_000, 3);
    expect(tripped.ok).toBe(false);
    expect(tripped.retryAfterSec).toBeGreaterThan(0);
    expect(metrics.snapshot()['rate_limited_total{name=t}']).toBe(1);
  });

  it('fails open (and counts) when the store throws', async () => {
    const brokenStore: RateLimitStore = {
      hit: vi.fn().mockRejectedValue(new Error('store down')),
      reset: vi.fn(),
      close: vi.fn(),
    };
    configureRateLimitStore(brokenStore);

    const decision = await hitLimit('t', 'k', 60_000, 1);
    expect(decision.ok).toBe(true);
    expect(metrics.snapshot()['rate_limit_store_error_total{name=t}']).toBe(1);
    expect(metrics.snapshot()['rate_limited_total{name=t}']).toBeUndefined();
  });
});

describe('createRateLimit middleware', () => {
  const mkReq = (ip = '1.2.3.4'): Request => ({ ip, header: () => undefined }) as unknown as Request;
  const res = { setHeader: vi.fn() } as unknown as Response;

  it('passes a 429 AppError to next() when over the limit', async () => {
    const mw = createRateLimit({ name: 'm', windowMs: 60_000, max: 1 });
    const next = vi.fn();
    mw(mkReq(), res, next);
    await tick();
    mw(mkReq(), res, next);
    await tick();
    expect(next).toHaveBeenCalledTimes(2);
    expect(next.mock.calls[0][0]).toBeUndefined();
    const err = next.mock.calls[1][0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.httpStatus).toBe(429);
    expect(err.code).toBe('rate_limited');
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
  });

  it('is a no-op when disabled', async () => {
    const mw = createRateLimit({ name: 'm', windowMs: 60_000, max: 1, disabled: true });
    const next = vi.fn();
    mw(mkReq(), res, next);
    mw(mkReq(), res, next);
    await tick();
    expect(next.mock.calls.every((c) => c[0] === undefined)).toBe(true);
  });

  it('does not set Retry-After once the response has started, and never rejects unhandled', async () => {
    const sentRes = {
      headersSent: true,
      setHeader: vi.fn(() => {
        throw new Error('ERR_HTTP_HEADERS_SENT');
      }),
    } as unknown as Response;
    const mw = createRateLimit({ name: 'm2', windowMs: 60_000, max: 1 });
    const next = vi.fn();

    mw(mkReq(), sentRes, next); // 1st hit — allowed
    await tick();
    mw(mkReq(), sentRes, next); // 2nd hit — over the limit
    await tick();

    expect(sentRes.setHeader).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(2);
    expect((next.mock.calls[1][0] as AppError).code).toBe('rate_limited');
  });
});
