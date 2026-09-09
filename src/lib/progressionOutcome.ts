import type { PlayerProfile } from '../types';
import { hasApi } from '../repos/apiClient';
import type { ProgressionOutcome } from '../repos/progressionRepo';

/**
 * The server-authoritative `/api/v1` command surface is the only remote path
 * (WS4 part 2 removed the `authoritative_profile` flag and the legacy fallback).
 * When there's no API base configured we run fully local.
 */
export function authoritativeEnabled(): boolean {
  return hasApi();
}

/** Overlay the server-authoritative snapshot onto the local profile, keeping client-owned fields. */
export function applyOutcome(current: PlayerProfile, outcome: ProgressionOutcome): PlayerProfile {
  const n = outcome.next;
  return {
    ...current,
    coins: n.coins,
    playerRank: {
      tier: n.rankTier,
      plaque: n.rankPlaque,
      wisdomPoints: n.wisdom,
      unlockedTier: n.rankUnlockedTier,
    },
    streakDays: n.streakDays,
    lastActiveAt: n.lastActiveAt,
    completedLevels: n.completedLevels as unknown as PlayerProfile['completedLevels'],
    achievements: n.achievements,
    themePoints: n.themePoints,
    practiceTracks: n.practiceTracks,
    studyMastery: n.studyMastery,
    millionaireWins: n.millionaireWins,
    millionaireMaxLevel: n.millionaireMaxLevel,
    survivalHighScore: n.survivalHighScore,
  };
}
