/**
 * Server-derived global stats (Phase 1 §7, §10).
 *
 * The client used to compute `GlobalStats` locally and `PUT /stats/:userId` the
 * whole object. When `authoritativeProfileV2` is on, the progression command
 * derives the per-theme bucket from the reward it just granted instead — a port
 * of `recordGlobalPlay` in src/lib/storage.ts.
 */

import type { GlobalStats, ThemeGlobalStats } from '../../src/types/index';

function asStats(raw: Record<string, unknown> | null | undefined): GlobalStats {
  const themes =
    raw && typeof raw.themes === 'object' && raw.themes !== null
      ? (raw.themes as Record<string, ThemeGlobalStats>)
      : {};
  return { themes, lastUpdated: typeof raw?.lastUpdated === 'string' ? raw.lastUpdated : '' };
}

export function recordThemePlay(
  raw: Record<string, unknown> | null | undefined,
  themeId: string,
  points: number,
  isNewPlayerForTheme: boolean,
  now: Date = new Date(),
): GlobalStats {
  const stats = asStats(raw);
  const theme: ThemeGlobalStats = stats.themes[themeId] ?? {
    themeId,
    totalPoints: 0,
    gamesPlayed: 0,
    playersCount: 0,
  };
  return {
    lastUpdated: now.toISOString(),
    themes: {
      ...stats.themes,
      [themeId]: {
        themeId,
        totalPoints: theme.totalPoints + Math.max(0, points),
        gamesPlayed: theme.gamesPlayed + 1,
        playersCount: theme.playersCount + (isNewPlayerForTheme ? 1 : 0),
      },
    },
  };
}
