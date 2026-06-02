import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getMixedQuestionsByDifficulty } from '../../data/questions';
import { usePlayer } from '../../context/PlayerContext';
import { ExplanationModal } from '../../components/ExplanationModal';
import { ConfirmModal } from '../../components/ConfirmModal';
import { Icon } from '../../components/Icon';
import { haptic } from '../../lib/telegram';
import type { Question } from '../../types';
import {
  AnswerOptionButton,
  type AnswerOptionVisualState,
  FullscreenMotion,
  MotionStagger,
  MotionStaggerItem,
} from '../../components/motion';
import { usePersistedRun } from '../../hooks/usePersistedRun';
import type { MillionaireRunSession } from '../../lib/gameSession';
import {
  answerFeedbackVariants,
  questionVariants,
  reducedTransition,
  transitionPage,
  transitionUi,
} from '../../lib/motion';
import {
  buildMillionaireQuestions,
  formatMillionaireCoins,
  LEVEL_POINTS,
  loadMillionaireRun,
  MILLIONAIRE_PROGRESS_SEGMENTS,
  MILLIONAIRE_SESSION_KEY,
} from './millionaireSession';
import styles from './Millionaire.module.css';

const SAFE_LEVELS = new Set([5, 10]);

function segmentHasSafeLevel(segmentIndex: number, totalLevels: number): boolean {
  const levelsPerSegment = Math.ceil(totalLevels / MILLIONAIRE_PROGRESS_SEGMENTS);
  const startLevel = segmentIndex * levelsPerSegment + 1;
  const endLevel = Math.min(totalLevels, (segmentIndex + 1) * levelsPerSegment);
  for (const safeLevel of SAFE_LEVELS) {
    if (safeLevel >= startLevel && safeLevel <= endLevel) return true;
  }
  return false;
}

function getSafePoints(reachedLevel: number): number {
  if (reachedLevel >= 10) return LEVEL_POINTS[9];
  if (reachedLevel >= 5) return LEVEL_POINTS[4];
  return 0;
}

function emptyMillionaireState() {
  return {
    index: 0,
    selected: null as number | null,
    hiddenOptions: [] as number[],
    usedFiftyFifty: false,
    usedSwap: false,
    usedSecondChance: false,
    secondChanceActive: false,
    blockedWrongOptions: [] as number[],
    status: 'playing' as const,
    notice: null as string | null,
    result: null as MillionaireRunSession['result'],
  };
}

