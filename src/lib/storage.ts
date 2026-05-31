import type { Difficulty, GlobalStats, PlayerProfile } from '../types';
import { THEMES } from '../data/themes';
import { DEFAULT_COSMETIC_THEME_ID } from '../data/cosmetics';
import { DEFAULT_BOLLS_TRANSLATION, normalizeBollsTranslation } from './bollsConstants';

const PROFILE_KEY = 'bible-game-profile';
const GLOBAL_STATS_KEY = 'bible-game-global-stats';

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

function normalizeProfile(profile: Partial<PlayerProfile>, userId: string, displayName: string): PlayerProfile {
  return {
    userId,
    displayName: profile.displayName ?? displayName,
    totalPoints: profile.totalPoints ?? 0,
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
  };
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

export function loadProfile(userId: string, displayName: string): PlayerProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PlayerProfile;
      if (parsed.userId === userId) return normalizeProfile(parsed, userId, displayName);
    }
  } catch {
    /* ignore */
  }
  return normalizeProfile({}, userId, displayName);
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
