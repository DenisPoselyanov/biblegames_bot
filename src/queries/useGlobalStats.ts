import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
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
