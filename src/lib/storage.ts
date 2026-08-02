import type { GlobalStats, PlayerProfile } from '../types';
import { THEMES } from '../data/themes';
import { GLOBAL_STATS_STORAGE_KEY, PROFILE_STORAGE_KEY } from './storageKeys';
import { migrateProfile, type StoredProfile } from './profileMigrations';
import { useGlobalStatsStore } from '../stores/globalStatsStore';
import { usePlayerProfileStore } from '../stores/playerProfileStore';

export { GLOBAL_STATS_STORAGE_KEY, PROFILE_STORAGE_KEY } from './storageKeys';
export {
  migrateProfileWallet,
  walletCoins,
  PROFILE_SCHEMA_VERSION,
  type StoredProfile as ProfileWithLegacyWallet,
} from './profileMigrations';

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

/** Unwraps the `{ profile, __v }` envelope written by legacyStorage.ts, falling back to raw flat PlayerProfile JSON. */
function readStoredProfileEnvelope(raw: string): { profile: StoredProfile; version: number } | null {
  const parsed = JSON.parse(raw) as unknown;
  if (parsed && typeof parsed === 'object' && 'profile' in parsed && '__v' in parsed) {
    const { profile, __v } = parsed as { profile: StoredProfile; __v: number };
    return { profile, version: __v };
  }
  if (parsed && typeof parsed === 'object' && 'userId' in parsed) {
    return { profile: parsed as StoredProfile, version: 0 };
  }
  return null;
}

function readProfileFromLocalStorage(userId: string, displayName: string): PlayerProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const envelope = readStoredProfileEnvelope(raw);
    if (envelope?.profile.userId === userId) {
      return migrateProfile(envelope.profile, envelope.version, userId, displayName);
    }
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
  const profile = fromDisk ?? migrateProfile({}, 0, userId, displayName);
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
