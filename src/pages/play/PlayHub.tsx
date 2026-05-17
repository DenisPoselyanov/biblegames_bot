import { Link } from 'react-router-dom';
import { GAME_MODES } from '../../types/gameModes';
import styles from './PlayHub.module.css';

export function PlayHub() {
  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1>Режими гри</h1>
        <p>Обери, як хочеш грати сьогодні</p>
      </header>

      <ul className={styles.modes}>
        {GAME_MODES.map((mode) => (
          <li key={mode.id}>
            {mode.available ? (
              <Link to={mode.path} className={styles.card}>
                <span className={styles.icon}>{mode.icon}</span>
                <div className={styles.cardBody}>
                  <h2>{mode.title}</h2>
                  {mode.badge && <span className={styles.badge}>{mode.badge}</span>}
                  <p>{mode.description}</p>
                </div>
                <span className={styles.arrow}>→</span>
              </Link>
            ) : (
              <div className={`${styles.card} ${styles.disabled}`}>
                <span className={styles.icon}>{mode.icon}</span>
                <div className={styles.cardBody}>
                  <h2>{mode.title}</h2>
                  <span className={styles.badgeSoon}>Незабаром</span>
                  <p>{mode.description}</p>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
