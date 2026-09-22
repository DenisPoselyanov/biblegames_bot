import { Link } from 'react-router-dom';
import { Icon } from '../../../components/Icon';
import { FullscreenMotion, MotionStagger, MotionStaggerItem } from '../../../components/motion';
import { isFeatureEnabled } from '../../../lib/flags';
import { Button, CoverArt } from '../../../components/ui';
import styles from './Kahoot.module.css';

const STEP_COLORS = ['#e88d2e', '#d4454a', '#3b82cc'];

const STEPS = [
  'Ведучий обирає теми або плейлист',
  'Гравці вводять код кімнати та нікнейм',
  'Відповіді на час — більше очок за швидкість',
];

export function KahootHub() {
  const designSystemV2 = isFeatureEnabled('designSystemV2');

  return (
    <FullscreenMotion motionKey="kahoot-hub">
    <section className={styles.page}>
      {designSystemV2 ? (
        /* Proto `KahootHub`: a back control and the room's name share one row,
           then the create action becomes the screen's coloured main object. */
        <header className={styles.hubHeader}>
          <Link to="/play" className={styles.backBtn} aria-label="Назад">
            <Icon name="back" size={16} />
          </Link>
          <div>
            <h1 className={styles.hubTitle}>Жива вікторина</h1>
            <p className={styles.hubSubtitle}>Одна кімната — до 40 гравців</p>
          </div>
        </header>
      ) : (
        <>
          <div className={styles.topRow}>
            <Link to="/play" className={styles.backBtn} aria-label="Назад">
              <Icon name="back" size={20} />
            </Link>
          </div>

          <header className={styles.heroKahoot}>
            <div className={styles.heroIconWrap}>
              <span className={styles.heroIcon}>⚡</span>
            </div>
            <h1>Кімната Kahoot</h1>
            <p>Грайте разом: ведучий створює кімнату, інші приєднуються за кодом</p>
          </header>
        </>
      )}

      {designSystemV2 ? (
        <>
          <div className={styles.hubHero}>
            <CoverArt seed="kahoot" glyph="wave" hue={168} scrim className={styles.hubHeroCover} />
            <div className={styles.hubHeroBody}>
              <h2 className={styles.hubHeroTitle}>Новий добір</h2>
              <p className={styles.hubHeroText}>Зберіть питання з банку або з власного списку</p>
              <Link to="/play/kahoot/create" className={styles.hubHeroAction}>
                <Button variant="onColor" size="lg" fullWidth>
                  <Icon name="play-solid" size={16} />
                  Створити кімнату
                </Button>
              </Link>
            </div>
          </div>

          <Link to="/play/kahoot/join" className={styles.btnOutline}>
            Приєднатися за кодом
          </Link>

          <Link to="/play/kahoot/playlists" className={styles.hubRow}>
            <span className={styles.hubRowIcon}>
              <Icon name="book" size={18} />
            </span>
            <span className={styles.hubRowMain}>
              <span className={styles.hubRowTitle}>Мої набори</span>
              <span className={styles.hubRowMeta}>Готові списки питань для кімнати</span>
            </span>
            <Icon name="chevron-right" size={16} className={styles.hubRowChevron} />
          </Link>
        </>
      ) : (
        <div className={styles.actions}>
          <Link to="/play/kahoot/create" className={styles.btnPrimary}>
            Створити кімнату
          </Link>
          <Link to="/play/kahoot/join" className={styles.btnOutline}>
            Приєднатися за кодом
          </Link>
          <Link to="/play/kahoot/playlists" className={styles.playlistLink}>
            📋 Плейлисти
          </Link>
        </div>
      )}

      <article className={styles.hint}>
        <h3>Як це працює</h3>
        <MotionStagger as="ol" className={styles.steps}>
          {STEPS.map((text, i) => (
            <MotionStaggerItem as="li" key={i}>
              <span
                className={styles.stepBadge}
                style={designSystemV2 ? undefined : { background: STEP_COLORS[i] }}
              >
                {i + 1}
              </span>
              {text}
            </MotionStaggerItem>
          ))}
        </MotionStagger>
      </article>

        <p className={styles.serverNote}>
          Потрібен сервер: <code>npm run server</code>
        </p>
        <p className={styles.mutedSmall}>
          Авто/ручний темп · екран залу · поділитися через Telegram · CSV після гри
        </p>
    </section>
    </FullscreenMotion>
  );
}
