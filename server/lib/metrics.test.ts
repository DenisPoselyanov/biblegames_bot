import { beforeEach, describe, expect, it } from 'vitest';
import { metrics } from './metrics';

beforeEach(() => metrics.reset());

describe('metrics', () => {
  it('counts by name and labels', () => {
    metrics.inc('auth_failed_total', { reason: 'bad_hash' });
    metrics.inc('auth_failed_total', { reason: 'bad_hash' });
    metrics.inc('auth_failed_total', { reason: 'expired' });
    metrics.inc('rate_limited_total');

    expect(metrics.snapshot()).toEqual({
      'auth_failed_total{reason=bad_hash}': 2,
      'auth_failed_total{reason=expired}': 1,
      rate_limited_total: 1,
    });
  });

  it('label key order is stable regardless of insertion order', () => {
    metrics.inc('x', { b: '2', a: '1' });
    metrics.inc('x', { a: '1', b: '2' });
    expect(metrics.snapshot()).toEqual({ 'x{a=1,b=2}': 2 });
  });

  it('snapshot carries no free-text / PII — callers only pass coarse labels', () => {
    metrics.inc('authz_denied_total', { kind: 'permission' });
    const keys = Object.keys(metrics.snapshot());
    expect(keys).toEqual(['authz_denied_total{kind=permission}']);
  });
});
