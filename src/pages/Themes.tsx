import { Link } from 'react-router-dom';
import { THEMES } from '../data/themes';
import { ThemeCard } from '../components/ThemeCard';
import { usePlayer } from '../context/PlayerContext';
import styles from './Themes.module.css';

export function Themes() {
  const { profile } = usePlayer();

  return (
    <section className={styles.page}>
      <Link to="/play" className={styles.back}>
        ← Режими
      </Link>
      <header className={styles.header}>
        <h1>Соло — тематики</h1>
        <p>Обери розділ Біблії для вивчення</p>
      </header>
      <ul className={styles.grid}>
        {THEMES.map((theme) => (
          <li key={theme.id}>
            <ThemeCard theme={theme} points={profile.themePoints[theme.id]} />
          </li>
        ))}
      </ul>
    </section>
  );
}
