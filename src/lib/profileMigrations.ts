import type { Difficulty, PlayerProfile } from '../types';
import { DEFAULT_COSMETIC_THEME_ID } from '../data/cosmetics';
import { DEFAULT_BOLLS_TRANSLATION, normalizeBollsTranslation } from './bollsConstants';
import { getDefaultPlayerRank } from './practiceProgression';

/**
 * Current persisted-profile schema version. Bump this and append a new entry to
 * MIGRATIONS whenever the persisted PlayerProfile shape changes (renamed field,
 * changed enum values, new field needing a computed default). Never edit or
 * remove a past MIGRATIONS entry — profiles that have sat untouched in
 * localStorage since that version must still be able to replay it.
 */
export const PROFILE_SCHEMA_VERSION = 1;

/** Legacy or in-flight profile JSON: may still carry pre-wallet-consolidation totalPoints. */
export type StoredProfile = Partial<PlayerProfile> & { totalPoints?: number };

const OLD_DIFFICULTY_MAP: Record<string, Difficulty> = {
  beginner: 'baby',
  easy: 'child',
  medium: 'youth',
  hard: 'student',
  expert: 'preacher',
};

function migrateDifficulty(old: string): Difficulty {
  return OLD_DIFFICULTY_MAP[old] ?? (old as Difficulty);
}

/** @deprecated Use migrateProfileWallet — kept for call sites migrating off walletCoins */
export function walletCoins(profile: StoredProfile): number {
  return (profile.coins ?? 0) + (profile.totalPoints ?? 0);
}

/** One-time legacy wallet: sum coins + totalPoints, drop totalPoints from persisted data. */
export function migrateProfileWallet<T extends StoredProfile>(
  profile: T,
): Omit<T, 'totalPoints'> & { coins: number } {
  const coins = walletCoins(profile);
  const { totalPoints: _legacy, ...rest } = profile;
  return { ...rest, coins };
}

/** MIGRATIONS[n] upgrades a stored profile from schema version n to n+1, applied in sequence. */
const MIGRATIONS: Array<(profile: StoredProfile) => StoredProfile> = [
  // v0 -> v1: rename legacy difficulty enum values, consolidate totalPoints+coins into coins.
  (profile) => ({
    ...migrateProfileWallet(profile),
    completedLevels: (profile.completedLevels ?? []).map((l) => ({
      ...l,
      difficulty: migrateDifficulty(l.difficulty),
    })),
  }),
];

function fillDefaults(profile: StoredProfile, userId: string, displayName: string): PlayerProfile {
  return {
    userId,
    displayName: profile.displayName ?? displayName,
    themePoints: profile.themePoints ?? {},
    completedLevels: profile.completedLevels ?? [],
    survivalHighScore: profile.survivalHighScore ?? 0,
    millionaireWins: profile.millionaireWins ?? 0,
    millionaireMaxLevel: profile.millionaireMaxLevel ?? 0,
    unlockedThemes: profile.unlockedThemes?.length ? profile.unlockedThemes : [DEFAULT_COSMETIC_THEME_ID],
    activeTheme: profile.activeTheme ?? DEFAULT_COSMETIC_THEME_ID,
    achievements: profile.achievements ?? [],
    avatar: profile.avatar ?? '',
    coins: profile.coins ?? 0,
    unlockedAvatars: profile.unlockedAvatars ?? [],
    streakDays: profile.streakDays ?? 0,
    lastActiveAt: profile.lastActiveAt ?? null,
    studyMastery: profile.studyMastery ?? {},
    bibleTranslation: normalizeBollsTranslation(profile.bibleTranslation ?? DEFAULT_BOLLS_TRANSLATION),
    practiceTracks: profile.practiceTracks ?? [],
    playerRank: profile.playerRank ?? getDefaultPlayerRank(),
  };
}

/**
 * Replays every migration between `fromVersion` and PROFILE_SCHEMA_VERSION, then
 * fills in defaults for any still-missing field. Safe to call on a fully
 * up-to-date profile (fromVersion === PROFILE_SCHEMA_VERSION) — it just fills
 * defaults with no migrations applied.
 */
export function migrateProfile(
  stored: StoredProfile,
  fromVersion: number,
  userId: string,
  displayName: string,
): PlayerProfile {
  const startVersion = Math.min(Math.max(fromVersion, 0), MIGRATIONS.length);
  let profile = stored;
  for (let v = startVersion; v < MIGRATIONS.length; v++) {
    profile = MIGRATIONS[v](profile);
  }
  return fillDefaults(profile, userId, displayName);
}
