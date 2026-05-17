import { useMemo } from 'react';
import { THEMES } from '../data/themes';
import { usePlayer } from '../context/PlayerContext';
import styles from './GlobalStats.module.css';

export function GlobalStats() {
  const { globalStats, refreshStats } = usePlayer();

  const ranked = useMemo(() => {
    return THEMES.map((theme) => {
      const stat = globalStats.themes[theme.id];
      return {
        theme,
        totalPoints: stat?.totalPoints ?? 0,
        gamesPlayed: stat?.gamesPlayed ?? 0,
        playersCount: stat?.playersCount ?? 0,
      };
    }).sort((a, b) => b.totalPoints - a.totalPoints);
  }, [globalStats]);

  const grandTotal = ranked.reduce((s, r) => s + r.totalPoints, 0);

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1>Глобальна статистика</h1>
        <p>Очки за всіма тематиками (на цьому пристрої)</p>
        <button type="button" className={styles.refresh} onClick={refreshStats}>
          ↻ Оновити
        </button>
      </header>

      <article className={styles.grandTotal}>
        <span>Усього очок</span>
        <strong>{grandTotal}</strong>
      </article>

      <ul className={styles.list}>
        {ranked.map((item, rank) => {
          const maxPoints = ranked[0]?.totalPoints || 1;
          const width = item.totalPoints > 0 ? (item.totalPoints / maxPoints) * 100 : 0;
          return (
            <li key={item.theme.id} className={styles.item}>
              <span className={styles.rank}>#{rank + 1}</span>
              <span className={styles.icon}>{item.theme.icon}</span>
              <span className={styles.info}>
                <strong>{item.theme.title}</strong>
                <span className={styles.bar}>
                  <span style={{ width: `${width}%`, background: item.theme.color }} />
                </span>
                <small>
                  {item.gamesPlayed} ігор · {item.playersCount} гравців
                </small>
              </span>
              <span className={styles.points}>{item.totalPoints}</span>
            </li>
          );
        })}
      </ul>

      <p className={styles.note}>
        Для справжнього глобального рейтингу між усіма гравцями підключіть backend API
        (Firebase, Supabase або власний сервер).
      </p>
    </section>
  );
}
