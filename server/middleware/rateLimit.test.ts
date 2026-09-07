import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { createRateLimit, hitLimit, resetRateLimits } from './rateLimit';
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

describe('hitLimit', () => {
  it('allows up to max, then trips with a retry-after', () => {
    for (let i = 0; i < 3; i += 1) {
      expect(hitLimit('t', 'k', 60_000, 3).ok).toBe(true);
    }
    const tripped = hitLimit('t', 'k', 60_000, 3);
    expect(tripped.ok).toBe(false);
    expect(tripped.retryAfterSec).toBeGreaterThan(0);
    expect(metrics.snapshot()['rate_limited_total{name=t}']).toBe(1);
  });

  it('keys are independent', () => {
    expect(hitLimit('t', 'a', 60_000, 1).ok).toBe(true);
    expect(hitLimit('t', 'b', 60_000, 1).ok).toBe(true);
    expect(hitLimit('t', 'a', 60_000, 1).ok).toBe(false);
  });

  it('window resets after it elapses', () => {
    vi.useFakeTimers();
    expect(hitLimit('t', 'k', 1_000, 1).ok).toBe(true);
    expect(hitLimit('t', 'k', 1_000, 1).ok).toBe(false);
    vi.advanceTimersByTime(1_100);
    expect(hitLimit('t', 'k', 1_000, 1).ok).toBe(true);
  });
});

describe('createRateLimit middleware', () => {
  const mkReq = (ip = '1.2.3.4'): Request => ({ ip, header: () => undefined }) as unknown as Request;
  const res = { setHeader: vi.fn() } as unknown as Response;

  it('passes a 429 AppError to next() when over the limit', () => {
    const mw = createRateLimit({ name: 'm', windowMs: 60_000, max: 1 });
    const next = vi.fn();
    mw(mkReq(), res, next);
    mw(mkReq(), res, next);
    expect(next).toHaveBeenCalledTimes(2);
    expect(next.mock.calls[0][0]).toBeUndefined();
    const err = next.mock.calls[1][0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.httpStatus).toBe(429);
    expect(err.code).toBe('rate_limited');
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
  });

  it('is a no-op when disabled', () => {
    const mw = createRateLimit({ name: 'm', windowMs: 60_000, max: 1, disabled: true });
    const next = vi.fn();
    mw(mkReq(), res, next);
    mw(mkReq(), res, next);
    expect(next.mock.calls.every((c) => c[0] === undefined)).toBe(true);
  });
});
