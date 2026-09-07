import { describe, expect, it } from 'vitest';
import { AppError } from '../lib/errors';
import {
  computeCompletion,
  snapshotFromProfile,
  type CompletionInput,
} from './completionOutcome';
import { emptyProfile } from '../services/profileService';

const base = () => snapshotFromProfile(emptyProfile('u1'));

describe('computeCompletion — level', () => {
  it('awards DIFFICULTY_POINTS * accuracy and records the level', () => {
    const res = computeCompletion(
      { kind: 'level', difficulty: 'child', themeId: 'gospels', correctCount: 7, totalQuestions: 7 },
      base(),
    );
    expect(res.delta.coins).toBe(15); // child = 15, perfect accuracy
    expect(res.next.coins).toBe(15);
    expect(res.next.completedLevels).toHaveLength(1);
    expect(res.delta.achievementsGranted).toContain('flawless-level');
  });

  it('caps at DIFFICULTY_POINTS and rounds by accuracy', () => {
    const res = computeCompletion(
      { kind: 'level', difficulty: 'youth', themeId: 't', correctCount: 3, totalQuestions: 6 },
      base(),
    );
    expect(res.delta.coins).toBe(15); // youth 30 * 0.5
  });

  it('rejects correctCount > totalQuestions', () => {
    expect(() =>
      computeCompletion(
        { kind: 'level', difficulty: 'child', themeId: 't', correctCount: 9, totalQuestions: 7 },
        base(),
      ),
    ).toThrow(AppError);
  });

  it('rejects an unknown difficulty', () => {
    expect(() =>
      computeCompletion(
        { kind: 'level', difficulty: 'wizard', themeId: 't', correctCount: 1, totalQuestions: 1 } as CompletionInput,
        base(),
      ),
    ).toThrow(/difficulty/);
  });
});

describe('computeCompletion — practice_stage', () => {
  it('grants wisdom and advances rank on a pass', () => {
    const res = computeCompletion(
      { kind: 'practice_stage', difficulty: 'child', themeId: 't', correctCount: 10, totalQuestions: 10 },
      base(),
    );
    expect(res.delta.wisdom).toBe(12); // child base 8 * 1.5 perfect bonus
    expect(res.next.wisdom).toBe(12); // below the 20 plaque threshold, no rank change
    expect(res.delta.rankChanged).toBe(false);
    expect(res.delta.coins).toBe(15);
  });

  it('grants nothing on a fail (< 7 correct)', () => {
    const res = computeCompletion(
      { kind: 'practice_stage', difficulty: 'child', themeId: 't', correctCount: 3, totalQuestions: 10 },
      base(),
    );
    expect(res.delta.coins).toBe(0);
    expect(res.delta.wisdom).toBe(0);
  });
});

describe('computeCompletion — millionaire & survival', () => {
  it('millionaire awards per level + a win bonus when the run is finished', () => {
    const res = computeCompletion(
      { kind: 'millionaire', reachedLevel: 10, runLength: 10 },
      base(),
    );
    expect(res.delta.coins).toBe(10 * 25 + 150);
    expect(res.next.millionaireWins).toBe(1);
    expect(res.next.millionaireMaxLevel).toBe(10);
  });

  it('millionaire without finishing gives no win', () => {
    const res = computeCompletion({ kind: 'millionaire', reachedLevel: 4, runLength: 10 }, base());
    expect(res.delta.coins).toBe(100);
    expect(res.next.millionaireWins).toBe(0);
  });

  it('survival caps the score and tracks the high score', () => {
    const res = computeCompletion({ kind: 'survival', score: 5000 }, base());
    expect(res.delta.coins).toBe(1000); // SURVIVAL_MAX_SCORE
    expect(res.next.survivalHighScore).toBe(1000);
  });
});

describe('streak', () => {
  it('recomputes the streak server-side (ignores client streakDays)', () => {
    const yesterday = new Date('2026-01-01T12:00:00Z');
    const today = new Date('2026-01-02T12:00:00Z');
    const current = { ...base(), streakDays: 999, lastActiveAt: yesterday.toISOString() };
    const res = computeCompletion(
      { kind: 'survival', score: 1 },
      current,
      today,
    );
    expect(res.next.streakDays).toBe(1000); // 999 + 1, not the client's 999
  });
});
