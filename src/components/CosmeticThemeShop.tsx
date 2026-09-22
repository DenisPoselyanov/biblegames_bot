import { useResolvedProfile } from '../hooks/domain/useProfileWriter';
import { useEconomy } from '../hooks/domain/useEconomy';
import { usePreferences } from '../hooks/usePreferences';
import { useToast } from './Toast';
import { Icon } from './Icon';
import { COSMETIC_THEMES } from '../data/cosmetics';
import { haptic } from '../lib/telegram';
import { MotionStagger, MotionStaggerItem } from './motion';
import { isFeatureEnabled } from '../lib/flags';
import { Button, ContentCard, Pill } from './ui';
import styles from './CosmeticThemeShop.module.css';

interface CosmeticThemeShopProps {
  /** Skip entrance stagger when user already visited the shop this session */
  enter?: boolean;
}

export function CosmeticThemeShop({ enter = true }: CosmeticThemeShopProps) {
  const profile = useResolvedProfile();
  const { purchaseTheme } = useEconomy();
  const { setActiveTheme } = usePreferences();
  const { showToast } = useToast();
  const designSystemV2 = isFeatureEnabled('designSystemV2');

  const handleSelectTheme = (themeId: string) => {
    haptic.selection();
    setActiveTheme(themeId);
    showToast('Тему застосовано', 'success');
  };

  const handleBuyTheme = async (themeId: string) => {
    const result = await purchaseTheme(themeId);
    if (!result.purchased) {
      if (result.reason === 'coins') {
        showToast('Недостатньо монет для придбання цієї теми!', 'error');
      }
      return;
    }
    haptic.notification('success');
    showToast('Тему придбано!', 'success');
  };

  return (
    <MotionStagger
      as="div"
      className={designSystemV2 ? styles.grid : styles.carousel}
      enter={enter}
    >
      {COSMETIC_THEMES.map((theme) => {
        const isUnlocked = profile.unlockedThemes.includes(theme.id) || theme.price === 0;
        const isActive = profile.activeTheme === theme.id;
        const preview = (
          <div className={styles.preview} style={{ background: theme.preview.background }}>
            <div className={styles.previewSurface} style={{ background: theme.preview.surface }}>
              <span style={{ color: theme.preview.text }}>Aa</span>
              <span className={styles.accentDot} style={{ background: theme.preview.accent }} />
            </div>
            <span className={styles.primaryDot} style={{ background: theme.preview.primary }} />
          </div>
        );
        return (
          <MotionStaggerItem as="div" key={theme.id}>
            {designSystemV2 ? (
              <ContentCard variant="compact" className={styles.cardV2}>
                {preview}
                <h3>{theme.title}</h3>
                <p>{theme.description}</p>
                {isActive ? (
                  <Pill tone="accent">Активна</Pill>
                ) : isUnlocked ? (
                  <Button size="sm" fullWidth variant="secondary" onClick={() => handleSelectTheme(theme.id)}>
                    Застосувати
                  </Button>
                ) : (
                  <Button size="sm" fullWidth onClick={() => void handleBuyTheme(theme.id)}>
                    <Icon name="coins" size={14} />
                    {theme.price}
                  </Button>
                )}
              </ContentCard>
            ) : (
              <div className={`${styles.card} ${isActive ? styles.cardActive : ''}`}>
                {preview}
                <h3>{theme.title}</h3>
                <p>{theme.description}</p>
                {isActive ? (
                  <span className={styles.badgeActive}>Активна</span>
                ) : isUnlocked ? (
                  <button type="button" className={styles.btnApply} onClick={() => handleSelectTheme(theme.id)}>
                    Застосувати
                  </button>
                ) : (
                  <button type="button" className={styles.btnBuy} onClick={() => void handleBuyTheme(theme.id)}>
                    <Icon name="star" size={14} />
                    {theme.price}
                  </button>
                )}
              </div>
            )}
          </MotionStaggerItem>
        );
      })}
    </MotionStagger>
  );
}
