import { THEMES } from '../data/themes';
import { usePlayer } from '../context/PlayerContext';
import { useTelegram } from '../hooks/useTelegram';
import { DIFFICULTY_LABELS } from '../types';
import styles from './Profile.module.css';

export function Profile() {
  const { profile } = usePlayer();
  const { displayName, userId } = useTelegram();

  const themeProgress = THEMES.map((theme) => ({
    theme,
    points: profile.themePoints[theme.id] ?? 0,
    levels: profile.completedLevels.filter((l) => l.themeId === theme.id),
  })).filter((t) => t.points > 0 || t.levels.length > 0);

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <span className={styles.avatar}>📖</span>
        <h1>{displayName}</h1>
        <p className={styles.id}>ID: {userId}</p>
      </header>

      <article className={styles.totalCard}>
        <span className={styles.totalLabel}>Загальний рахунок</span>
        <strong className={styles.totalValue}>{profile.totalPoints}</strong>
        <span className={styles.totalUnit}>очок</span>
      </article>

      <section>
        <h2 className={styles.sectionTitle}>Прогрес за темами</h2>
        {themeProgress.length === 0 ? (
          <p className={styles.empty}>
            Ще немає очок. Обери тематику та пройди перший рівень!
          </p>
        ) : (
          <ul className={styles.themeList}>
            {themeProgress.map(({ theme, points, levels }) => (
              <li key={theme.id} className={styles.themeItem}>
                <span className={styles.themeIcon}>{theme.icon}</span>
                <span className={styles.themeInfo}>
                  <strong>{theme.title}</strong>
                  <small>
                    {points} очок · {levels.length} рівн.
                    {levels.length > 0 &&
                      ` (${levels.map((l) => DIFFICULTY_LABELS[l.difficulty][0]).join(', ')})`}
                  </small>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {profile.completedLevels.length > 0 && (
        <section>
          <h2 className={styles.sectionTitle}>Останні рівні</h2>
          <ul className={styles.history}>
            {[...profile.completedLevels]
              .reverse()
              .slice(0, 8)
              .map((level, i) => {
                const theme = THEMES.find((t) => t.id === level.themeId);
                return (
                  <li key={`${level.themeId}-${level.difficulty}-${i}`}>
                    <span>
                      {theme?.icon} {theme?.title} — {DIFFICULTY_LABELS[level.difficulty]}
                    </span>
                    <span>
                      {level.score}/{level.maxScore}
                    </span>
                  </li>
                );
              })}
          </ul>
        </section>
      )}
    </section>
  );
}
