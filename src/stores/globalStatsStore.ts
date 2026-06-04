import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GlobalStats } from '../types';
import { GLOBAL_STATS_STORAGE_KEY } from '../lib/storageKeys';
import { createFieldJsonStorage } from './legacyStorage';

const statsPersistStorage = createFieldJsonStorage<GlobalStats>(
  'globalStats',
  (parsed): parsed is GlobalStats =>
    Boolean(parsed && typeof parsed === 'object' && 'themes' in parsed),
);

interface GlobalStatsState {
  globalStats: GlobalStats | null;
  setGlobalStats: (stats: GlobalStats) => void;
}

export const useGlobalStatsStore = create<GlobalStatsState>()(
  persist(
    (set) => ({
      globalStats: null,
      setGlobalStats: (globalStats) => set({ globalStats }),
    }),
    {
      name: GLOBAL_STATS_STORAGE_KEY,
      storage: statsPersistStorage,
      partialize: (state) => ({ globalStats: state.globalStats }),
    },
  ),
);
