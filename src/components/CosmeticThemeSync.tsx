import { useEffect } from 'react';
import { applyCosmeticThemeById } from '../lib/cosmeticTheme';
import { usePlayerProfileStore } from '../stores/playerProfileStore';
import { resolveDefaultCosmeticThemeId } from '../data/cosmetics';
import { trackEvent } from '../lib/telemetry';

/**
 * Applies the active cosmetic theme to the document whenever it changes. Mounted
 * once near the app root; renders nothing.
 */
export function CosmeticThemeSync(): null {
  const storedTheme = usePlayerProfileStore((s) => s.profile?.activeTheme);
  // `||`, not `??` — a fresh server-synced profile's `activeTheme` is `''`
  // (server `emptyProfile()`), not `undefined`, and must still fall back.
  const activeTheme = storedTheme || resolveDefaultCosmeticThemeId();

  useEffect(() => {
    applyCosmeticThemeById(activeTheme);
    trackEvent('theme_applied', { themeId: activeTheme });
  }, [activeTheme]);

  return null;
}
