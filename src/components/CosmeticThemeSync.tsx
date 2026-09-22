import { useEffect } from 'react';
import { applyCosmeticThemeById } from '../lib/cosmeticTheme';
import { usePlayerProfileStore } from '../stores/playerProfileStore';
import { resolveDefaultCosmeticThemeId } from '../data/cosmetics';
import { isFeatureEnabled } from '../lib/flags';
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

  // Phase 3.5: the non-color half of design-v2 (radii, type scale) lives in
  // `src/index.css` under `:root[data-design-v2='on']`. Set once, from the
  // same flag the shell reads — flag off leaves the attribute absent and the
  // whole block unmatched.
  useEffect(() => {
    const root = document.documentElement;
    if (!isFeatureEnabled('designSystemV2')) {
      root.removeAttribute('data-design-v2');
      return;
    }
    root.setAttribute('data-design-v2', 'on');
  }, []);

  return null;
}
