import type { GlobalStats } from '../types';
import { loadGlobalStats, recordGlobalPlay } from '../lib/storage';
import { saveGlobalStats } from '../lib/storage';
import { apiFetch, apiV1Fetch, hasApi } from './apiClient';
import { isFeatureEnabled } from '../lib/flags';

function isAuthoritative(): boolean {
  return hasApi() && isFeatureEnabled('authoritative_profile');
}

export const statsRepo = {
  async get(userId?: string): Promise<GlobalStats> {
    const local = loadGlobalStats();

    if (isAuthoritative()) {
      // Server derives global stats from progression completions; read-only here.
      try {
        const response = await apiV1Fetch('/me/stats');
        if (!response.ok) return local;
        const remote = (await response.json()) as GlobalStats;
        saveGlobalStats(remote);
        return remote;
      } catch {
        return local;
      }
    }

    if (!hasApi() || !userId) return local;
    try {
      const response = await apiFetch(`/stats/${userId}`, userId);
      if (!response.ok) return local;
      const remote = (await response.json()) as GlobalStats;
      const themes = { ...remote.themes };
      for (const [themeId, localTheme] of Object.entries(local.themes)) {
        const remoteTheme = themes[themeId] ?? { themeId, totalPoints: 0, gamesPlayed: 0, playersCount: 0 };
        themes[themeId] = {
          themeId,
          totalPoints: Math.max(remoteTheme.totalPoints, localTheme.totalPoints),
          gamesPlayed: Math.max(remoteTheme.gamesPlayed, localTheme.gamesPlayed),
          playersCount: Math.max(remoteTheme.playersCount, localTheme.playersCount),
        };
      }
      const merged: GlobalStats = { themes, lastUpdated: new Date().toISOString() };
      saveGlobalStats(merged);
      await apiFetch(`/stats/${userId}`, userId, {
        method: 'PUT',
        body: JSON.stringify(merged),
      });
      return merged;
    } catch {
      return local;
    }
  },
  async recordPlay(themeId: string, points: number, isNewPlayerForTheme: boolean, userId?: string): Promise<GlobalStats> {
    const updated = recordGlobalPlay(themeId, points, isNewPlayerForTheme);
    // Authoritative mode: the server records the play from the completion command.
    if (isAuthoritative()) return updated;
    if (!hasApi() || !userId) return updated;
    try {
      await apiFetch(`/stats/${userId}`, userId, {
        method: 'PUT',
        body: JSON.stringify(updated),
      });
    } catch {
      /* noop */
    }
    return updated;
  },
};
