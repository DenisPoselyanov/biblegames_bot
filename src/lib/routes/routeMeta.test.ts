import { describe, expect, it } from 'vitest';
import { getActiveTab, getTabDirection, isFullscreenRoute, matchRouteMeta } from './routeMeta';

describe('routeMeta', () => {
  it('maps tab roots and nested routes to the right tab, driven by metadata not string prefixes', () => {
    expect(getActiveTab('/')).toBe('home');
    expect(getActiveTab('/learn')).toBe('learn');
    expect(getActiveTab('/learn/plans/p1')).toBe('learn');
    expect(getActiveTab('/learn/plans/p1/modules/m1')).toBe('learn');
    expect(getActiveTab('/progress')).toBe('progress');
    expect(getActiveTab('/profile/settings')).toBe('profile');
  });

  it('maps Practice/Review/Millionaire/Survival/Kahoot to the Play tab (§4.1: they are inside Play\'s purpose, not their own tab)', () => {
    expect(getActiveTab('/play')).toBe('play');
    expect(getActiveTab('/practice')).toBe('play');
    expect(getActiveTab('/review')).toBe('play');
    expect(getActiveTab('/play/millionaire')).toBe('play');
    expect(getActiveTab('/play/kahoot')).toBe('play');
  });

  it('returns null for secondary routes outside the tab bar (§4.2 / DESIGN_RULES §14.2)', () => {
    expect(getActiveTab('/shop')).toBeNull();
    expect(getActiveTab('/social/communities')).toBeNull();
    expect(getActiveTab('/social/challenges')).toBeNull();
  });

  it('returns null for an unregistered path instead of matching by accident', () => {
    expect(matchRouteMeta('/does/not/exist')).toBeUndefined();
    expect(getActiveTab('/does/not/exist')).toBeNull();
  });

  it('hides the tab bar only for routes marked fullscreen (§5.4)', () => {
    expect(isFullscreenRoute('/learn/lessons/l1')).toBe(true);
    expect(isFullscreenRoute('/practice/session/s1')).toBe(true);
    expect(isFullscreenRoute('/play/kahoot/room/ABCDEF')).toBe(true);
    expect(isFullscreenRoute('/play/kahoot/display/ABCDEF')).toBe(false);
    expect(isFullscreenRoute('/play/millionaire')).toBe(false);
    expect(isFullscreenRoute('/learn')).toBe(false);
  });

  it('computes a coarse direction from tab order', () => {
    expect(getTabDirection('home', 'progress')).toBe('forward');
    expect(getTabDirection('progress', 'home')).toBe('backward');
    expect(getTabDirection('home', 'home')).toBe('none');
    expect(getTabDirection(null, 'home')).toBe('none');
  });
});
