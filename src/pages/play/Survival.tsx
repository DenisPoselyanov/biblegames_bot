import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMixedQuestionsByDifficulty } from '../../data/questions';
import { usePlayer } from '../../context/PlayerContext';
import { ExplanationModal } from '../../components/ExplanationModal';
import { ConfirmModal } from '../../components/ConfirmModal';
import { haptic } from '../../lib/telegram';
import type { Difficulty, Question } from '../../types';
import styles from './Survival.module.css';

const STARTING_LIVES = 3;
const TIME_PER_QUESTION = 20;
const POINTS_BY_DIFFICULTY: Record<Difficulty, number> = {
  baby: 5,
  child: 10,
  youth: 15,
  student: 20,
  preacher: 25,
  teacher: 30,
  theologian: 40,
};

function getDifficultyForScore(score: number): Difficulty {
  if (score <= 5) return 'baby';
  if (score <= 15) return 'child';
  if (score <= 30) return 'youth';
  if (score <= 50) return 'student';
  if (score <= 75) return 'preacher';
  if (score <= 100) return 'teacher';
  return 'theologian';
}

function pickSurvivalQuestion(score: number, excludeIds: string[]): Question | null {
  const [question] = getMixedQuestionsByDifficulty(
    getDifficultyForScore(score),
    1,
    excludeIds,
  );
  return question ?? null;
}

