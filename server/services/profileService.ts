/**
 * Shared profile read/write logic used by both the legacy `/profile/:userId`
 * routes and the self-scoped `/api/v1/me/*` routes (Phase 1 §5.3, §7.1).
 *
 * WS2 keeps the existing whole-profile write behavior; WS3 replaces it with
 * bounded server-authoritative commands.
 */

import type { ServerStore } from '../db/store';
import { migrateProfileWallet, type ProfileWithLegacyWallet } from '../../src/lib/storage';
import { isServerFeatureEnabled } from '../lib/flags';
import { recomputeStreak } from '../lib/streak';
import { sanitizeProfileBody } from '../middleware/validateBody';

/** The default profile returned when a user has no stored record yet. */
export function emptyProfile(userId: string): Record<string, unknown> {
  return {
    userId,
    displayName: '',
    themePoints: {},
    completedLevels: [],
    survivalHighScore: 0,
    millionaireWins: 0,
    millionaireMaxLevel: 0,
    unlockedThemes: [],
    activeTheme: '',
    achievements: [],
    avatar: '',
    coins: 0,
    unlockedAvatars: [],
    streakDays: 0,
    lastActiveAt: null,
    studyMastery: {},
    bibleTranslation: 'UTT',
    practiceTracks: [],
    playerRank: { tier: 'baby', plaque: 7, wisdomPoints: 0, unlockedTier: 'child' },
  };
}

export async function readProfile(
  dbStore: ServerStore,
  userId: string,
): Promise<Record<string, unknown>> {
  const profile = await dbStore.getProfile(userId);
  if (!profile) return emptyProfile(userId);
  return migrateProfileWallet(profile as ProfileWithLegacyWallet);
}

export async function writeProfile(
  dbStore: ServerStore,
  userId: string,
  body: unknown,
): Promise<void> {
  const existing = (await dbStore.getProfile(userId)) ?? {};
  const sanitized = sanitizeProfileBody(userId, body);
  const streakOverride = isServerFeatureEnabled('server_streak')
    ? recomputeStreak(existing.lastActiveAt, existing.streakDays)
    : {};
  const merged = migrateProfileWallet({
    ...existing,
    ...sanitized,
    ...streakOverride,
    userId,
  });
  await dbStore.setProfile(userId, { ...merged, updatedAt: new Date().toISOString() });
}
