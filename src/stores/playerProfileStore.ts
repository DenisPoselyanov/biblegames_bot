import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PlayerProfile } from '../types';
import { PROFILE_STORAGE_KEY } from '../lib/storageKeys';
import { createFieldJsonStorage } from './legacyStorage';

const profilePersistStorage = createFieldJsonStorage<PlayerProfile>(
  'profile',
  (parsed): parsed is PlayerProfile =>
    Boolean(parsed && typeof parsed === 'object' && 'userId' in parsed),
);

interface PlayerProfileState {
  profile: PlayerProfile | null;
  setProfile: (profile: PlayerProfile) => void;
  patchProfile: (updater: (current: PlayerProfile) => PlayerProfile) => void;
}

export const usePlayerProfileStore = create<PlayerProfileState>()(
  persist(
    (set, get) => ({
      profile: null,
      setProfile: (profile) => set({ profile }),
      patchProfile: (updater) => {
        const current = get().profile;
        if (!current) return;
        set({ profile: updater(current) });
      },
    }),
    {
      name: PROFILE_STORAGE_KEY,
      storage: profilePersistStorage,
      partialize: (state) => ({ profile: state.profile }),
    },
  ),
);
