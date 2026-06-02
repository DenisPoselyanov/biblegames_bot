import { usePlayer } from '../context/PlayerContext';
import { useToast } from './Toast';
import { Icon } from './Icon';
import { COSMETIC_THEMES } from '../data/cosmetics';
import { haptic } from '../lib/telegram';
import { MotionStagger, MotionStaggerItem } from './motion';
import styles from './CosmeticThemeShop.module.css';

interface CosmeticThemeShopProps {
  /** Skip entrance stagger when user already visited the shop this session */
  enter?: boolean;
}

export function CosmeticThemeShop({ enter = true }: CosmeticThemeShopProps) {
  const { profile, setActiveTheme, purchaseTheme } = usePlayer();
  const { showToast } = useToast();

  const handleSelectTheme = (themeId: string) => {
    haptic.selection();
    setActiveTheme(themeId);
    showToast('Тему застосовано', 'success');
  };

  const handleBuyTheme = (themeId: string) => {
    const result = purchaseTheme(themeId);
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
    <MotionStagger as="div" className={styles.carousel} enter={enter}>
      {COSMETIC_THEMES.map((theme) => {
        const isUnlocked = profile.unlockedThemes.includes(theme.id) || theme.price === 0;
        const isActive = profile.activeTheme === theme.id;
        return (
          <MotionStaggerItem as="div" key={theme.id} className={`${styles.card} ${isActive ? styles.cardActive : ''}`}>
            <div className={styles.preview} style={{ background: theme.preview.background }}>
              <div className={styles.previewSurface} style={{ background: theme.preview.surface }}>
                <span style={{ color: theme.preview.text }}>Aa</span>
                <span className={styles.accentDot} style={{ background: theme.preview.accent }} />
              </div>
              <span className={styles.primaryDot} style={{ background: theme.preview.primary }} />
            </div>
            <h3>{theme.title}</h3>
            <p>{theme.description}</p>
            {isActive ? (
              <span className={styles.badgeActive}>Активна</span>
            ) : isUnlocked ? (
              <button type="button" className={styles.btnApply} onClick={() => handleSelectTheme(theme.id)}>
                Застосувати
              </button>
            ) : (
              <button type="button" className={styles.btnBuy} onClick={() => handleBuyTheme(theme.id)}>
                <Icon name="star" size={14} />
                {theme.price}
              </button>
            )}
          </MotionStaggerItem>
        );
      })}
    </MotionStagger>
  );
}
