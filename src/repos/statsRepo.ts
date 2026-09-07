import type { GlobalStats } from '../types';
import { loadGlobalStats, recordGlobalPlay, saveGlobalStats } from '../lib/storage';
import { apiV1Fetch, hasApi } from './apiClient';

/**
 * Global stats are server-derived from progression completions (WS4 part 2
 * removed the legacy client-computed `PUT /stats/:userId` whole-object write).
 * This repo is read-through: `recordPlay` only updates the local mirror.
 */
export const statsRepo = {
  async get(): Promise<GlobalStats> {
    const local = loadGlobalStats();
    if (!hasApi()) return local;
    try {
      const response = await apiV1Fetch('/me/stats');
      if (!response.ok) return local;
      const remote = (await response.json()) as GlobalStats;
      saveGlobalStats(remote);
      return remote;
    } catch {
      return local;
    }
  },

  async recordPlay(
    themeId: string,
    points: number,
    isNewPlayerForTheme: boolean,
  ): Promise<GlobalStats> {
    // The server records the play from the progression completion command; here
    // we only keep the local mirror fresh for offline reads.
    return recordGlobalPlay(themeId, points, isNewPlayerForTheme);
  },
};
