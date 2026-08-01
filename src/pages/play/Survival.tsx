import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getMixedQuestionsByDifficulty } from '../../data/questions';
import { fetchQuestionsByIds } from '../../repos/questionsRepo';
import { usePlayer } from '../../context/PlayerContext';
import { ExplanationModal } from '../../components/ExplanationModal';
import { ConfirmModal } from '../../components/ConfirmModal';
import { QuizPoolSkeleton } from '../../components/skeletons';
import { haptic } from '../../lib/telegram';
import { DIFFICULTY_LABELS } from '../../types';
import type { Difficulty, Question } from '../../types';
import { Icon } from '../../components/Icon';
import {
  AnswerOptionButton,
  type AnswerOptionVisualState,
  FullscreenMotion,
  MotionStagger,
  MotionStaggerItem,
} from '../../components/motion';
import { usePersistedRun } from '../../hooks/usePersistedRun';
import {
  buildSurvivalSessionKey,
  loadGameSession,
  type SurvivalRunSession,
} from '../../lib/gameSession';
import {
  answerFeedbackVariants,
  questionVariants,
  reducedTransition,
  transitionPage,
  transitionUi,
} from '../../lib/motion';
import styles from './Survival.module.css';

const STARTING_LIVES = 3;
const TIME_PER_QUESTION = 20;
const SURVIVAL_SESSION_KEY = buildSurvivalSessionKey();
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
  const reduced = useReducedMotion();
  const navigate = useNavigate();
  const { saveSurvivalRun, unlockAchievement, profile } = usePlayer();
  const [ready, setReady] = useState(false);
  const sessionRestoredRef = useRef(false);
  const [question, setQuestion] = useState<Question | null>(null);
  const [seenQuestionIds, setSeenQuestionIds] = useState<string[]>([]);
  const [lives, setLives] = useState(STARTING_LIVES);
  const [score, setScore] = useState(0);
  const [points, setPoints] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_QUESTION);
  const [selected, setSelected] = useState<number | null>(null);
  const [status, setStatus] = useState<'playing' | 'answered' | 'finished'>('playing');
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState<boolean | null>(null);
  const [explanationOpen, setExplanationOpen] = useState(false);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const saved = loadGameSession<SurvivalRunSession>(SURVIVAL_SESSION_KEY);
      if (saved?.currentQuestionId) {
        const [current] = await fetchQuestionsByIds([saved.currentQuestionId]);
        if (!cancelled && current) {
          sessionRestoredRef.current = true;
          setQuestion(current);
          setSeenQuestionIds(saved.seenQuestionIds);
          setLives(saved.lives);
          setScore(saved.score);
          setPoints(saved.points);
          setTimeLeft(saved.timeLeft);
          setSelected(saved.selected);
          setStatus(saved.status);
          setLastAnswerCorrect(saved.lastAnswerCorrect);
          setReady(true);
          return;
        }
      }
      if (cancelled) return;
      const first = pickSurvivalQuestion(0, []);
      setQuestion(first);
      setSeenQuestionIds(first ? [first.id] : []);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const snapshot = useMemo(
    (): SurvivalRunSession => ({
      seenQuestionIds,
      currentQuestionId: question?.id ?? '',
      lives,
      score,
      points,
      timeLeft,
      selected,
      status,
      lastAnswerCorrect,
    }),
    [seenQuestionIds, question, lives, score, points, timeLeft, selected, status, lastAnswerCorrect],
  );

  const { clear: clearSession } = usePersistedRun({
    sessionKey: SURVIVAL_SESSION_KEY,
    snapshot,
    enabled: ready && !!question,
  });

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
    if (lives <= 0) return;
    const nextLives = lives - 1;
    setLives(nextLives);
    if (nextLives <= 0) {
      finishRun(score, points);
      return;
    }
    haptic.notification('warning');
    setStatus('answered');
    setLastAnswerCorrect(false);
  }, [finishRun, lives, points, score]);

  useEffect(() => {
    if (status !== 'playing' || exitConfirmOpen || !ready) return;

    const timerId = window.setInterval(() => {
      setTimeLeft((value) => {
        if (value <= 1) {
          window.clearInterval(timerId);
          queueMicrotask(() => loseLife());
          return 0;
        }
        return value - 1;
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [loseLife, status, exitConfirmOpen, ready, question?.id]);

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
    clearSession();
    sessionRestoredRef.current = false;
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

  const exitGame = () => {
    clearSession();
    navigate('/play');
  };

  if (!ready) {
    return (
      <section className={styles.page}>
        <QuizPoolSkeleton />
      </section>
    );
  }

  if (!question) {
    return (
      <section className={styles.page}>
        <article className={styles.resultCard}>
          <h1>Поки недостатньо питань</h1>
          <p>Для режиму «Виживання» потрібен доступний пул питань.</p>
          <Link to="/play" className={styles.secondaryAction} onClick={clearSession}>
            Назад до режимів
          </Link>
        </article>
      </section>
    );
  }

  if (status === 'finished') {
    const isNewRecord = score > 0 && score >= profile.survivalHighScore;
    return (
      <FullscreenMotion motionKey="survival-finished" enter={!sessionRestoredRef.current}>
        <section className={styles.page}>
          <div className={styles.resultWrap}>
            <span className={styles.resultIcon}>💔</span>
            <h1 className={styles.resultTitle}>Серця закінчилися!</h1>
            <p className={styles.resultSubtitle}>
              {score > 0
                ? `Ти дав ${score} правильних відповідей і заробив ${points} монет.`
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
                  <span className={styles.statBlockLabel}>🪙 Монети</span>
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
            <Link to="/play" className={styles.secondaryAction} onClick={clearSession}>
              В головне меню
            </Link>
          </div>
        </section>
      </FullscreenMotion>
    );
  }

  return (
    <FullscreenMotion motionKey="survival-playing" enter={!sessionRestoredRef.current}>
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
              <span className={styles.statLabel}>Монети</span>
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
            <div
              className={`${styles.timer} ${isLowTime ? styles.timerLow : ''}`}
              role="progressbar"
              aria-valuenow={timerProgress}
            >
              <span style={{ width: `${timerProgress}%` }} />
              <span className={`${styles.timerCenter} ${isLowTime ? styles.timerCenterLow : ''}`}>
                {timeLeft}
              </span>
            </div>
          </div>
        </header>

        <div className={styles.spacer} aria-hidden />

        <footer className={styles.bottomPanel}>
          <AnimatePresence mode="wait">
            <motion.div
              key={question.id}
              initial="initial"
              animate="animate"
              exit="exit"
              variants={questionVariants}
              transition={reducedTransition(transitionPage, !!reduced)}
            >
              <div className={styles.questionCard}>
                <p className={styles.questionText}>{question.text}</p>
              </div>

              <MotionStagger as="ul" className={styles.options}>
                {question.options.map((option, optionIndex) => {
                  const isCorrect = optionIndex === question.correctIndex;
                  const isSelected = optionIndex === selected;
                  let stateClass = '';
                  let visual: AnswerOptionVisualState = 'idle';
                  if (status === 'answered') {
                    if (isCorrect) {
                      stateClass = styles.correct;
                      visual = 'correct';
                    } else if (isSelected) {
                      stateClass = styles.wrong;
                      visual = 'wrong';
                    }
                  } else if (isSelected) {
                    stateClass = styles.selected;
                    visual = 'selected';
                  }

                  return (
                    <MotionStaggerItem as="li" key={option}>
                      <AnswerOptionButton
                        className={`${styles.option} ${stateClass}`}
                        visualState={visual}
                        onClick={() => handleAnswer(optionIndex)}
                        disabled={status !== 'playing'}
                      >
                        {option}
                      </AnswerOptionButton>
                    </MotionStaggerItem>
                  );
                })}
              </MotionStagger>

              <AnimatePresence mode="wait" initial={false}>
                {status === 'answered' ? (
                  <motion.div
                    key={`survival-feedback-${question.id}`}
                    className={styles.feedback}
                    variants={answerFeedbackVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={reducedTransition(transitionUi, !!reduced)}
                  >
                    <span
                      className={`${styles.feedbackBadge} ${lastAnswerCorrect ? styles.feedbackCorrect : styles.feedbackWrong}`}
                    >
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
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.div>
          </AnimatePresence>
        </footer>

        <ExplanationModal
          question={question}
          open={explanationOpen}
          onClose={() => setExplanationOpen(false)}
          showReaderLink={false}
        />

        <ConfirmModal
          open={exitConfirmOpen}
          title="Вийти з гри?"
          message="Ви дійсно бажаєте вийти? Поточний забіг завершиться без збереження поточного раунду."
          confirmText="Вийти"
          cancelText="Залишитися"
          onConfirm={() => {
            setExitConfirmOpen(false);
            exitGame();
          }}
          onCancel={() => setExitConfirmOpen(false)}
        />
      </section>
    </FullscreenMotion>
  );
}