export function Millionaire() {
  const reduced = useReducedMotion();
  const navigate = useNavigate();
  const { saveMillionaireRun, unlockAchievement } = usePlayer();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [ready, setReady] = useState(false);
  const sessionRestoredRef = useRef(false);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [hiddenOptions, setHiddenOptions] = useState<number[]>([]);
  const [usedFiftyFifty, setUsedFiftyFifty] = useState(false);
  const [usedSwap, setUsedSwap] = useState(false);
  const [usedSecondChance, setUsedSecondChance] = useState(false);
  const [secondChanceActive, setSecondChanceActive] = useState(false);
  const [blockedWrongOptions, setBlockedWrongOptions] = useState<number[]>([]);
  const [status, setStatus] = useState<'playing' | 'answered' | 'finished'>('playing');
  const [notice, setNotice] = useState<string | null>(null);
  const [explanationOpen, setExplanationOpen] = useState(false);
  const [result, setResult] = useState<MillionaireRunSession['result']>(null);

  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [takeConfirmOpen, setTakeConfirmOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const restored = await loadMillionaireRun();
      if (cancelled) return;
      if (restored) {
        sessionRestoredRef.current = true;
        const { questions: qs, session } = restored;
        setQuestions(qs);
        setIndex(session.index);
        setSelected(session.selected);
        setHiddenOptions(session.hiddenOptions);
        setUsedFiftyFifty(session.usedFiftyFifty);
        setUsedSwap(session.usedSwap);
        setUsedSecondChance(session.usedSecondChance);
        setSecondChanceActive(session.secondChanceActive);
        setBlockedWrongOptions(session.blockedWrongOptions);
        setStatus(session.status);
        setNotice(session.notice);
        setResult(session.result);
      } else {
        setQuestions(buildMillionaireQuestions());
        const empty = emptyMillionaireState();
        setIndex(empty.index);
        setSelected(empty.selected);
        setHiddenOptions(empty.hiddenOptions);
        setUsedFiftyFifty(empty.usedFiftyFifty);
        setUsedSwap(empty.usedSwap);
        setUsedSecondChance(empty.usedSecondChance);
        setSecondChanceActive(empty.secondChanceActive);
        setBlockedWrongOptions(empty.blockedWrongOptions);
        setStatus(empty.status);
        setNotice(empty.notice);
        setResult(empty.result);
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const snapshot = useMemo(
    (): MillionaireRunSession => ({
      questionIds: questions.map((q) => q.id),
      index,
      selected,
      hiddenOptions,
      usedFiftyFifty,
      usedSwap,
      usedSecondChance,
      secondChanceActive,
      blockedWrongOptions,
      status,
      notice,
      result,
    }),
    [
      questions,
      index,
      selected,
      hiddenOptions,
      usedFiftyFifty,
      usedSwap,
      usedSecondChance,
      secondChanceActive,
      blockedWrongOptions,
      status,
      notice,
      result,
    ],
  );

  const totalLevels = questions.length;

  const { clear: clearSession } = usePersistedRun({
    sessionKey: MILLIONAIRE_SESSION_KEY,
    snapshot,
    enabled: ready && totalLevels > 0,
  });

  const current = questions[index];
  const currentLevel = index + 1;
  const currentPrize = LEVEL_POINTS[index] ?? 0;
  const earnedBeforeCurrent = index > 0 ? LEVEL_POINTS[index - 1] : 0;

  const progressSegments = useMemo(() => {
    if (totalLevels < 1) return [];
    const levelsPerSegment = Math.ceil(totalLevels / MILLIONAIRE_PROGRESS_SEGMENTS);
    const activeSegment = Math.min(
      MILLIONAIRE_PROGRESS_SEGMENTS - 1,
      Math.floor((currentLevel - 1) / levelsPerSegment),
    );
    return Array.from({ length: MILLIONAIRE_PROGRESS_SEGMENTS }, (_, segmentIndex) => ({
      segmentIndex,
      completed: segmentIndex < activeSegment,
      active: segmentIndex === activeSegment,
      safe: segmentHasSafeLevel(segmentIndex, totalLevels),
    }));
  }, [currentLevel, totalLevels]);

  const finishGame = useCallback(
    (title: string, points: number, reachedLevel: number) => {
      saveMillionaireRun(reachedLevel, points, totalLevels);
      if (totalLevels > 0 && reachedLevel >= totalLevels) {
        unlockAchievement('biblical-millionaire');
        haptic.notification('success');
      } else {
        haptic.notification('warning');
      }
      setResult({ title, points, reachedLevel });
      setStatus('finished');
    },
    [saveMillionaireRun, unlockAchievement, totalLevels],
  );

  const restart = useCallback(() => {
    clearSession();
    sessionRestoredRef.current = false;
    setQuestions(buildMillionaireQuestions());
    haptic.impact('light');
    const empty = emptyMillionaireState();
    setIndex(empty.index);
    setSelected(empty.selected);
    setHiddenOptions(empty.hiddenOptions);
    setUsedFiftyFifty(empty.usedFiftyFifty);
    setUsedSwap(empty.usedSwap);
    setUsedSecondChance(empty.usedSecondChance);
    setSecondChanceActive(empty.secondChanceActive);
    setBlockedWrongOptions(empty.blockedWrongOptions);
    setNotice(empty.notice);
    setExplanationOpen(false);
    setStatus(empty.status);
    setResult(empty.result);
  }, [clearSession]);

  const useFiftyFifty = () => {
    if (!current || usedFiftyFifty || status !== 'playing') return;

    haptic.impact('medium');
    const wrongOptions = current.options
      .map((_, optionIndex) => optionIndex)
      .filter((optionIndex) => optionIndex !== current.correctIndex);

    setHiddenOptions(wrongOptions.sort(() => Math.random() - 0.5).slice(0, 2));
    setUsedFiftyFifty(true);
  };

  const swapQuestion = () => {
    if (!current || usedSwap || status !== 'playing') return;

    haptic.impact('medium');
    const [replacement] = getMixedQuestionsByDifficulty(
      current.difficulty,
      1,
      questions.map((question) => question.id),
    );

    if (!replacement) return;

    setQuestions((currentQuestions) =>
      currentQuestions.map((question, questionIndex) =>
        questionIndex === index ? replacement : question,
      ),
    );
    setHiddenOptions([]);
    setSelected(null);
    setUsedSwap(true);
    setNotice(null);
  };

  const useSecondChance = () => {
    if (usedSecondChance || status !== 'playing') return;

    haptic.impact('medium');
    setUsedSecondChance(true);
    setSecondChanceActive(true);
    setNotice('Право на помилку активне для цього питання.');
  };

  const handleAnswer = (optionIndex: number) => {
    if (!current || status !== 'playing') return;

    setSelected(optionIndex);

    if (optionIndex !== current.correctIndex) {
      if (secondChanceActive) {
        haptic.notification('warning');
        setBlockedWrongOptions((items) => [...items, optionIndex]);
        setSecondChanceActive(false);
        setSelected(null);
        setNotice('Цю помилку пробачено. Обери інший варіант.');
        return;
      }

      haptic.notification('error');
      setStatus('answered');
      const reachedLevel = Math.max(0, index);
      finishGame('Гру завершено', getSafePoints(reachedLevel), reachedLevel);
      return;
    }

    haptic.notification('success');
    setStatus('answered');
    setNotice(null);
  };

  const handleNext = () => {
    if (!current) return;

    haptic.impact('light');

    if (index >= questions.length - 1) {
      finishGame('Перемога у Мільйонері!', currentPrize, totalLevels);
      return;
    }

    setIndex((value) => value + 1);
    setSelected(null);
    setHiddenOptions([]);
    setBlockedWrongOptions([]);
    setSecondChanceActive(false);
    setNotice(null);
    setExplanationOpen(false);
    setStatus('playing');
  };

  const takePoints = () => {
    haptic.notification('success');
    finishGame('Бали збережено', earnedBeforeCurrent, index);
  };

  const exitGame = () => {
    clearSession();
    navigate('/play');
  };

  if (!ready) {
    return (
      <section className={styles.page}>
        <p className={styles.notice}>Завантаження…</p>
      </section>
    );
  }

  if (totalLevels === 0) {
    return (
      <section className={styles.page}>
        <article className={styles.resultCard}>
          <h1>Поки недостатньо питань</h1>
          <p>У базі ще немає питань для цього режиму. Спробуй пізніше або повернись до інших режимів.</p>
          <Link to="/play" className={styles.secondaryAction} onClick={clearSession}>
            Назад до режимів
          </Link>
        </article>
      </section>
    );
  }

  if (result) {
    return (
      <FullscreenMotion motionKey="millionaire-result" enter={!sessionRestoredRef.current}>
        <section className={styles.page}>
          <article className={styles.resultCard}>
            <span className={styles.kicker}>Мільйонер</span>
            <h1>{result.title}</h1>
            <p className={styles.resultScore}>
              +{formatMillionaireCoins(result.points)} монет
            </p>
            <p>Досягнуто рівень {result.reachedLevel} з {totalLevels}.</p>
            <button type="button" className={styles.primaryAction} onClick={restart}>
              Спробувати ще раз
            </button>
            <Link to="/play" className={styles.secondaryAction} onClick={clearSession}>
              Назад до режимів
            </Link>
          </article>
        </section>
      </FullscreenMotion>
    );
  }

  return (
    <FullscreenMotion motionKey={`millionaire-${currentLevel}`} enter={!sessionRestoredRef.current}>
      <section className={styles.page}>
        <header className={styles.top}>
          <div className={styles.topInner}>
            <div className={styles.topRow}>
              <button
                type="button"
                className={styles.backBtn}
                onClick={() => {
                  haptic.impact('light');
                  setExitConfirmOpen(true);
                }}
                aria-label="Вийти з гри"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <article
              className={styles.statusCard}
              aria-label="Прогрес Мільйонера"
            >
            <div
              className={styles.progressTrack}
              role="progressbar"
              aria-valuenow={currentLevel}
              aria-valuemin={1}
              aria-valuemax={totalLevels}
              aria-label={`Рівень ${currentLevel} з ${totalLevels}`}
            >
              {progressSegments.map((segment) => (
                <span
                  key={segment.segmentIndex}
                  className={[
                    styles.progressSegment,
                    segment.completed ? styles.progressSegmentDone : '',
                    segment.active ? styles.progressSegmentActive : '',
                    segment.safe ? styles.progressSegmentSafe : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                />
              ))}
            </div>
            <div className={styles.statusRow}>
              <div className={styles.statusBlock}>
                <span className={styles.statusLabel}>Рівень</span>
                <span className={styles.statusValue}>
                  {currentLevel} / {totalLevels}
                </span>
              </div>
              <div className={`${styles.statusBlock} ${styles.statusBlockEnd}`}>
                <span className={styles.statusLabel}>Приз</span>
                <span className={styles.statusValue}>
                  {formatMillionaireCoins(currentPrize)} монет
                </span>
              </div>
            </div>
            </article>
          </div>
        </header>

        <div className={styles.spacer} aria-hidden />

        <footer className={styles.bottomPanel}>
          <div className={styles.panelHeader}>
            <span className={styles.kicker}>Питання {currentLevel} з {totalLevels}</span>
          </div>

          <div className={styles.lifelines} aria-label="Підказки">
            <button
              type="button"
              onClick={useFiftyFifty}
              disabled={usedFiftyFifty || status !== 'playing'}
            >
              50:50
            </button>
            <button
              type="button"
              onClick={swapQuestion}
              disabled={usedSwap || status !== 'playing'}
            >
              Заміна
            </button>
            <button
              type="button"
              onClick={useSecondChance}
              disabled={usedSecondChance || status !== 'playing'}
            >
              Помилка
            </button>
          </div>

          {notice && <p className={styles.notice}>{notice}</p>}

          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial="initial"
              animate="animate"
              exit="exit"
              variants={questionVariants}
              transition={reducedTransition(transitionPage, !!reduced)}
            >
              <p className={styles.questionText}>{current.text}</p>

              <MotionStagger as="ul" className={styles.options}>
                {current.options.map((option, optionIndex) => {
                  const isHidden =
                    hiddenOptions.includes(optionIndex) ||
                    blockedWrongOptions.includes(optionIndex);
                  const isCorrect = optionIndex === current.correctIndex;
                  const isSelected = optionIndex === selected;
                  let stateClass = '';
                  let visual: AnswerOptionVisualState = 'idle';
                  if (isHidden) {
                    visual = 'hidden';
                  } else if (status === 'answered') {
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
                        disabled={status !== 'playing' || isHidden}
                      >
                        {isHidden ? '—' : option}
                      </AnswerOptionButton>
                    </MotionStaggerItem>
                  );
                })}
              </MotionStagger>
            </motion.div>
          </AnimatePresence>

          <AnimatePresence mode="wait" initial={false}>
            {status === 'answered' && (
              <motion.div
                key={`millionaire-feedback-${current.id}`}
                className={styles.feedback}
                variants={answerFeedbackVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={reducedTransition(transitionUi, !!reduced)}
              >
                <span className={`${styles.feedbackBadge} ${styles.feedbackCorrect}`}>
                  ✅ Правильна відповідь.
                </span>
                <button
                  type="button"
                  className={styles.explanationButton}
                  onClick={() => setExplanationOpen(true)}
                >
                  Пояснення {current.reference ? `· ${current.reference}` : ''}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className={styles.actionRow}>
            {status === 'playing' && (
              <button
                type="button"
                className={styles.btnTake}
                onClick={() => {
                  haptic.impact('light');
                  setTakeConfirmOpen(true);
                }}
                disabled={index === 0}
              >
                Забрати {formatMillionaireCoins(earnedBeforeCurrent)}
              </button>
            )}

            {status === 'answered' && (
              <button type="button" className={styles.btnPrimary} onClick={handleNext}>
                {index === questions.length - 1 ? 'Завершити' : 'Далі →'}
              </button>
            )}
          </div>
        </footer>

        <ExplanationModal
          question={current}
          open={explanationOpen}
          onClose={() => setExplanationOpen(false)}
          showReaderLink={false}
        />

        <ConfirmModal
          open={exitConfirmOpen}
          title="Вийти з гри?"
          message="Ви дійсно бажаєте вийти? Ваш поточний прогрес у цьому забігу буде втрачено."
          confirmText="Вийти"
          cancelText="Залишитися"
          onConfirm={() => {
            setExitConfirmOpen(false);
            exitGame();
          }}
          onCancel={() => setExitConfirmOpen(false)}
        />

        <ConfirmModal
          open={takeConfirmOpen}
          title="Забрати монети?"
          message={`Ви дійсно хочете забрати ${formatMillionaireCoins(earnedBeforeCurrent)} монет та безпечно завершити гру?`}
          confirmText="Забрати"
          cancelText="Продовжити гру"
          onConfirm={() => {
            setTakeConfirmOpen(false);
            takePoints();
          }}
          onCancel={() => setTakeConfirmOpen(false)}
        />
      </section>
    </FullscreenMotion>
  );
}
