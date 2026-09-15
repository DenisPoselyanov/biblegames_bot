import { describe, expect, it } from 'vitest';
import { computeReviewDue, REVIEW_BOX_INTERVALS_DAYS } from '../reviewScheduler';
import type { MasteryState } from '../../../../src/types/index';

function mastery(overrides: Partial<MasteryState> = {}): MasteryState {
  return {
    mastery: 50,
    confidence: 80,
    lastReviewedAt: null,
    errorTags: [],
    correctStreak: 0,
    wrongCount: 0,
    totalAnswers: 1,
    ...overrides,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

describe('computeReviewDue', () => {
  it('skips objectives that have never been reviewed', () => {
    const now = new Date('2026-09-15T00:00:00.000Z');
    const due = computeReviewDue({ obj1: mastery({ lastReviewedAt: null }) }, now);
    expect(due).toEqual([]);
  });

  it('is not due before its box interval elapses', () => {
    const now = new Date('2026-09-15T00:00:00.000Z');
    const lastReviewedAt = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(); // 12h ago
    const due = computeReviewDue({ obj1: mastery({ lastReviewedAt, correctStreak: 0 }) }, now);
    expect(due).toEqual([]);
  });

  it('is due once its box interval elapses, box 0 = 1 day', () => {
    const now = new Date('2026-09-15T00:00:00.000Z');
    const lastReviewedAt = new Date(now.getTime() - REVIEW_BOX_INTERVALS_DAYS[0] * DAY_MS).toISOString();
    const due = computeReviewDue({ obj1: mastery({ lastReviewedAt, correctStreak: 0 }) }, now);
    expect(due).toHaveLength(1);
    expect(due[0].objectiveId).toBe('obj1');
    expect(due[0].box).toBe(0);
  });

  it('advances the box with correctStreak, capped at the last rung', () => {
    const now = new Date('2026-09-15T00:00:00.000Z');
    const lastReviewedAt = new Date(now.getTime() - 30 * DAY_MS).toISOString();
    const due = computeReviewDue(
      { obj1: mastery({ lastReviewedAt, correctStreak: 999 }) },
      now,
    );
    expect(due[0].box).toBe(REVIEW_BOX_INTERVALS_DAYS.length - 1);
  });

  it('marks a fresh lapse (streak reset, still in box 0) as missed_recently', () => {
    const now = new Date('2026-09-15T00:00:00.000Z');
    const lastReviewedAt = new Date(now.getTime() - DAY_MS).toISOString();
    const due = computeReviewDue(
      { obj1: mastery({ lastReviewedAt, correctStreak: 0, wrongCount: 1 }) },
      now,
    );
    expect(due[0].reason).toBe('missed_recently');
  });

  it('marks an on-schedule review with no wrong answers as spaced_interval', () => {
    const now = new Date('2026-09-15T00:00:00.000Z');
    const lastReviewedAt = new Date(now.getTime() - 2 * DAY_MS).toISOString();
    const due = computeReviewDue(
      { obj1: mastery({ lastReviewedAt, correctStreak: 1, wrongCount: 0 }) },
      now,
    );
    expect(due[0].reason).toBe('spaced_interval');
  });

  it('sorts multiple due entries most-overdue first', () => {
    const now = new Date('2026-09-15T00:00:00.000Z');
    const dueSoon = new Date(now.getTime() - REVIEW_BOX_INTERVALS_DAYS[0] * DAY_MS).toISOString();
    const dueLongAgo = new Date(now.getTime() - 40 * DAY_MS).toISOString();
    const due = computeReviewDue(
      {
        recent: mastery({ lastReviewedAt: dueSoon, correctStreak: 0 }),
        stale: mastery({ lastReviewedAt: dueLongAgo, correctStreak: 5 }),
      },
      now,
    );
    expect(due.map((d) => d.objectiveId)).toEqual(['stale', 'recent']);
  });
});
