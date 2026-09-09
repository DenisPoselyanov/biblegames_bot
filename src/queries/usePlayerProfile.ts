import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { PlayerProfile } from '../types';
import { loadProfile } from '../lib/storage';
import { playerRepo } from '../repos/playerRepo';
import { hasApi } from '../repos/apiClient';
import { usePlayerProfileStore } from '../stores/playerProfileStore';
import { queryKeys } from './keys';

export function usePlayerProfileQuery(userId: string, displayName: string) {
  return useQuery({
    queryKey: queryKeys.me.profile(userId),
    queryFn: () => playerRepo.get(userId, displayName),
    enabled: Boolean(userId),
    initialData: () => loadProfile(userId, displayName),
    staleTime: 30_000,
  });
}

/**
 * Overlay server profile snapshots onto the store, unless this client has a
 * pending local write (`store.dirty`). Dirty is reset on user switch so the new
 * user's profile hydrates from the server.
 */
export function usePlayerProfileSync(userId: string, displayName: string) {
  const setProfile = usePlayerProfileStore((s) => s.setProfile);
  const clearDirty = usePlayerProfileStore((s) => s.clearDirty);
  const dirty = usePlayerProfileStore((s) => s.dirty);
  const query = usePlayerProfileQuery(userId, displayName);

  useEffect(() => {
    clearDirty();
  }, [userId, clearDirty]);

  useEffect(() => {
    if (!query.data || dirty) return;
    setProfile(query.data);
  }, [query.data, dirty, setProfile]);

  return query;
}

export function useSavePlayerProfileMutation(userId: string) {
  const queryClient = useQueryClient();
  const setProfile = usePlayerProfileStore((s) => s.setProfile);

  return useMutation({
    mutationFn: (profile: PlayerProfile) => playerRepo.save(profile),
    onMutate: async (profile) => {
      setProfile(profile);
      await queryClient.cancelQueries({ queryKey: queryKeys.me.profile(userId) });
      const previous = queryClient.getQueryData<PlayerProfile>(queryKeys.me.profile(userId));
      queryClient.setQueryData(queryKeys.me.profile(userId), profile);
      return { previous };
    },
    onError: (_err, _profile, context) => {
      if (context?.previous) {
        setProfile(context.previous);
        queryClient.setQueryData(queryKeys.me.profile(userId), context.previous);
      }
    },
    onSettled: () => {
      if (hasApi()) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.me.profile(userId) });
      }
    },
  });
}
