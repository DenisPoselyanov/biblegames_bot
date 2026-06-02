import { Link } from 'react-router-dom';
import { GAME_MODES } from '../../types/gameModes';
import { Icon } from '../../components/Icon';
import type { IconName } from '../../components/Icon';
import { MotionStagger, MotionStaggerItem } from '../../components/motion';
import { useMotionEntrance } from '../../hooks/useMotionEntrance';
import styles from './PlayHub.module.css';

interface ModeArt {
  icon: IconName;
  gradient: string;
}

const MODE_ART: Record<string, ModeArt> = {
  study: {
    icon: 'study',
    gradient: 'linear-gradient(145deg, #c9a227, #8b6914)',
  },
  millionaire: {
    icon: 'diamond',
    gradient: 'linear-gradient(145deg, #8b5cf6, #6d28d9)',
  },
  survival: {
    icon: 'survival',
    gradient: 'linear-gradient(145deg, #ef4444, #b91c1c)',
  },
  kahoot: {
    icon: 'kahoot',
    gradient: 'linear-gradient(145deg, #06b6d4, #0369a1)',
  },
};

function badgeClass(badge?: string) {
  if (!badge) return '';
  if (badge === 'NEW') return styles.badgeNew;
  if (badge === 'Мультиплеєр') return styles.badgeMultiplayer;
  return styles.badgeDefault;
}

export function PlayHub() {
  const { shouldEnter } = useMotionEntrance('play-hub');
  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1>Режими гри</h1>
        <p>Обери, як хочеш грати сьогодні</p>
      </header>

      <MotionStagger as="ul" className={styles.modes} enter={shouldEnter}>
        {GAME_MODES.map((mode) => {
          const art = MODE_ART[mode.id];
          const featured = mode.id === 'study';

          return (
            <MotionStaggerItem as="li" key={mode.id}>
              {mode.available ? (
                <Link
                  to={mode.path}
                  className={`${styles.card}${featured ? ` ${styles.cardFeatured}` : ''}`}
                >
                  <div className={styles.cardBody}>
                    <div className={styles.cardHeader}>
                      <h2>{mode.title}</h2>
                      {mode.badge && (
                        <span className={`${styles.badge} ${badgeClass(mode.badge)}`}>
                          {mode.badge}
                        </span>
                      )}
                    </div>
                    <p className={styles.cardDesc}>{mode.description}</p>
                  </div>
                  <div
                    className={`${styles.cardArt}${featured ? ` ${styles.cardArtFeatured}` : ''}`}
                  >
                    <div className={styles.cardArtBg} style={{ background: art.gradient }} />
                    <Icon name={art.icon} size={featured ? 96 : 72} className={styles.cardArtIcon} />
                  </div>
                </Link>
              ) : (
                <div className={`${styles.card} ${styles.disabled}`}>
                  <div className={styles.cardBody}>
                    <div className={styles.cardHeader}>
                      <h2>{mode.title}</h2>
                      <span className={`${styles.badge} ${styles.badgeSoon}`}>Незабаром</span>
                    </div>
                    <p className={styles.cardDesc}>{mode.description}</p>
                  </div>
                  <div className={styles.cardArt}>
                    <div className={styles.cardArtBg} style={{ background: art.gradient }} />
                    <Icon name={art.icon} size={72} className={styles.cardArtIcon} />
                  </div>
                </div>
              )}
            </MotionStaggerItem>
          );
        })}
      </MotionStagger>
    </section>
  );
}
