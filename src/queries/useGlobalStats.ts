import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import type { GlobalStats } from '../types';
import { loadGlobalStats } from '../lib/storage';
import { statsRepo } from '../repos/statsRepo';
import { useGlobalStatsStore } from '../stores/globalStatsStore';
import { queryKeys } from './keys';

export function useGlobalStatsQuery(userId: string) {
  return useQuery({
    queryKey: queryKeys.me.stats(userId),
    queryFn: () => statsRepo.get(),
    enabled: Boolean(userId),
    initialData: () => loadGlobalStats(),
    staleTime: 30_000,
  });
}

export function useGlobalStatsSync(userId: string) {
  const setGlobalStats = useGlobalStatsStore((s) => s.setGlobalStats);
  const query = useGlobalStatsQuery(userId);

  useEffect(() => {
    if (query.data) setGlobalStats(query.data);
  }, [query.data, setGlobalStats]);

  return query;
}

export function useRecordGlobalPlayMutation(userId: string) {
  const queryClient = useQueryClient();
  const setGlobalStats = useGlobalStatsStore((s) => s.setGlobalStats);

  return useMutation({
    mutationFn: ({
      themeId,
      points,
      isNewPlayerForTheme,
    }: {
      themeId: string;
      points: number;
      isNewPlayerForTheme: boolean;
    }) => statsRepo.recordPlay(themeId, points, isNewPlayerForTheme),
    onSuccess: (stats) => {
      setGlobalStats(stats);
      queryClient.setQueryData(queryKeys.me.stats(userId), stats);
    },
  });
}

/**
 * Read-side view of global stats for pages: the store snapshot (or the local
 * fallback) plus the refresh action. `useGlobalStatsSync` must be mounted once
 * near the root to keep the store fed from the server.
 */
export function useGlobalStats(userId: string): {
  globalStats: GlobalStats;
  refreshStats: () => void;
} {
  const stored = useGlobalStatsStore((s) => s.globalStats);
  const globalStats = stored ?? loadGlobalStats();
  const refreshStats = useRefreshGlobalStats(userId);
  return useMemo(() => ({ globalStats, refreshStats }), [globalStats, refreshStats]);
}

export function useRefreshGlobalStats(userId: string) {
  const queryClient = useQueryClient();
  const setGlobalStats = useGlobalStatsStore((s) => s.setGlobalStats);

  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.me.stats(userId) });
    void statsRepo.get().then((stats) => {
      setGlobalStats(stats);
      queryClient.setQueryData(queryKeys.me.stats(userId), stats);
    });
  };
}