export function Survival() {
  const { saveSurvivalRun, unlockAchievement } = usePlayer();
  const [question, setQuestion] = useState<Question | null>(() =>
    pickSurvivalQuestion(0, []),
  );
  const [seenQuestionIds, setSeenQuestionIds] = useState<string[]>(() =>
    question ? [question.id] : [],
  );
  const [lives, setLives] = useState(STARTING_LIVES);
  const [score, setScore] = useState(0);
  const [points, setPoints] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_QUESTION);
  const [selected, setSelected] = useState<number | null>(null);
  const [status, setStatus] = useState<'playing' | 'answered' | 'finished'>('playing');
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState<boolean | null>(null);
  const [explanationOpen, setExplanationOpen] = useState(false);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);

  const difficulty = getDifficultyForScore(score);
  const timerProgress = Math.max(0, (timeLeft / TIME_PER_QUESTION) * 100);

  const livesView = useMemo(
    () => Array.from({ length: STARTING_LIVES }, (_, index) => index < lives),
    [lives],
  );

  const finishRun = useCallback(
    (finalScore: number, finalPoints: number) => {
      saveSurvivalRun(finalScore, finalPoints);
      if (finalScore >= 30) {
        unlockAchievement('iron-shield');
        haptic.notification('success');
      } else {
        haptic.notification('error');
      }
      setStatus('finished');
    },
    [saveSurvivalRun, unlockAchievement],
  );

  const moveToNextQuestion = useCallback(
    (nextScore: number) => {
      haptic.impact('light');
      const nextQuestion = pickSurvivalQuestion(nextScore, seenQuestionIds);

      if (!nextQuestion) {
        finishRun(nextScore, points);
        return;
      }

      setQuestion(nextQuestion);
      setSeenQuestionIds((ids) => [...ids, nextQuestion.id]);
      setSelected(null);
      setLastAnswerCorrect(null);
      setExplanationOpen(false);
      setTimeLeft(TIME_PER_QUESTION);
      setStatus('playing');
    },
    [finishRun, points, seenQuestionIds],
  );

  const loseLife = useCallback(() => {
    setLives((currentLives) => {
      const nextLives = currentLives - 1;
      if (nextLives <= 0) {
        finishRun(score, points);
      } else {
        haptic.notification('warning');
        setStatus('answered');
        setLastAnswerCorrect(false);
      }
      return Math.max(0, nextLives);
    });
  }, [finishRun, points, score]);

  useEffect(() => {
    if (status !== 'playing' || exitConfirmOpen) return;

    const timerId = window.setInterval(() => {
      setTimeLeft((value) => {
        if (value <= 1) {
          window.clearInterval(timerId);
          loseLife();
          return 0;
        }

        return value - 1;
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [loseLife, status, exitConfirmOpen]);

  const handleAnswer = (optionIndex: number) => {
    if (!question || status !== 'playing') return;

    setSelected(optionIndex);

    if (optionIndex === question.correctIndex) {
      haptic.notification('success');
      const earned = POINTS_BY_DIFFICULTY[question.difficulty];
      const nextScore = score + 1;
      setScore(nextScore);
      setPoints((value) => value + earned);
      setLastAnswerCorrect(true);
      setStatus('answered');
      return;
    }

    loseLife();
  };

  const handleNext = () => {
    moveToNextQuestion(score);
  };

  const restart = () => {
    haptic.impact('light');
    const firstQuestion = pickSurvivalQuestion(0, []);
    setQuestion(firstQuestion);
    setSeenQuestionIds(firstQuestion ? [firstQuestion.id] : []);
    setLives(STARTING_LIVES);
    setScore(0);
    setPoints(0);
    setTimeLeft(TIME_PER_QUESTION);
    setSelected(null);
    setLastAnswerCorrect(null);
    setExplanationOpen(false);
    setStatus('playing');
  };

  if (!question) {
    return (
      <section className={styles.page}>
        <article className={styles.resultCard}>
          <h1>Поки недостатньо питань</h1>
          <p>Для режиму «Виживання» потрібен доступний пул питань.</p>
          <Link to="/play" className={styles.secondaryAction}>
            Назад до режимів
          </Link>
        </article>
      </section>
    );
  }

  if (status === 'finished') {
    return (
      <section className={styles.page}>
        <article className={styles.resultCard}>
          <span className={styles.kicker}>Виживання</span>
          <h1>Забіг завершено</h1>
          <p className={styles.resultScore}>{score} правильних відповідей</p>
          <p>Зароблено {points} очок.</p>
          <button type="button" className={styles.primaryAction} onClick={restart}>
            Спробувати ще раз
          </button>
          <Link to="/play" className={styles.secondaryAction}>
            Назад до режимів
          </Link>
        </article>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <header className={styles.top}>
        <div className={styles.topRow}>
          <span className={styles.topTitle}>Виживання</span>
          <div className={styles.lives} aria-label={`Життів: ${lives}`}>
            {livesView.map((isActive, index) => (
              <span
                key={index}
                className={isActive ? styles.lifeActive : styles.lifeLost}
              >
                ♥
              </span>
            ))}
          </div>
        </div>

        <div className={styles.headerMeta}>
          <div className={styles.metaBadge}>
            <span className={styles.badgeLabel}>Раунд:</span>
            <span className={styles.badgeValue}>{score}</span>
          </div>
          <div className={styles.metaBadge}>
            <span className={styles.badgeValue}>{points}</span>
            <span className={styles.badgeLabel}>очок</span>
          </div>
          <div className={styles.metaBadge}>
            <span className={styles.badgeLabel}>Складність:</span>
            <span className={`${styles.badgeValue} ${styles.difficultyBadge}`}>
              {difficulty}
            </span>
          </div>
        </div>

        <div className={styles.timerWrapper}>
          <div className={styles.timerMeta}>
            <span>Час лишився</span>
            <span className={styles.timeVal}>{timeLeft} с</span>
          </div>
          <div className={styles.timer} role="progressbar" aria-valuenow={timerProgress}>
            <span style={{ width: `${timerProgress}%` }} />
          </div>
        </div>
      </header>

      <div className={styles.spacer} aria-hidden />

      <footer className={styles.bottomPanel}>
        <p className={styles.questionText}>{question.text}</p>

        <ul className={styles.options}>
          {question.options.map((option, optionIndex) => {
            const isCorrect = optionIndex === question.correctIndex;
            const isSelected = optionIndex === selected;
            let stateClass = '';
            if (status === 'answered') {
              if (isCorrect) stateClass = styles.correct;
              else if (isSelected) stateClass = styles.wrong;
            } else if (isSelected) {
              stateClass = styles.selected;
            }

            return (
              <li key={option}>
                <button
                  type="button"
                  className={`${styles.option} ${stateClass}`}
                  onClick={() => handleAnswer(optionIndex)}
                  disabled={status !== 'playing'}
                >
                  {option}
                </button>
              </li>
            );
          })}
        </ul>

        {status === 'answered' ? (
          <div className={styles.feedback}>
            <p className={styles.feedbackNotice}>
              {lastAnswerCorrect ? '🎉 Правильно!' : '💔 Життя втрачено.'}
            </p>
            <button
              type="button"
              className={styles.explanationButton}
              onClick={() => setExplanationOpen(true)}
            >
              Пояснення {question.reference ? `· ${question.reference}` : ''}
            </button>
            <div className={styles.actionRow}>
              <button
                type="button"
                className={styles.btnExit}
                onClick={() => {
                  haptic.impact('light');
                  setExitConfirmOpen(true);
                }}
              >
                Вийти
              </button>
              <button type="button" className={styles.btnPrimary} onClick={handleNext}>
                Далі →
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.actionRowPlaying}>
            <button
              type="button"
              className={styles.btnExit}
              onClick={() => {
                haptic.impact('light');
                setExitConfirmOpen(true);
              }}
            >
              Вийти з гри
            </button>
          </div>
        )}
      </footer>

      <ExplanationModal
        question={question}
        open={explanationOpen}
        onClose={() => setExplanationOpen(false)}
      />

      <ConfirmModal
        open={exitConfirmOpen}
        title="Вийти з гри?"
        message="Ви дійсно бажаєте вийти? Поточний забіг завершиться без збереження поточного раунду."
        confirmText="Вийти"
        cancelText="Залишитися"
        onConfirm={() => {
          setExitConfirmOpen(false);
          window.location.href = '/play';
        }}
        onCancel={() => setExitConfirmOpen(false)}
      />
    </section>
  );
}

