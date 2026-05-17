import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getThemeById } from '../data/themes';
import { getQuestionCountByDifficulty, getQuestionCountByDifficultyAsync } from '../data/questions';
import { preloadThemeQuestions } from '../data/questionDbLoader';
import { usePlayer } from '../context/PlayerContext';
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  DIFFICULTY_ORDER,
  DIFFICULTY_POINTS,
} from '../types';
import type { Difficulty } from '../types';
import styles from './ThemeDetail.module.css';

export function ThemeDetail() {
  const { themeId } = useParams<{ themeId: string }>();
  const theme = getThemeById(themeId ?? '');
  const { isLevelDone, profile } = usePlayer();

  if (!theme) {
    return (
      <section className={styles.page}>
        <p>Тематику не знайдено.</p>
        <Link to="/themes">← Назад до тем</Link>
      </section>
    );
  }

  const themePoints = profile.themePoints[theme.id] ?? 0;
  const [questionCounts, setQuestionCounts] = useState<Partial<Record<Difficulty, number>>>({});

  useEffect(() => {
    preloadThemeQuestions(theme.id);
    let cancelled = false;

    Promise.all(
      DIFFICULTIES.map(async (diff) => {
        const count = await getQuestionCountByDifficultyAsync(theme.id, diff);
        return [diff, count] as const;
      }),
    ).then((entries) => {
      if (!cancelled) {
        setQuestionCounts(Object.fromEntries(entries));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [theme.id]);

  const sortedDifficulties = [...DIFFICULTIES].sort(
    (a, b) => DIFFICULTY_ORDER[a] - DIFFICULTY_ORDER[b],
  );

  return (
    <section className={styles.page}>
      <Link to="/play/solo" className={styles.back}>
        ← Теми
      </Link>

      <header
        className={styles.hero}
        style={{ '--accent': theme.color } as React.CSSProperties}
      >
        <span className={styles.icon}>{theme.icon}</span>
        <h1>{theme.title}</h1>
        <p>{theme.description}</p>
        {themePoints > 0 && (
          <span className={styles.pointsBadge}>{themePoints} очок у темі</span>
        )}
      </header>

      <h2 className={styles.subtitle}>Обери складність</h2>

      <ul className={styles.levels}>
        {sortedDifficulties.map((diff) => {
          const done = isLevelDone(theme.id, diff);
          const availableQuestions =
            questionCounts[diff] ?? getQuestionCountByDifficulty(theme.id, diff);
          return (
            <li key={diff}>
              <Link
                to={`/play/solo/quiz/${theme.id}/${diff}`}
                className={`${styles.level} ${done ? styles.done : ''}`}
                data-difficulty={diff}
              >
                <span className={styles.levelLabel}>{DIFFICULTY_LABELS[diff]}</span>
                <span className={styles.levelMeta}>
                  до {DIFFICULTY_POINTS[diff]} очок · {availableQuestions} питань
                </span>
                {done && <span className={styles.badge}>✓ пройдено</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
