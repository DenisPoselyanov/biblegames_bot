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
  const isTopicNode = (theme as any)._isTopicNode;
  const isAggregateNode = (theme as any)._isAggregateNode;
  const isThemeNode = (theme as any)._isThemeNode;
  const baseThemeId = (theme as any)._baseThemeId;
  const nodeId = (theme as any)._nodeId;
  const themeId = (theme as any)._themeId;
  const questionsCount = isTopicNode ? 0 : isAggregateNode ? 0 : isThemeNode ? getQuestionCountByTheme(themeId ?? theme.id) : getQuestionCountByTheme(theme.id);

  let toPath: string;
  if (isAggregateNode) {
    toPath = `/play/study/themes/${baseThemeId}/${nodeId}`;
  } else if (isThemeNode) {
    toPath = `/play/study/themes/${themeId}`;
  } else if (isTopicNode) {
    toPath = `/play/study/themes/${baseThemeId}/${theme.id}`;
  } else {
    toPath = `/play/study/themes/${theme.id}`;
  }

  return (
    <Link
      to={toPath}
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
