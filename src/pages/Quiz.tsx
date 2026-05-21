import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getThemeById } from '../data/themes';
import { getQuestionsForLevelAsync } from '../data/questions';
import { usePlayer } from '../context/PlayerContext';
import { ExplanationModal } from '../components/ExplanationModal';
import { haptic } from '../lib/telegram';
import type { Question } from '../types';
import {
  DIFFICULTY_LABELS,
  DIFFICULTY_POINTS,
  QUESTIONS_PER_LEVEL,
  isValidDifficulty,
  type StudyMode,
} from '../types';
import { studyRepo } from '../repos/studyRepo';
import styles from './Quiz.module.css';

export function Quiz({ mode = 'practice' }: { mode?: StudyMode }) {
  const { themeId, difficulty } = useParams<{
    themeId: string;
    difficulty: string;
  }>();
  const navigate = useNavigate();
  const { completeLevel, recordAnswerEvent } = usePlayer();

  const theme = getThemeById(themeId ?? '');
  const validDiff = difficulty && isValidDifficulty(difficulty) ? difficulty : null;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(mode === 'sprint' ? 300 : 0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const loadQuestions = async () => {
      if (mode === 'review') {
        const history = studyRepo.getAnswerHistory();
        const wrongQuestionIds = new Set(history.filter((a) => !a.isCorrect).map((a) => a.questionId));
        const { ALL_QUESTIONS } = await import('../data/questions');
        // Get all questions that the user got wrong at least once
        const wrongQuestions = ALL_QUESTIONS.filter((q) => wrongQuestionIds.has(q.id));
        // Shuffle them
        wrongQuestions.sort(() => Math.random() - 0.5);
        if (!cancelled) {
          setQuestions(wrongQuestions);
          setLoading(false);
        }
        return;
      }

      if (!themeId || !validDiff) {
        if (mode === 'sprint') {
          const { ALL_QUESTIONS } = await import('../data/questions');
          const mixed = [...ALL_QUESTIONS].sort(() => Math.random() - 0.5).slice(0, 200);
          if (!cancelled) {
            setQuestions(mixed);
            setLoading(false);
          }
          return;
        }

        if (!cancelled) {
          setQuestions([]);
          setLoading(false);
        }
        return;
      }

      const qs = await getQuestionsForLevelAsync(
        themeId, 
        validDiff, 
        mode === 'sprint' ? 100 : QUESTIONS_PER_LEVEL
      );
      if (!cancelled) {
        setQuestions(qs);
        setLoading(false);
      }
    };

    loadQuestions();

    return () => {
      cancelled = true;
    };
  }, [themeId, validDiff, mode]);

  useEffect(() => {
    if (mode !== 'sprint' || finished || loading) return;
    if (timeLeft <= 0) {
      setFinished(true);
      return;
    }
    const timerId = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timerId);
  }, [mode, timeLeft, finished, loading]);

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [explanationOpen, setExplanationOpen] = useState(false);

  const current = questions[index];
  const progress = questions.length
    ? ((index + (showResult ? 1 : 0)) / questions.length) * 100
    : 0;

  const handleSelect = useCallback(
    (optionIndex: number) => {
      if (showResult || !current) return;
      setSelected(optionIndex);
      setShowResult(true);
      recordAnswerEvent({
        themeId: themeId ?? '',
        questionId: current.id,
        isCorrect: optionIndex === current.correctIndex,
      });
      if (optionIndex === current.correctIndex) {
        setCorrectCount((c) => c + 1);
        haptic.notification('success');
      } else {
        haptic.notification('error');
      }
    },
    [showResult, current],
  );

  const handleNext = useCallback(() => {
    if (!current || !validDiff || !themeId) return;

    haptic.impact('light');

    if (index < questions.length - 1) {
      setIndex((i) => i + 1);
      setSelected(null);
      setShowResult(false);
      setExplanationOpen(false);
      return;
    }

    if (mode === 'practice' && themeId && validDiff) {
      const result = completeLevel(themeId, validDiff, correctCount, questions.length);
      setEarnedPoints(result.points);
    }
    setFinished(true);
    haptic.notification('success');
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

  if (mode === 'practice' && (!theme || !validDiff || questions.length === 0)) {
    return (
      <section className={styles.page}>
        <p className={styles.errorMsg}>Недостатньо запитань для цього рівня.</p>
        <Link to={`/play/study/themes/${themeId}`} className={styles.backLink}>
          ← Назад
        </Link>
      </section>
    );
  }

  if (mode === 'review' && questions.length === 0) {
    return (
      <section className={styles.page}>
        <p className={styles.errorMsg}>У тебе поки немає помилок для повторення. Молодець!</p>
        <Link to={`/play/study`} className={styles.backLink}>
          ← До меню
        </Link>
      </section>
    );
  }

  if (finished) {
    const pct = Math.round((correctCount / (index + 1)) * 100) || 0;
    return (
      <section className={styles.page}>
        <article className={styles.resultCard}>
          <span className={styles.resultIcon}>🎉</span>
          <h1>Рівень завершено!</h1>
          
          {mode === 'sprint' ? (
            <p className={styles.resultTheme}>Спринт · Час вичерпано</p>
          ) : mode === 'review' ? (
            <p className={styles.resultTheme}>Робота над помилками</p>
          ) : (
            <p className={styles.resultTheme}>
              {theme?.icon} {theme?.title} · {validDiff && DIFFICULTY_LABELS[validDiff]}
            </p>
          )}

          <p className={styles.resultScore}>
            {correctCount} / {mode === 'practice' ? questions.length : index + (showResult ? 1 : 0)} правильних ({pct}%)
          </p>
          
          {mode === 'practice' && (
            <>
              <p className={styles.resultPoints}>+{earnedPoints} очок</p>
              <p className={styles.resultHint}>
                Максимум за рівень: {validDiff ? DIFFICULTY_POINTS[validDiff] : 0} очок при 100% відповідей
              </p>
            </>
          )}

          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => navigate(mode === 'practice' ? `/play/study/themes/${themeId}` : '/play/study')}
          >
            {mode === 'practice' ? 'До теми' : 'В меню'}
          </button>
        </article>
      </section>
    );
  }

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <section className={styles.page}>
      {mode === 'sprint' && (
        <div className={styles.sprintTimer}>
          Залишилось: {formatTime(timeLeft)}
        </div>
      )}
      <header className={styles.top}>
        <Link to={mode === 'practice' ? `/play/study/themes/${themeId}` : '/play/study'} className={styles.close} aria-label="Закрити">
          ✕
        </Link>
        <div className={styles.topMeta}>
          <span className={styles.themeBadge}>
            {mode === 'review' ? '🧠 Робота над помилками' : mode === 'sprint' ? '⏱️ Спринт' : `${theme?.icon} ${theme?.title}`}
          </span>
          {mode === 'practice' && validDiff && <span className={styles.diffBadge}>{DIFFICULTY_LABELS[validDiff]}</span>}
        </div>
        <span className={styles.counter}>
          {index + 1} / {mode === 'sprint' ? '∞' : questions.length}
        </span>
        {mode !== 'sprint' && (
          <div className={styles.progressBar} role="progressbar" aria-valuenow={progress}>
            <span style={{ width: `${progress}%` }} />
          </div>
        )}
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

        {showResult && (
          <button
            type="button"
            className={styles.referenceButton}
            onClick={() => setExplanationOpen(true)}
          >
            Пояснення {current.reference ? `· ${current.reference}` : ''}
          </button>
        )}

        {showResult && (
          <button type="button" className={styles.btnPrimary} onClick={handleNext}>
            {index < questions.length - 1 ? 'Далі →' : 'Завершити рівень'}
          </button>
        )}
      </footer>

      <ExplanationModal
        question={current}
        open={explanationOpen}
        onClose={() => setExplanationOpen(false)}
      />
    </section>
  );
}
