import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getThemeById } from '../data/themes';
import { getQuestionCountByDifficulty, getQuestionCountByDifficultyAsync } from '../data/questions';
import { usePlayer } from '../context/PlayerContext';
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  DIFFICULTY_ORDER,
  DIFFICULTY_POINTS,
} from '../types';
import type { Difficulty } from '../types';
import { Icon } from '../components/Icon';
import styles from './ThemeDetail.module.css';

export function ThemeDetail() {
  const { themeId } = useParams<{ themeId: string }>();
  const theme = getThemeById(themeId ?? '');
  const { isLevelDone, profile } = usePlayer();

  if (!theme) {
    return (
      <section className={styles.page}>
        <p>Тематику не знайдено.</p>
        <Link to="/play/study">← Назад до тем</Link>
      </section>
    );
  }

  const themePoints = profile.themePoints[theme.id] ?? 0;
  const [questionCounts, setQuestionCounts] = useState<Partial<Record<Difficulty, number>>>({});

  useEffect(() => {
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
      <div className={styles.topRow}>
        <Link to="/play/study/themes" className={styles.backBtn} aria-label="Назад">
          <Icon name="back" size={20} />
        </Link>
      </div>

      <header className={styles.hero}>
        <span className={styles.icon}>{theme.icon}</span>
        <h1>{theme.title}</h1>
        <p>{theme.description}</p>
        <div className={styles.heroChips}>
          <span className={styles.heroChip}>{theme.icon} {theme.title}</span>
          {themePoints > 0 && (
            <span className={styles.heroChipPoints}>
              <Icon name="star" size={12} /> {themePoints} очок
            </span>
          )}
        </div>
      </header>

      <h2 className={styles.subtitle}>Обери рівень складності</h2>

      <ul className={styles.levels}>
        {sortedDifficulties.map((diff) => {
          const done = isLevelDone(theme.id, diff);
          const completedLevel = profile.completedLevels.find(
            (l) => l.themeId === theme.id && l.difficulty === diff,
          );
          const availableQuestions =
            questionCounts[diff] ?? getQuestionCountByDifficulty(theme.id, diff);
          const diffIndex = DIFFICULTY_ORDER[diff];
          const emojis = ['👶', '🧒', '🧑', '🎓', '📖', '👨‍🏫', '⛪'];
          const points = DIFFICULTY_POINTS[diff];

          return (
            <li key={diff}>
              <Link
                to={`/play/study/quiz/${theme.id}/${diff}`}
                className={`${styles.level} ${done ? styles.levelDone : ''}`}
              >
                <div className={styles.levelTop}>
                  <div className={styles.levelInfo}>
                    <span className={styles.levelEmoji}>{emojis[diffIndex]}</span>
                    <div>
                      <span className={styles.levelLabel}>{DIFFICULTY_LABELS[diff]}</span>
                      <span className={styles.levelMeta}>
                        📝 {availableQuestions} питань · 🪙 +{points}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`${styles.levelStatus} ${done ? styles.levelStatusDone : styles.levelStatusNew}`}
                  >
                    {done ? '✅' : 'Почати'}
                  </span>
                </div>

                {done && (
                  <div className={styles.progressArea}>
                    <div className={styles.progressRow}>
                      <span className={styles.progressLabel}>Результат</span>
                      <span className={styles.progressValue}>
                        {completedLevel?.score ?? 0}/{completedLevel?.maxScore ?? 0}
                      </span>
                    </div>
                    <div className={styles.progressBar} role="progressbar" aria-valuenow={completedLevel ? (completedLevel.score / completedLevel.maxScore) * 100 : 0}>
                      <span style={{ width: `${completedLevel ? (completedLevel.score / completedLevel.maxScore) * 100 : 0}%` }} />
                    </div>
                  </div>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
