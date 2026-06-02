import { usePlayer } from '../context/PlayerContext';
import { useToast } from '../components/Toast';
import { AVATARS } from '../data/cosmetics';
import { CosmeticThemeShop } from '../components/CosmeticThemeShop';
import { Icon } from '../components/Icon';
import { haptic } from '../lib/telegram';
import { MotionStagger, MotionStaggerItem } from '../components/motion';
import { useMotionEntrance } from '../hooks/useMotionEntrance';
import styles from './Shop.module.css';

export function Shop() {
  const { shouldEnter } = useMotionEntrance('shop');
  const { profile, setAvatar, purchaseAvatar } = usePlayer();
  const { showToast } = useToast();

  const handleSelectAvatar = (avatarId: string) => {
    haptic.selection();
    setAvatar(avatarId);
    showToast('Аватар обрано', 'success');
  };

  const handleBuyAvatar = (avatarId: string, price: number) => {
    const result = purchaseAvatar(avatarId, price);
    if (!result.purchased) {
      if (result.reason === 'coins') {
        showToast('Недостатньо монет для придбання!', 'error');
      }
      return;
    }
    haptic.notification('success');
    showToast('Аватар придбано!', 'success');
  };

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1>Крамниця</h1>
        <div className={styles.balanceRow}>
          <span className={styles.balancePill}>
            <Icon name="coins" size={16} />
            {profile.coins}
          </span>
        </div>
      </header>

      <section className={styles.section}>
        <h2>Біблійні теми</h2>
        <p className={styles.sectionHint}>Змінюй оформлення гри. Оплата монетами.</p>
        <CosmeticThemeShop enter={shouldEnter} />
      </section>

      <section className={styles.section}>
        <h2>Аватари</h2>
        <p className={styles.sectionHint}>Оплата монетами.</p>
        <MotionStagger as="div" className={styles.avatarsGrid} enter={shouldEnter}>
          {AVATARS.map((avatar) => {
            const isUnlocked = profile.unlockedAvatars.includes(avatar.id);
            const isActive = profile.avatar === avatar.id;
            return (
              <MotionStaggerItem
                as="div"
                key={avatar.id}
                className={`${styles.avatarCard} ${isActive ? styles.activeCard : ''}`}
              >
                <div className={styles.avatarVisual}>
                  <span className={styles.avatarEmoji}>{avatar.emoji}</span>
                </div>
                <div className={styles.avatarInfo}>
                  <h3>{avatar.title}</h3>
                  <div className={styles.action}>
                    {isActive ? (
                      <span className={styles.badgeActive}>Екіпіровано</span>
                    ) : isUnlocked ? (
                      <button
                        className={styles.btnApply}
                        onClick={() => handleSelectAvatar(avatar.id)}
                      >
                        Вибрати
                      </button>
                    ) : (
                      <button
                        className={styles.btnBuy}
                        onClick={() => handleBuyAvatar(avatar.id, avatar.price)}
                      >
                        <Icon name="coins" size={14} />
                        {avatar.price}
                      </button>
                    )}
                  </div>
                </div>
              </MotionStaggerItem>
            );
          })}
        </MotionStagger>
      </section>
    </section>
  );
}
