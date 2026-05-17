import type { GlobalStats, PlayerProfile } from '../types';
import { THEMES } from '../data/themes';

const PROFILE_KEY = 'bible-game-profile';
const GLOBAL_STATS_KEY = 'bible-game-global-stats';

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

export function loadProfile(userId: string, displayName: string): PlayerProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PlayerProfile;
      if (parsed.userId === userId) return parsed;
    }
  } catch {
    /* ignore */
  }
  return {
    userId,
    displayName,
    totalPoints: 0,
    themePoints: {},
    completedLevels: [],
  };
}

export function saveProfile(profile: PlayerProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function loadGlobalStats(): GlobalStats {
  try {
    const raw = localStorage.getItem(GLOBAL_STATS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GlobalStats;
      const base = emptyGlobalStats();
      return {
        themes: { ...base.themes, ...parsed.themes },
        lastUpdated: parsed.lastUpdated,
      };
    }
  } catch {
    /* ignore */
  }
  return emptyGlobalStats();
}

export function saveGlobalStats(stats: GlobalStats): void {
  localStorage.setItem(
    GLOBAL_STATS_KEY,
    JSON.stringify({ ...stats, lastUpdated: new Date().toISOString() }),
  );
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
