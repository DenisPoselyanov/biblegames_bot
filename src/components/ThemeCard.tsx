import { Link } from 'react-router-dom';
import type { Theme } from '../types';
import { getQuestionCountByTheme } from '../data/questions';
import styles from './ThemeCard.module.css';

interface ThemeCardProps {
  theme: Theme;
  points?: number;
}

export function ThemeCard({ theme, points }: ThemeCardProps) {
  const questionsCount = getQuestionCountByTheme(theme.id);

  return (
    <Link
      to={`/play/study/themes/${theme.id}`}
      className={styles.card}
      style={{ '--accent': theme.color } as React.CSSProperties}
    >
      <span className={styles.icon}>{theme.icon}</span>
      <div className={styles.body}>
        <h3>{theme.title}</h3>
        <p>{theme.description}</p>
        <div className={styles.meta}>
          <span className={styles.questionCount}>📝 {questionsCount} питань</span>
          {points !== undefined && points > 0 && (
            <span className={styles.points}>⭐ {points} очок</span>
          )}
        </div>
      </div>
    </Link>
  );
}
