import { Link } from 'react-router-dom';
import type { Theme } from '../types';
import { getQuestionCountByTheme } from '../data/questions';
import styles from './ThemeCard.module.css';

interface ThemeCardProps {
  theme: Theme;
  points?: number;
  mastery?: number;
}

export function ThemeCard({ theme, points, mastery = 0 }: ThemeCardProps) {
  const questionsCount = getQuestionCountByTheme(theme.id);

  return (
    <Link
      to={`/play/study/themes/${theme.id}`}
      className={styles.card}
      style={{ '--accent': theme.color } as React.CSSProperties}
    >
      <div className={styles.cardLeft}>
        <div className={styles.cardLeftContent}>
          <h3>{theme.title}</h3>
          <p>{theme.description}</p>
          <div className={styles.cardMeta}>
            <span className={styles.qCount}>📝 {questionsCount} питань</span>
            {mastery > 0 && (
              <span className={styles.masteryPct}>{Math.round(mastery)}%</span>
            )}
          </div>
          {points !== undefined && points > 0 && (
            <span className={styles.points}>⭐ {points} очок</span>
          )}
        </div>
      </div>
      <div
        className={styles.cardRight}
        style={{ background: theme.color }}
      >
        <span className={styles.cardIcon}>{theme.icon}</span>
      </div>
    </Link>
  );
}
