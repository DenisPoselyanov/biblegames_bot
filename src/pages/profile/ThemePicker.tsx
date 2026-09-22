/**
 * Theme picker (Phase 3 WS8, spec §14.2 "Тема" / §7.3). Grid of every
 * catalog theme; equipping an owned/free theme is instant, tapping an
 * unowned paid one routes to the Shop instead of faking a local purchase
 * (ADR-009 — purchase flow is Phase 6's, this screen only equips).
 */
import { useNavigate } from 'react-router-dom';
import { AppPage, PageHeader, ThemePreview } from '../../components/ui';
import { COSMETIC_THEMES } from '../../data/cosmetics';
import { useResolvedProfile } from '../../hooks/domain/useProfileWriter';
import { usePreferences } from '../../hooks/usePreferences';
import { useToast } from '../../components/Toast';
import { haptic } from '../../lib/telegram';
import styles from './ThemePicker.module.css';

export function ThemePicker() {
  const navigate = useNavigate();
  const profile = useResolvedProfile();
  const { activeTheme, setActiveTheme } = usePreferences();
  const { showToast } = useToast();

  const handleSelect = (themeId: string, owned: boolean) => {
    if (!owned) {
      navigate('/shop');
      return;
    }
    haptic.selection();
    if (!setActiveTheme(themeId)) {
      showToast('Не вдалося застосувати тему', 'error');
    }
  };

  return (
    <AppPage className={styles.page}>
      <PageHeader title="Оформлення" onBack={() => navigate('/profile/settings')} />
      <div className={styles.grid}>
        {COSMETIC_THEMES.map((theme) => {
          const owned = theme.price === 0 || profile.unlockedThemes.includes(theme.id);
          return (
            <div key={theme.id} className={styles.item}>
              <ThemePreview
                theme={theme}
                active={theme.id === activeTheme}
                onSelect={() => handleSelect(theme.id, owned)}
              />
              {!owned && <span className={styles.price}>{theme.price} монет</span>}
            </div>
          );
        })}
      </div>
    </AppPage>
  );
}
