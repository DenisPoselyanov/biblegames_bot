import { useCallback } from 'react';
import type { PlayerProfile } from '../../types';
import { loadProfile } from '../../lib/storage';
import { useAuthSession } from '../../context/AuthSessionContext';
import { usePlayerProfileStore } from '../../stores/playerProfileStore';
import { usePersistProfile } from '../usePersistProfile';

/**
 * Resolve the current player's profile: the store snapshot when it belongs to
 * the active principal, otherwise the local fallback for that user. Read-only —
 * for consumers that just render profile fields.
 */
export function useResolvedProfile(): PlayerProfile {
  const { userId, displayName } = useAuthSession();
  const stored = usePlayerProfileStore((s) => s.profile);
  return stored?.userId === userId ? stored : loadProfile(userId, displayName);
}

export interface ProfileWriter {
  profile: PlayerProfile;
  /** Full replacement through the shared dirty-mark + PATCH path. */
  persistProfile: (next: PlayerProfile) => void;
  /** Functional update over the resolved profile. */
  updateProfile: (updater: (current: PlayerProfile) => PlayerProfile) => void;
}

/**
 * The write-side counterpart to {@link useResolvedProfile}: the resolved profile
 * plus the two mutators every domain hook needs. All writes funnel through
 * `usePersistProfile`, so the store is marked dirty and the preference-whitelist
 * PATCH fires exactly once per call.
 */
export function useProfileWriter(): ProfileWriter {
  const { userId, displayName } = useAuthSession();
  const profile = useResolvedProfile();
  const persistProfile = usePersistProfile(userId);

  const updateProfile = useCallback(
    (updater: (current: PlayerProfile) => PlayerProfile) => {
      // Resolve the base at call time, not render time: `loadProfile` returns the
      // live store snapshot when it matches the principal, so back-to-back or
      // async updaters (achievement grants during a run, `recordAnswerEvent`'s
      // `.then`) compose instead of clobbering a stale closure value.
      persistProfile(updater(loadProfile(userId, displayName)));
    },
    [userId, displayName, persistProfile],
  );

  return { profile, persistProfile, updateProfile };
}
