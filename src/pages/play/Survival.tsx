import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMixedQuestionsByDifficulty } from '../../data/questions';
import { usePlayer } from '../../context/PlayerContext';
import { ExplanationModal } from '../../components/ExplanationModal';
import { ConfirmModal } from '../../components/ConfirmModal';
import { haptic } from '../../lib/telegram';
import { DIFFICULTY_LABELS } from '../../types';
import type { Difficulty, Question } from '../../types';
import { Icon } from '../../components/Icon';
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
  const { saveSurvivalRun, unlockAchievement, profile } = usePlayer();
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
  const isLowTime = timeLeft <= 5;

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
    (nextScore: number, pointsEarned: number) => {
      haptic.impact('light');
      const nextQuestion = pickSurvivalQuestion(nextScore, seenQuestionIds);

      if (!nextQuestion) {
        finishRun(nextScore, pointsEarned);
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
    [finishRun, seenQuestionIds],
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
    moveToNextQuestion(score, points);
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
    const isNewRecord = score > 0 && score >= profile.survivalHighScore;
    return (
      <section className={styles.page}>
        <div className={styles.resultWrap}>
          <span className={styles.resultIcon}>💔</span>
          <h1 className={styles.resultTitle}>Серця закінчилися!</h1>
          <p className={styles.resultSubtitle}>
            {score > 0
              ? `Ти дав ${score} правильних відповідей і заробив ${points} очок.`
              : 'Спробуй ще раз — наступний забіг буде кращим!'}
          </p>

          <div className={styles.statsCard}>
            <div className={styles.statsRow}>
              <div className={styles.statBlock}>
                <span className={styles.statBlockLabel}>Раунд</span>
                <span className={styles.statBlockValue}>{score}</span>
              </div>
              <div className={styles.statDividerV} />
              <div className={styles.statBlock}>
                <span className={styles.statBlockLabel}>🪙 Очки</span>
                <span className={styles.statBlockValue}>{points}</span>
              </div>
              <div className={styles.statDividerV} />
              <div className={styles.statBlock}>
                <span className={styles.statBlockLabel}>🏆 Рекорд</span>
                <span className={styles.statBlockValue}>{profile.survivalHighScore}</span>
              </div>
            </div>
          </div>

          {isNewRecord && (
            <p className={styles.newRecordBadge}>🏆 Новий рекорд!</p>
          )}

          <button type="button" className={styles.primaryAction} onClick={restart}>
            Грати знову
          </button>
          <Link to="/play" className={styles.secondaryAction}>
            В головне меню
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <header className={styles.top}>
        <div className={styles.topRow}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => setExitConfirmOpen(true)}
            aria-label="Вийти"
          >
            <Icon name="close" size={18} />
          </button>
          <div className={styles.lives} aria-label={`Життів: ${lives}`}>
            {livesView.map((isActive, index) => (
              <span
                key={index}
                className={`${styles.heart} ${isActive ? styles.heartActive : styles.heartLost}`}
              >
                {isActive ? '❤️' : '🖤'}
              </span>
            ))}
          </div>
        </div>

        <div className={styles.statsWidget}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Раунд</span>
            <span className={styles.statValue}>{score}</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Очки</span>
            <span className={styles.statValue}>{points}</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Рівень</span>
            <span className={`${styles.statValue} ${styles.statDifficulty}`}>
              {DIFFICULTY_LABELS[difficulty]}
            </span>
          </div>
        </div>

        <div className={styles.timerWrapper}>
          <div className={`${styles.timer} ${isLowTime ? styles.timerLow : ''}`} role="progressbar" aria-valuenow={timerProgress}>
            <span style={{ width: `${timerProgress}%` }} />
            <span className={`${styles.timerCenter} ${isLowTime ? styles.timerCenterLow : ''}`}>
              {timeLeft}
            </span>
          </div>
        </div>
      </header>

      <div className={styles.spacer} aria-hidden />

      <footer className={styles.bottomPanel}>
        <div className={styles.questionCard}>
          <p className={styles.questionText}>{question.text}</p>
        </div>

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
            <span className={`${styles.feedbackBadge} ${lastAnswerCorrect ? styles.feedbackCorrect : styles.feedbackWrong}`}>
              {lastAnswerCorrect ? '🎉 Правильно!' : '💔 Життя втрачено.'}
            </span>
            <button
              type="button"
              className={styles.explanationButton}
              onClick={() => setExplanationOpen(true)}
            >
              Пояснення {question.reference ? `· ${question.reference}` : ''}
            </button>
            <div className={styles.actionRow}>
              <button type="button" className={styles.btnPrimary} onClick={handleNext}>
                Далі →
              </button>
            </div>
          </div>
        ) : null}
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
