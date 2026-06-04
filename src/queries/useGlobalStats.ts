import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { loadGlobalStats } from '../lib/storage';
import { statsRepo } from '../repos/statsRepo';
import { useGlobalStatsStore } from '../stores/globalStatsStore';
import { statsKeys } from './keys';

export function useGlobalStatsQuery(userId: string) {
  return useQuery({
    queryKey: statsKeys.byUser(userId),
    queryFn: () => statsRepo.get(userId),
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
    }) => statsRepo.recordPlay(themeId, points, isNewPlayerForTheme, userId),
    onSuccess: (stats) => {
      setGlobalStats(stats);
      queryClient.setQueryData(statsKeys.byUser(userId), stats);
    },
  });
}

export function useRefreshGlobalStats(userId: string) {
  const queryClient = useQueryClient();
  const setGlobalStats = useGlobalStatsStore((s) => s.setGlobalStats);

  return () => {
    void queryClient.invalidateQueries({ queryKey: statsKeys.byUser(userId) });
    void statsRepo.get(userId).then((stats) => {
      setGlobalStats(stats);
      queryClient.setQueryData(statsKeys.byUser(userId), stats);
    });
  };
}
