import { Link } from 'react-router-dom';
import styles from './Kahoot.module.css';

export function KahootHub() {
  return (
    <section className={styles.page}>
      <Link to="/play" className={styles.back}>
        ← Режими
      </Link>

      <header className={styles.heroKahoot}>
        <span className={styles.heroIcon}>⚡</span>
        <h1>Кімната Kahoot</h1>
        <p>Грайте разом: ведучий створює кімнату, інші приєднуються за кодом</p>
      </header>

      <div className={styles.actions}>
        <Link to="/play/kahoot/create" className={styles.btnPrimary}>
          Створити кімнату
        </Link>
        <Link to="/play/kahoot/join" className={styles.btnSecondary}>
          Приєднатися за кодом
        </Link>
      </div>

      <article className={styles.hint}>
        <h3>Як це працює</h3>
        <ol>
          <li>Ведучий обирає теми та кількість питань</li>
          <li>Гравці вводять код кімнати та нікнейм</li>
          <li>Відповіді на час — більше очок за швидкість</li>
        </ol>
        <p className={styles.serverNote}>
          Потрібен запущений сервер: <code>npm run server</code>
        </p>
      </article>
    </section>
  );
}
