import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PlayerProfile } from '../types';
import { PROFILE_STORAGE_KEY } from '../lib/storageKeys';
import { migrateProfile, PROFILE_SCHEMA_VERSION, type StoredProfile } from '../lib/profileMigrations';
import { createFieldJsonStorage } from './legacyStorage';

const profilePersistStorage = createFieldJsonStorage<PlayerProfile>(
  'profile',
  (parsed): parsed is PlayerProfile =>
    Boolean(parsed && typeof parsed === 'object' && 'userId' in parsed),
);

interface PlayerProfileState {
  profile: PlayerProfile | null;
  /**
   * True once this client has made a local write the server hasn't confirmed via
   * refetch. While set, `usePlayerProfileSync` stops overlaying server snapshots
   * (authoritative fields already merge in through `applyOutcome`). Reset only on
   * user switch. Not persisted.
   */
  dirty: boolean;
  setProfile: (profile: PlayerProfile) => void;
  patchProfile: (updater: (current: PlayerProfile) => PlayerProfile) => void;
  markDirty: () => void;
  clearDirty: () => void;
}

export const usePlayerProfileStore = create<PlayerProfileState>()(
  persist(
    (set, get) => ({
      profile: null,
      dirty: false,
      setProfile: (profile) => set({ profile }),
      patchProfile: (updater) => {
        const current = get().profile;
        if (!current) return;
        set({ profile: updater(current) });
      },
      markDirty: () => set({ dirty: true }),
      clearDirty: () => set({ dirty: false }),
    }),
    {
      name: PROFILE_STORAGE_KEY,
      storage: profilePersistStorage,
      version: PROFILE_SCHEMA_VERSION,
      migrate: (persistedState, fromVersion) => {
        const state = persistedState as { profile?: StoredProfile | null } | null;
        if (!state?.profile) return (state ?? { profile: null }) as PlayerProfileState;
        const profile = migrateProfile(
          state.profile,
          fromVersion,
          state.profile.userId ?? '',
          state.profile.displayName ?? '',
        );
        return { ...state, profile } as PlayerProfileState;
      },
      partialize: (state) => ({ profile: state.profile }),
    },
  ),
);
