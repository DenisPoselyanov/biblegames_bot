import { Link } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import { useTelegram } from '../hooks/useTelegram';
import { GAME_MODES } from '../types/gameModes';
import styles from './Home.module.css';

export function Home() {
  const { profile } = usePlayer();
  const { displayName } = useTelegram();

  return (
    <section className={styles.page}>
      <header className={styles.hero}>
        <span className={styles.cross}>✝</span>
        <h1>Біблійна гра</h1>
        <p>Вивчай Святе Письмо через запитання та відповіді</p>
      </header>

      <p className={styles.greeting}>Мир тобі, {displayName}!</p>

      <ul className={styles.statsRow}>
        <li className={styles.stat}>
          <strong>{profile.totalPoints}</strong>
          <span>очок</span>
        </li>
        <li className={styles.stat}>
          <strong>{profile.completedLevels.length}</strong>
          <span>рівнів</span>
        </li>
        <li className={styles.stat}>
          <strong>
            {Object.keys(profile.themePoints).filter((k) => profile.themePoints[k] > 0).length}
          </strong>
          <span>тем</span>
        </li>
      </ul>

      <Link to="/play" className={styles.cta}>
        Обрати режим гри →
      </Link>

      <section className={styles.modesPreview}>
        <h2>Режими</h2>
        <ul>
          {GAME_MODES.map((m) => (
            <li key={m.id}>
              <Link to={m.path}>
                {m.icon} {m.title}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.how}>
        <h2>Як грати</h2>
        <ol>
          <li>Обери режим: соло або кімната Kahoot</li>
          <li>Соло: тематика → складність → 7 питань</li>
          <li>Kahoot: код кімнати, нікнейм, відповіді на час</li>
        </ol>
      </section>
    </section>
  );
}
