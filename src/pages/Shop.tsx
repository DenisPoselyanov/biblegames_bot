import { usePlayer } from '../context/PlayerContext';
import { AVATARS } from '../data/cosmetics';
import styles from './Shop.module.css';

export function Shop() {
  const { profile, setAvatar, purchaseAvatar } = usePlayer();

  const handleSelectAvatar = (avatarId: string) => {
    setAvatar(avatarId);
  };

  const handleBuyAvatar = (avatarId: string, price: number) => {
    const result = purchaseAvatar(avatarId, price);
    if (!result.purchased) {
      if (result.reason === 'coins') {
        alert('Недостатньо монет для придбання!');
      }
    }
  };

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1>🛍️ Крамниця</h1>
        <p>Купуй аватари за зароблені монети</p>
      </header>

      <div className={styles.balanceCard}>
        <span>Твій баланс:</span>
        <strong>{profile.coins} монет</strong>
      </div>

      <section className={styles.section}>
        <h2>Аватари</h2>
        <div className={styles.avatarsGrid}>
          {AVATARS.map((avatar) => {
            const isUnlocked = profile.unlockedAvatars.includes(avatar.id);
            const isActive = profile.avatar === avatar.id;

            return (
              <div
                key={avatar.id}
                className={`${styles.avatarCard} ${isActive ? styles.activeCard : ''}`}
              >
                <div className={styles.emojiWrapper}>{avatar.emoji}</div>
                <h3>{avatar.title}</h3>
                <div className={styles.action}>
                  {isActive ? (
                    <span className={styles.badgeActive}>Активний</span>
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
                      {avatar.price} монет
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </section>
  );
}
