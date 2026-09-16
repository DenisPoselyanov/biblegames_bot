import { useEffect, useMemo, type ReactNode } from 'react';
import { ConfigProvider } from 'react-vant';
import { getCosmeticThemeById, resolveDefaultCosmeticThemeId } from '../data/cosmetics';
import { applyVantThemeToDocument, cosmeticThemeToVantVars } from '../lib/vantTheme';
import { usePlayerProfileStore } from '../stores/playerProfileStore';

export function VantProvider({ children }: { children: ReactNode }) {
  // `||`, not `??` — a fresh server-synced profile's `activeTheme` is `''`
  // (server `emptyProfile()`), not `undefined`, and must still fall back.
  const activeTheme = usePlayerProfileStore((s) => s.profile?.activeTheme || resolveDefaultCosmeticThemeId());
  const theme =
    getCosmeticThemeById(activeTheme) ?? getCosmeticThemeById(resolveDefaultCosmeticThemeId())!;
  const themeVars = useMemo(() => cosmeticThemeToVantVars(theme), [activeTheme]);

  useEffect(() => {
    applyVantThemeToDocument(themeVars);
  }, [themeVars]);

  return (
    <ConfigProvider themeVars={themeVars} style={{ minHeight: '100dvh' }}>
      {children}
    </ConfigProvider>
  );
}
