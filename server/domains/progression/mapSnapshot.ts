/**
 * The one place that couples the progression *storage* shape
 * (`ProgressionStateRecord`) to the reward *engine* shape (`ProgressionSnapshot`
 * from `server/progression/completionOutcome.ts`). Pure — no I/O.
 *
 * `coins` and `achievements` are not columns on `progression_state`: `coins` is
 * authoritative in `wallet_ledger` and `achievements` in `achievement_grants`.
 * `stateToSnapshot` fills `achievements` from the grant list and leaves `coins`
 * at 0 for the caller to overlay from the wallet (exactly as the route does).
 */
import type {
  Difficulty,
  MasteryState,
  PracticeTrackProgress,
} from '../../../src/types/index';
import type { ProgressionSnapshot } from '../../progression/completionOutcome';
import { getDefaultPlayerRank } from '../../progression/rankMath';
import type {
  AchievementGrantRecord,
  ProgressionStatePatch,
  ProgressionStateRecord,
} from './types';

/** Engine `next` snapshot → the columns/bags a `progression_state` write touches. */
export function snapshotToState(snapshot: ProgressionSnapshot): ProgressionStatePatch {
  return {
    rankTier: snapshot.rankTier,
    rankPlaque: snapshot.rankPlaque,
    wisdomPoints: snapshot.wisdom,
    rankUnlockedTier: snapshot.rankUnlockedTier,
    streakDays: snapshot.streakDays,
    lastActiveAt: snapshot.lastActiveAt,
    millionaireWins: snapshot.millionaireWins,
    millionaireMaxLevel: snapshot.millionaireMaxLevel,
    survivalHighScore: snapshot.survivalHighScore,
    completedLevels: snapshot.completedLevels,
    themePoints: snapshot.themePoints,
    practiceTracks: snapshot.practiceTracks as unknown as Array<Record<string, unknown>>,
    studyMastery: snapshot.studyMastery as unknown as Record<string, Record<string, unknown>>,
  };
}

/**
 * Stored row (+ achievement grants) → the engine's read shape. `coins` is left
 * at 0; the caller overlays `walletLedger.getBalance()`.
 */
export function stateToSnapshot(
  state: ProgressionStateRecord | null,
  grants: AchievementGrantRecord[],
): ProgressionSnapshot {
  const achievements = grants.map((g) => g.achievementId);
  if (!state) {
    const rank = getDefaultPlayerRank();
    return {
      coins: 0,
      wisdom: rank.wisdomPoints,
      rankTier: rank.tier,
      rankPlaque: rank.plaque,
      rankUnlockedTier: rank.unlockedTier,
      streakDays: 0,
      lastActiveAt: null,
      millionaireWins: 0,
      millionaireMaxLevel: 0,
      survivalHighScore: 0,
      completedLevels: [],
      achievements,
      themePoints: {},
      practiceTracks: [],
      studyMastery: {},
    };
  }
  return {
    coins: 0,
    wisdom: state.wisdomPoints,
    rankTier: state.rankTier as Difficulty,
    rankPlaque: state.rankPlaque,
    rankUnlockedTier: state.rankUnlockedTier as Difficulty,
    streakDays: state.streakDays,
    lastActiveAt: state.lastActiveAt,
    millionaireWins: state.millionaireWins,
    millionaireMaxLevel: state.millionaireMaxLevel,
    survivalHighScore: state.survivalHighScore,
    completedLevels: state.completedLevels,
    achievements,
    themePoints: state.themePoints,
    practiceTracks: state.practiceTracks as unknown as PracticeTrackProgress[],
    studyMastery: state.studyMastery as unknown as Record<string, MasteryState>,
  };
}
