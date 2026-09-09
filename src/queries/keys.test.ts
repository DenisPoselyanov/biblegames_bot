import { describe, expect, it } from 'vitest';
import { isOfflineCacheable, queryKeys } from './keys';

describe('queryKeys', () => {
  it('nests self-scoped keys under a shared prefix for broad invalidation', () => {
    const uid = 'u1';
    expect(queryKeys.me.profile(uid)).toEqual(['me', 'profile', 'u1']);
    expect(queryKeys.me.wallet(uid)).toEqual(['me', 'wallet', 'u1']);
    for (const key of [queryKeys.me.profile(uid), queryKeys.me.stats(uid), queryKeys.me.wallet(uid)]) {
      expect(key.slice(0, 1)).toEqual(queryKeys.me.root());
    }
  });

  it('matches the §13.2 domain shapes', () => {
    expect(queryKeys.learning.today('u1')).toEqual(['learning', 'today', 'u1']);
    expect(queryKeys.learning.plan('p9')).toEqual(['learning', 'plan', 'p9']);
    expect(queryKeys.practice.session('s3')).toEqual(['practice', 'session', 's3']);
    expect(queryKeys.content.publishedVersion()).toEqual(['content', 'publishedVersion']);
    expect(queryKeys.kahoot.room('r7')).toEqual(['kahoot', 'room', 'r7']);
  });

  it('scopes different users to different cache entries', () => {
    expect(queryKeys.me.profile('a')).not.toEqual(queryKeys.me.profile('b'));
  });
});

describe('isOfflineCacheable', () => {
  it('allows the last profile snapshot and published content', () => {
    expect(isOfflineCacheable(queryKeys.me.profile('u1'))).toBe(true);
    expect(isOfflineCacheable(queryKeys.content.publishedVersion())).toBe(true);
  });

  it('rejects wallet, stats and everything competitive', () => {
    expect(isOfflineCacheable(queryKeys.me.wallet('u1'))).toBe(false);
    expect(isOfflineCacheable(queryKeys.me.stats('u1'))).toBe(false);
    expect(isOfflineCacheable(queryKeys.kahoot.room('r1'))).toBe(false);
  });
});
