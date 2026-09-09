import { useCallback } from 'react';
import type { PlayerProfile } from '../types';
import { usePlayerProfileStore } from '../stores/playerProfileStore';
import { useSavePlayerProfileMutation } from '../queries/usePlayerProfile';

/**
 * The single client write path for the player profile: mark the store dirty (so
 * `usePlayerProfileSync` stops overlaying server snapshots), push the new value
 * into the store, and fire the preference-whitelist PATCH. Shared by
 * `PlayerContext` (progression/economy) and `usePreferences`.
 */
export function usePersistProfile(userId: string): (next: PlayerProfile) => void {
  const setProfile = usePlayerProfileStore((s) => s.setProfile);
  const markDirty = usePlayerProfileStore((s) => s.markDirty);
  const saveProfileMutation = useSavePlayerProfileMutation(userId);

  return useCallback(
    (next: PlayerProfile) => {
      markDirty();
      setProfile(next);
      saveProfileMutation.mutate(next);
    },
    [markDirty, setProfile, saveProfileMutation],
  );
}
