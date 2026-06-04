import type { Difficulty, GlobalStats, PlayerProfile } from '../types';
import { THEMES } from '../data/themes';
import { DEFAULT_COSMETIC_THEME_ID } from '../data/cosmetics';
import { DEFAULT_BOLLS_TRANSLATION, normalizeBollsTranslation } from './bollsConstants';
import { getDefaultPlayerRank } from './practiceProgression';
import { GLOBAL_STATS_STORAGE_KEY, PROFILE_STORAGE_KEY } from './storageKeys';
import { useGlobalStatsStore } from '../stores/globalStatsStore';
import { usePlayerProfileStore } from '../stores/playerProfileStore';

export { GLOBAL_STATS_STORAGE_KEY, PROFILE_STORAGE_KEY } from './storageKeys';

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

/** Legacy profile JSON may still include totalPoints before migration. */
export type ProfileWithLegacyWallet = Partial<PlayerProfile> & { totalPoints?: number };

/** @deprecated Use migrateProfileWallet — kept for call sites migrating off walletCoins */
export function walletCoins(profile: ProfileWithLegacyWallet): number {
  return (profile.coins ?? 0) + (profile.totalPoints ?? 0);
}

/** One-time legacy wallet: sum coins + totalPoints, drop totalPoints from persisted data. */
export function migrateProfileWallet<T extends ProfileWithLegacyWallet>(
  profile: T,
): Omit<T, 'totalPoints'> & { coins: number } {
  const coins = walletCoins(profile);
  const { totalPoints: _legacy, ...rest } = profile;
  return { ...rest, coins };
}

function normalizeProfile(
  profile: ProfileWithLegacyWallet,
  userId: string,
  displayName: string,
): PlayerProfile {
  return migrateProfileWallet({
    totalPoints: profile.totalPoints,
    userId,
    displayName: profile.displayName ?? displayName,
    themePoints: profile.themePoints ?? {},
    completedLevels: (profile.completedLevels ?? []).map((l) => ({
      ...l,
      difficulty: migrateDifficulty(l.difficulty),
    })),
    survivalHighScore: profile.survivalHighScore ?? 0,
    millionaireWins: profile.millionaireWins ?? 0,
    millionaireMaxLevel: profile.millionaireMaxLevel ?? 0,
    unlockedThemes: profile.unlockedThemes?.length
      ? profile.unlockedThemes
      : [DEFAULT_COSMETIC_THEME_ID],
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
  });
}

function emptyGlobalStats(): GlobalStats {
  const themes: GlobalStats['themes'] = {};
  for (const theme of THEMES) {
    themes[theme.id] = {
      themeId: theme.id,
      totalPoints: 0,
      gamesPlayed: 0,
      playersCount: 0,
    };
  }
  return { themes, lastUpdated: new Date().toISOString() };
}

function readProfileFromLocalStorage(userId: string, displayName: string): PlayerProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProfileWithLegacyWallet & PlayerProfile;
    if (parsed.userId === userId) return normalizeProfile(parsed, userId, displayName);
  } catch {
    /* ignore */
  }
  return null;
}

function readGlobalStatsFromLocalStorage(): GlobalStats | null {
  try {
    const raw = localStorage.getItem(GLOBAL_STATS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GlobalStats;
    const base = emptyGlobalStats();
    return {
      themes: { ...base.themes, ...parsed.themes },
      lastUpdated: parsed.lastUpdated,
    };
  } catch {
    /* ignore */
  }
  return null;
}

export function loadProfile(userId: string, displayName: string): PlayerProfile {
  const fromStore = usePlayerProfileStore.getState().profile;
  if (fromStore?.userId === userId) return fromStore;

  const fromDisk = readProfileFromLocalStorage(userId, displayName);
  const profile = fromDisk ?? normalizeProfile({}, userId, displayName);
  usePlayerProfileStore.getState().setProfile(profile);
  return profile;
}

export function saveProfile(profile: PlayerProfile): void {
  usePlayerProfileStore.getState().setProfile(profile);
}

export function loadGlobalStats(): GlobalStats {
  const fromStore = useGlobalStatsStore.getState().globalStats;
  if (fromStore) return fromStore;

  const fromDisk = readGlobalStatsFromLocalStorage();
  const stats = fromDisk ?? emptyGlobalStats();
  useGlobalStatsStore.getState().setGlobalStats(stats);
  return stats;
}

export function saveGlobalStats(stats: GlobalStats): void {
  useGlobalStatsStore.getState().setGlobalStats({
    ...stats,
    lastUpdated: new Date().toISOString(),
  });
}

export function recordGlobalPlay(
  themeId: string,
  points: number,
  isNewPlayerForTheme: boolean,
): GlobalStats {
  const stats = loadGlobalStats();
  const theme = stats.themes[themeId] ?? {
    themeId,
    totalPoints: 0,
    gamesPlayed: 0,
    playersCount: 0,
  };
  theme.totalPoints += points;
  theme.gamesPlayed += 1;
  if (isNewPlayerForTheme) theme.playersCount += 1;
  stats.themes[themeId] = theme;
  saveGlobalStats(stats);
  return stats;
}
