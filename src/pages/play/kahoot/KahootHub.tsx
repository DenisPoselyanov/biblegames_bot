import { Link } from 'react-router-dom';
import { Icon } from '../../../components/Icon';
import styles from './Kahoot.module.css';

const STEP_COLORS = ['#e88d2e', '#d4454a', '#3b82cc'];

export function KahootHub() {
  return (
    <section className={styles.page}>
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

      <article className={styles.hint}>
        <h3>Як це працює</h3>
        <ol className={styles.steps}>
          {['Ведучий обирає теми або плейлист', 'Гравці вводять код кімнати та нікнейм', 'Відповіді на час — більше очок за швидкість'].map((text, i) => (
            <li key={i}>
              <span className={styles.stepBadge} style={{ background: STEP_COLORS[i] }}>
                {i + 1}
              </span>
              {text}
            </li>
          ))}
        </ol>
      </article>

        <p className={styles.serverNote}>
          Потрібен сервер: <code>npm run server</code>
        </p>
        <p className={styles.mutedSmall}>
          Авто/ручний темп · екран залу · поділитися через Telegram · CSV після гри
        </p>
    </section>
  );
}
