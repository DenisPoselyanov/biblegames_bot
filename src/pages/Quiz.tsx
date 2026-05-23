import { useCallback, useEffect, useRef, useState } from 'react';
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

const QUESTION_TIME = 15;

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
  const [sprintTimeLeft, setSprintTimeLeft] = useState<number>(mode === 'sprint' ? 300 : 0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const loadQuestions = async () => {
      if (mode === 'review') {
        const history = studyRepo.getAnswerHistory();
        const wrongQuestionIds = new Set(history.filter((a) => !a.isCorrect).map((a) => a.questionId));
        const { ALL_QUESTIONS } = await import('../data/questions');
        const wrongQuestions = ALL_QUESTIONS.filter((q) => wrongQuestionIds.has(q.id));
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
        mode === 'sprint' ? 100 : QUESTIONS_PER_LEVEL,
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
    if (sprintTimeLeft <= 0) {
      setFinished(true);
      return;
    }
    const timerId = setInterval(() => {
      setSprintTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timerId);
  }, [mode, sprintTimeLeft, finished, loading]);

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [explanationOpen, setExplanationOpen] = useState(false);

  const [questionTimeLeft, setQuestionTimeLeft] = useState(QUESTION_TIME);
  const questionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearQuestionTimer = useCallback(() => {
    if (questionTimerRef.current) {
      clearInterval(questionTimerRef.current);
      questionTimerRef.current = null;
    }
  }, []);

  const startQuestionTimer = useCallback(() => {
    clearQuestionTimer();
    setQuestionTimeLeft(QUESTION_TIME);
    questionTimerRef.current = setInterval(() => {
      setQuestionTimeLeft((prev) => {
        if (prev <= 1) {
          clearQuestionTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearQuestionTimer]);

  useEffect(() => {
    if (!current || showResult || loading || finished) return;
    startQuestionTimer();
    return clearQuestionTimer;
  }, [index, showResult, loading, finished]);

  useEffect(() => {
    if (questionTimeLeft > 0 || showResult || !current) return;
    setSelected(-1);
    setShowResult(true);
    recordAnswerEvent({
      themeId: themeId ?? '',
      questionId: current.id,
      isCorrect: false,
    });
    haptic.notification('error');
  }, [questionTimeLeft]);

  const current = questions[index];
  const progress = questions.length
    ? ((index + (showResult ? 1 : 0)) / questions.length) * 100
    : 0;

  const handleSelect = useCallback(
    (optionIndex: number) => {
      if (showResult || !current) return;
      clearQuestionTimer();
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
    [showResult, current, clearQuestionTimer],
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

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const timerProgress = questionTimeLeft / QUESTION_TIME;
  const timerColor =
    timerProgress > 0.5
      ? '#4a9c5d'
      : timerProgress > 0.25
        ? '#c9a227'
        : '#e05050';

  const timerRadius = 60;
  const timerCircumference = 2 * Math.PI * timerRadius;
  const timerOffset = timerCircumference * (1 - timerProgress);

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
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>📜</span>
          <h2 className={styles.emptyTitle}>Ой, тут ще пусто!</h2>
          <p className={styles.emptyDesc}>
            Ми активно працюємо над тим, щоб додати сюди нові цікаві запитання.
            Спробуй обрати іншу складність або тему!
          </p>
          <Link to={`/play/study/themes/${themeId}`} className={styles.emptyBtn}>
            Повернутися до вибору
          </Link>
        </div>
      </section>
    );
  }

  if (mode === 'review' && questions.length === 0) {
    return (
      <section className={styles.page}>
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>🎉</span>
          <h2 className={styles.emptyTitle}>Чудова робота!</h2>
          <p className={styles.emptyDesc}>
            У тебе поки немає помилок для повторення. Ти справжній знавець!
          </p>
          <Link to="/play/study" className={styles.emptyBtn}>
            До меню
          </Link>
        </div>
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

  return (
    <section className={styles.page}>
      <header className={styles.top}>
        <div className={styles.topRow}>
          <Link
            to={mode === 'practice' ? `/play/study/themes/${themeId}` : '/play/study'}
            className={styles.close}
            aria-label="Закрити"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </Link>

          <div className={styles.topBadges}>
            {mode === 'practice' && validDiff && (
              <span className={styles.diffBadge}>{DIFFICULTY_LABELS[validDiff]}</span>
            )}
            <span className={styles.themeBadge}>
              {mode === 'review'
                ? '🧠 Робота над помилками'
                : mode === 'sprint'
                  ? '⏱️ Спринт'
                  : `${theme?.icon} ${theme?.title}`}
            </span>
          </div>
        </div>

        <div className={styles.progressArea}>
          <span className={styles.counter}>
            {index + 1} / {mode === 'sprint' ? '∞' : questions.length}
          </span>
          {mode !== 'sprint' && (
            <div className={styles.progressBar} role="progressbar" aria-valuenow={progress}>
              <span style={{ width: `${progress}%` }} />
            </div>
          )}
          {mode === 'sprint' && (
            <div className={styles.sprintTimer}>
              ⏱ {formatTime(sprintTimeLeft)}
            </div>
          )}
        </div>
      </header>

      <div className={styles.timerSection}>
        <div className={styles.timerCircle}>
          <svg width="140" height="140" viewBox="0 0 140 140">
            <circle
              cx="70" cy="70" r={timerRadius}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="6"
            />
            <circle
              cx="70" cy="70" r={timerRadius}
              fill="none"
              stroke={timerColor}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={timerCircumference}
              strokeDashoffset={timerOffset}
              transform="rotate(-90 70 70)"
              style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease' }}
            />
          </svg>
          <span className={styles.timerText}>{questionTimeLeft}</span>
        </div>
      </div>

      <footer className={styles.bottomPanel}>
        <div className={styles.questionCard}>
          <p className={styles.questionText}>{current.text}</p>
        </div>

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
