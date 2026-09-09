import { useEffect } from 'react';
import { applyCosmeticThemeById } from '../lib/cosmeticTheme';
import { usePlayerProfileStore } from '../stores/playerProfileStore';
import { DEFAULT_COSMETIC_THEME_ID } from '../data/cosmetics';

/**
 * Applies the active cosmetic theme to the document whenever it changes. Mounted
 * once near the app root; renders nothing.
 */
export function CosmeticThemeSync(): null {
  const activeTheme =
    usePlayerProfileStore((s) => s.profile?.activeTheme) ?? DEFAULT_COSMETIC_THEME_ID;

  useEffect(() => {
    applyCosmeticThemeById(activeTheme);
  }, [activeTheme]);

  return null;
}
