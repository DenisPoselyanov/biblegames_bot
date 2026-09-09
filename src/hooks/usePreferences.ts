import { useCallback, useMemo } from 'react';
import {
  normalizeBollsTranslation,
  type BollsTranslation,
} from '../lib/bollsConstants';
import { DEFAULT_COSMETIC_THEME_ID, getCosmeticThemeById } from '../data/cosmetics';
import { trackEvent } from '../lib/telemetry';
import { loadProfile } from '../lib/storage';
import { usePlayerProfileStore } from '../stores/playerProfileStore';
import { useAuthSession } from '../context/AuthSessionContext';
import { usePersistProfile } from './usePersistProfile';

export interface PreferencesValue {
  activeTheme: string;
  bibleTranslation: BollsTranslation;
  avatar: string;
  /** Equip an owned cosmetic theme. Returns false if unknown or not owned. */
  setActiveTheme: (themeId: string) => boolean;
  /** Equip an owned avatar (or `''` to clear). Returns false if not owned. */
  setAvatar: (avatarId: string) => boolean;
  setBibleTranslation: (translation: BollsTranslation) => void;
}

/**
 * Client-owned preference writes — the only fields the client PATCHes to the
 * server (`activeTheme` / `avatar` are further constrained to owned items server
 * side; the checks here are UX-only). Reads select straight off the profile
 * store; writes go through the shared `usePersistProfile` path. Ownership
 * (`unlockedThemes` / `unlockedAvatars`) stays authoritative and is only read.
 */
export function usePreferences(): PreferencesValue {
  const { userId, displayName } = useAuthSession();
  const persistProfile = usePersistProfile(userId);

  const activeTheme =
    usePlayerProfileStore((s) => s.profile?.activeTheme) ?? DEFAULT_COSMETIC_THEME_ID;
  const avatar = usePlayerProfileStore((s) => s.profile?.avatar) ?? '';
  const bibleTranslation = normalizeBollsTranslation(
    usePlayerProfileStore((s) => s.profile?.bibleTranslation),
  );

  // Base every write on the resolved profile (store snapshot or local fallback),
  // never bail when the store hasn't hydrated yet — an early tap must still land.
  const setActiveTheme = useCallback(
    (themeId: string) => {
      const profile = loadProfile(userId, displayName);
      if (!getCosmeticThemeById(themeId) || !profile.unlockedThemes.includes(themeId)) {
        return false;
      }
      persistProfile({ ...profile, activeTheme: themeId });
      return true;
    },
    [userId, displayName, persistProfile],
  );

  const setAvatar = useCallback(
    (avatarId: string) => {
      const profile = loadProfile(userId, displayName);
      if (avatarId !== '' && !profile.unlockedAvatars.includes(avatarId)) return false;
      persistProfile({ ...profile, avatar: avatarId });
      return true;
    },
    [userId, displayName, persistProfile],
  );

  const setBibleTranslation = useCallback(
    (translation: BollsTranslation) => {
      const profile = loadProfile(userId, displayName);
      const nextTranslation = normalizeBollsTranslation(translation);
      persistProfile({ ...profile, bibleTranslation: nextTranslation });
      trackEvent('bible_translation_changed', { translation: nextTranslation });
    },
    [userId, displayName, persistProfile],
  );

  return useMemo(
    () => ({
      activeTheme,
      bibleTranslation,
      avatar,
      setActiveTheme,
      setAvatar,
      setBibleTranslation,
    }),
    [activeTheme, bibleTranslation, avatar, setActiveTheme, setAvatar, setBibleTranslation],
  );
}
