import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getThemeById } from '../data/themes';
import { getQuestionsForLevelAsync } from '../data/questions';
import { preloadThemeQuestions } from '../data/questionDbLoader';
import { usePlayer } from '../context/PlayerContext';
import type { Question } from '../types';
import {
  DIFFICULTY_LABELS,
  DIFFICULTY_POINTS,
  QUESTIONS_PER_LEVEL,
  isValidDifficulty,
} from '../types';
import styles from './Quiz.module.css';

export function Quiz() {
  const { themeId, difficulty } = useParams<{
    themeId: string;
    difficulty: string;
  }>();
  const navigate = useNavigate();
  const { completeLevel } = usePlayer();

  const theme = getThemeById(themeId ?? '');
  const validDiff = difficulty && isValidDifficulty(difficulty) ? difficulty : null;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!themeId || !validDiff) {
      setQuestions([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    preloadThemeQuestions(themeId);

    getQuestionsForLevelAsync(themeId, validDiff, QUESTIONS_PER_LEVEL).then((qs) => {
      if (!cancelled) {
        setQuestions(qs);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [themeId, validDiff]);

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [finished, setFinished] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState(0);

  const current = questions[index];
  const progress = questions.length
    ? ((index + (showResult ? 1 : 0)) / questions.length) * 100
    : 0;

  const handleSelect = useCallback(
    (optionIndex: number) => {
      if (showResult || !current) return;
      setSelected(optionIndex);
      setShowResult(true);
      if (optionIndex === current.correctIndex) {
        setCorrectCount((c) => c + 1);
      }
    },
    [showResult, current],
  );

  const handleNext = useCallback(() => {
    if (!current || !validDiff || !themeId) return;

    if (index < questions.length - 1) {
      setIndex((i) => i + 1);
      setSelected(null);
      setShowResult(false);
      return;
    }

    const result = completeLevel(themeId, validDiff, correctCount, questions.length);
    setEarnedPoints(result.points);
    setFinished(true);
  }, [
    index,
    questions.length,
    current,
    correctCount,
    completeLevel,
    themeId,
    validDiff,
  ]);

  if (loading) {
    return (
      <section className={styles.page}>
        <p className={styles.errorMsg}>Завантаження питань…</p>
      </section>
    );
  }

  if (!theme || !validDiff || questions.length < QUESTIONS_PER_LEVEL) {
    return (
      <section className={styles.page}>
        <p className={styles.errorMsg}>Недостатньо запитань для цього рівня.</p>
        <Link to={`/play/solo/themes/${themeId}`} className={styles.backLink}>
          ← Назад
        </Link>
      </section>
    );
  }

  if (finished) {
    const pct = Math.round((correctCount / questions.length) * 100);
    return (
      <section className={styles.page}>
        <article className={styles.resultCard}>
          <span className={styles.resultIcon}>🎉</span>
          <h1>Рівень завершено!</h1>
          <p className={styles.resultTheme}>
            {theme.icon} {theme.title} · {DIFFICULTY_LABELS[validDiff]}
          </p>
          <p className={styles.resultScore}>
            {correctCount} / {questions.length} правильних ({pct}%)
          </p>
          <p className={styles.resultPoints}>+{earnedPoints} очок</p>
          <p className={styles.resultHint}>
            Максимум за рівень: {DIFFICULTY_POINTS[validDiff]} очок при 100% відповідей
          </p>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => navigate(`/play/solo/themes/${themeId}`)}
          >
            До теми
          </button>
          <Link to="/play/solo" className={styles.btnSecondary}>
            Всі теми
          </Link>
        </article>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <header className={styles.top}>
        <Link to={`/play/solo/themes/${themeId}`} className={styles.close} aria-label="Закрити">
          ✕
        </Link>
        <div className={styles.topMeta}>
          <span className={styles.themeBadge}>
            {theme.icon} {theme.title}
          </span>
          <span className={styles.diffBadge}>{DIFFICULTY_LABELS[validDiff]}</span>
        </div>
        <span className={styles.counter}>
          {index + 1} / {questions.length}
        </span>
        <div className={styles.progressBar} role="progressbar" aria-valuenow={progress}>
          <span style={{ width: `${progress}%` }} />
        </div>
      </header>

      <div className={styles.spacer} aria-hidden />

      <footer className={styles.bottomPanel}>
        <p className={styles.questionText}>{current.text}</p>

        <ul className={styles.options}>
          {current.options.map((opt, i) => {
            let state = '';
            if (showResult) {
              if (i === current.correctIndex) state = styles.correct;
              else if (i === selected) state = styles.wrong;
            } else if (i === selected) {
              state = styles.selected;
            }
            return (
              <li key={i}>
                <button
                  type="button"
                  className={`${styles.option} ${state}`}
                  onClick={() => handleSelect(i)}
                  disabled={showResult}
                >
                  {opt}
                </button>
              </li>
            );
          })}
        </ul>

        {showResult && current.reference && (
          <p className={styles.reference}>📖 {current.reference}</p>
        )}

        {showResult && (
          <button type="button" className={styles.btnPrimary} onClick={handleNext}>
            {index < questions.length - 1 ? 'Далі →' : 'Завершити рівень'}
          </button>
        )}
      </footer>
    </section>
  );
}
