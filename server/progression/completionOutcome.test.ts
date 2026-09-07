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

describe('computeCompletion — practice_stage track derivation', () => {
  it('records a stage result and unlocks the next stage on a pass', () => {
    const res = computeCompletion(
      {
        kind: 'practice_stage',
        difficulty: 'child',
        themeId: 't',
        nodeId: 'n1',
        stageIndex: 0,
        correctCount: 8,
        totalQuestions: 10,
      },
      base(),
    );
    expect(res.next.practiceTracks).toHaveLength(1);
    const track = res.next.practiceTracks[0];
    expect(track.highestUnlockedStage).toBe(1);
    expect(track.stageResults[0]).toMatchObject({ stageIndex: 0, passed: true, attempts: 1 });
    expect(res.delta.nextStageUnlocked).toBe(true);
    expect(res.delta.passed).toBe(true);
  });

  it('re-running an already-aced stage grants 0 coins and 0 wisdom', () => {
    const first = computeCompletion(
      { kind: 'practice_stage', difficulty: 'child', themeId: 't', nodeId: 'n1', stageIndex: 0, correctCount: 10, totalQuestions: 10 },
      base(),
    );
    expect(first.delta.coins).toBeGreaterThan(0);
    expect(first.delta.wisdom).toBeGreaterThan(0);

    const replay = computeCompletion(
      { kind: 'practice_stage', difficulty: 'child', themeId: 't', nodeId: 'n1', stageIndex: 0, correctCount: 10, totalQuestions: 10 },
      first.next,
    );
    expect(replay.delta.coins).toBe(0);
    expect(replay.delta.wisdom).toBe(0);
    expect(replay.next.practiceTracks[0].stageResults[0].attempts).toBe(2);
  });

  it('a failed stage does not unlock the next one', () => {
    const res = computeCompletion(
      { kind: 'practice_stage', difficulty: 'child', themeId: 't', nodeId: 'n1', stageIndex: 0, correctCount: 3, totalQuestions: 10 },
      base(),
    );
    expect(res.next.practiceTracks[0].highestUnlockedStage).toBe(0);
    expect(res.delta.nextStageUnlocked).toBe(false);
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
    expect(res.delta.achievementsGranted).toContain('biblical-millionaire');
  });

  it('millionaire loss does not grant biblical-millionaire', () => {
    const res = computeCompletion({ kind: 'millionaire', reachedLevel: 4, runLength: 10 }, base());
    expect(res.delta.achievementsGranted).not.toContain('biblical-millionaire');
  });

  it('survival grants iron-shield at 30+ and not below', () => {
    expect(
      computeCompletion({ kind: 'survival', score: 30 }, base()).delta.achievementsGranted,
    ).toContain('iron-shield');
    expect(
      computeCompletion({ kind: 'survival', score: 29 }, base()).delta.achievementsGranted,
    ).not.toContain('iron-shield');
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
