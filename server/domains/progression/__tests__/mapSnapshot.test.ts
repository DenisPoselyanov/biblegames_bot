import { describe, expect, it } from 'vitest';
import { snapshotFromProfile, type ProgressionSnapshot } from '../../../progression/completionOutcome';
import { snapshotToState, stateToSnapshot } from '../mapSnapshot';
import type { ProgressionStateRecord } from '../types';

const rich: ProgressionSnapshot = {
  coins: 999,
  wisdom: 42,
  rankTier: 'youth',
  rankPlaque: 4,
  rankUnlockedTier: 'student',
  streakDays: 6,
  lastActiveAt: '2026-06-01T00:00:00.000Z',
  millionaireWins: 2,
  millionaireMaxLevel: 14,
  survivalHighScore: 88,
  completedLevels: [{ themeId: 'genesis', difficulty: 'child', score: 7, maxScore: 7 }],
  achievements: ['flawless-level', 'iron-shield'],
  themePoints: { genesis: 40, exodus: 15 },
  practiceTracks: [
    { themeId: 'genesis', nodeId: 'n1', difficulty: 'child', highestUnlockedStage: 3, stageResults: [{ stageIndex: 0, passed: true }] },
  ],
  studyMastery: { n1: { mastery: 80, confidence: 60, correctStreak: 4, totalAnswers: 5, wrongCount: 1, errorTags: [], lastReviewedAt: null } },
};

function asStateRecord(patch: ReturnType<typeof snapshotToState>): ProgressionStateRecord {
  return { userId: 'u1', schemaVersion: 1, revision: 0, updatedAt: '2026-06-01T00:00:00.000Z', ...patch };
}

describe('mapSnapshot', () => {
  it('snapshotToState → stateToSnapshot round-trips every field except coins', () => {
    const state = asStateRecord(snapshotToState(rich));
    const grants = rich.achievements.map((achievementId) => ({
      userId: 'u1',
      achievementId,
      sourceType: 'progression.completion' as const,
      sourceId: null,
      grantedAt: '2026-06-01T00:00:00.000Z',
      metadata: {},
    }));

    const back = stateToSnapshot(state, grants);
    expect(back).toEqual({ ...rich, coins: 0 }); // coins comes from the wallet, not the row
  });

  it('stateToSnapshot(null) returns the default rank + empty collections', () => {
    const s = stateToSnapshot(null, []);
    expect(s).toMatchObject({
      coins: 0,
      wisdom: 0,
      rankTier: 'baby',
      rankPlaque: 7,
      streakDays: 0,
      completedLevels: [],
      achievements: [],
      practiceTracks: [],
    });
  });

  it('a snapshot derived from the legacy blob maps through cleanly', () => {
    const blob = {
      playerRank: { tier: 'child', plaque: 5, wisdomPoints: 10, unlockedTier: 'youth' },
      streakDays: 3,
      survivalHighScore: 20,
      achievements: ['aesthete'],
      themePoints: { gospels: 12 },
    };
    const snapshot = snapshotFromProfile(blob);
    const back = stateToSnapshot(asStateRecord(snapshotToState(snapshot)), []);
    expect(back.rankTier).toBe('child');
    expect(back.wisdom).toBe(10);
    expect(back.survivalHighScore).toBe(20);
    expect(back.themePoints).toEqual({ gospels: 12 });
  });
});
