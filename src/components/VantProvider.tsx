import { useEffect, useMemo, type ReactNode } from 'react';
import { ConfigProvider } from 'react-vant';
import { DEFAULT_COSMETIC_THEME_ID, getCosmeticThemeById } from '../data/cosmetics';
import { applyVantThemeToDocument, cosmeticThemeToVantVars } from '../lib/vantTheme';
import { usePlayerProfileStore } from '../stores/playerProfileStore';

export function VantProvider({ children }: { children: ReactNode }) {
  const activeTheme = usePlayerProfileStore(
    (s) => s.profile?.activeTheme ?? DEFAULT_COSMETIC_THEME_ID,
  );
  const theme =
    getCosmeticThemeById(activeTheme) ?? getCosmeticThemeById(DEFAULT_COSMETIC_THEME_ID)!;
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
