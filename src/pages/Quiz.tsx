import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getThemeById } from '../data/themes';
import {
  getAllQuestionsAsync,
  getQuestionsByIdsOrdered,
  getQuestionsForLevelAsync,
  getQuestionsForNodeAsync,
  getQuestionsForCategoryAsync,
  getQuestionsForStageAsync,
  getQuestionsForNodeStageAsync,
  getQuestionsForCategoryStageAsync,
  invalidateAllQuestionsCache,
} from '../data/questions';
import { usePlayer } from '../context/PlayerContext';
import { useToast } from '../components/Toast';
import { ExplanationModal } from '../components/ExplanationModal';
import { QuestionEditModal } from '../components/QuestionEditModal';
import { clearQuestionDbCache } from '../data/questionDbLoader';
import {
  deleteQuestionOnServer,
  updateQuestionOnServer,
} from '../repos/questionAdminRepo';
import { haptic } from '../lib/telegram';
import type { Question } from '../types';
import {
  DIFFICULTY_LABELS,
  QUESTIONS_PER_LEVEL,
  isValidDifficulty,
  type StudyMode,
} from '../types';
import {
  getStageQuizPath,
  isStageUnlocked,
  PASS_MIN_CORRECT,
  PRACTICE_QUESTIONS_PER_STAGE,
  findPracticeTrack,
  getOrCreatePracticeTrack,
  canPlayDifficulty,
} from '../lib/practiceProgression';
import { studyRepo } from '../repos/studyRepo';
import { loadAllTopicHierarchies, findRootByThemeId } from '../data/topicDbLoader';
import { InfoTooltip } from '../components/InfoTooltip';
import { STAGE_POINTS_TOOLTIP } from '../lib/practiceScoringHelp';
import {
  AnswerOptionButton,
  type AnswerOptionVisualState,
  MotionStagger,
  MotionStaggerItem,
} from '../components/motion';
import { usePersistedRun } from '../hooks/usePersistedRun';
import {
  buildQuizSessionKey,
  loadGameSession,
  type QuizRunSession,
} from '../lib/gameSession';
import {
  answerFeedbackVariants,
  answerRevealFlashVariants,
  questionVariants,
  reducedTransition,
  transitionPage,
  transitionUi,
} from '../lib/motion';
import styles from './Quiz.module.css';

const QUESTION_TIME = 15;

export function Quiz({ mode = 'practice' }: { mode?: StudyMode }) {
  const { themeId, difficulty, stageIndex: stageIndexParam, nodeId } = useParams<{
    themeId: string;
    difficulty: string;
    stageIndex?: string;
    nodeId?: string;
  }>();
  const navigate = useNavigate();
  const { completePracticeStage, recordAnswerEvent, profile } = usePlayer();
  const { showToast } = useToast();

  const theme = getThemeById(themeId ?? '');
  const validDiff = difficulty && isValidDifficulty(difficulty) ? difficulty : null;
  const stageIndex = stageIndexParam != null ? Number(stageIndexParam) : 0;
  const effectiveNodeId = nodeId ?? null;
  const isStageRoute = stageIndexParam != null;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [earnedWisdom, setEarnedWisdom] = useState(0);
  const [stagePassed, setStagePassed] = useState(false);
  const [stagePerfect, setStagePerfect] = useState(false);
  const [nextStageUnlocked, setNextStageUnlocked] = useState(false);
  const [rankPromoted, setRankPromoted] = useState(false);
  const [newRankLabel, setNewRankLabel] = useState('');
  const [explanationOpen, setExplanationOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [questionTimeLeft, setQuestionTimeLeft] = useState(QUESTION_TIME);
  const questionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionRestoredRef = useRef(false);

  const sessionKey = useMemo(
    () =>
      buildQuizSessionKey(
        mode,
        themeId,
        validDiff ?? undefined,
        effectiveNodeId,
        isStageRoute ? stageIndex : undefined,
      ),
    [mode, themeId, validDiff, effectiveNodeId, isStageRoute, stageIndex],
  );

  const applyQuizSession = useCallback((saved: QuizRunSession, restoredQuestions: Question[]) => {
    sessionRestoredRef.current = true;
    setQuestions(restoredQuestions);
    setIndex(saved.index);
    setCorrectCount(saved.correctCount);
    setFinished(saved.finished);
    setShowResult(saved.showResult);
    setSelected(saved.selected);
    setQuestionTimeLeft(saved.questionTimeLeft);
    if (saved.earnedPoints != null) setEarnedPoints(saved.earnedPoints);
    if (saved.earnedWisdom != null) setEarnedWisdom(saved.earnedWisdom);
    if (saved.stagePassed != null) setStagePassed(saved.stagePassed);
    if (saved.stagePerfect != null) setStagePerfect(saved.stagePerfect);
    if (saved.nextStageUnlocked != null) setNextStageUnlocked(saved.nextStageUnlocked);
    if (saved.rankPromoted != null) setRankPromoted(saved.rankPromoted);
    if (saved.newRankLabel != null) setNewRankLabel(saved.newRankLabel);
    setLoading(false);
  }, []);

  const quizSnapshot = useMemo(
    (): QuizRunSession => ({
      questionIds: questions.map((q) => q.id),
      index,
      correctCount,
      finished,
      showResult,
      selected,
      questionTimeLeft,
      earnedPoints,
      earnedWisdom,
      stagePassed,
      stagePerfect,
      nextStageUnlocked,
      rankPromoted,
      newRankLabel,
    }),
    [
      questions,
      index,
      correctCount,
      finished,
      showResult,
      selected,
      questionTimeLeft,
      earnedPoints,
      earnedWisdom,
      stagePassed,
      stagePerfect,
      nextStageUnlocked,
      rankPromoted,
      newRankLabel,
    ],
  );

  const { clear: clearQuizSession } = usePersistedRun({
    sessionKey,
    snapshot: quizSnapshot,
    enabled: questions.length > 0 && !loading,
  });

  const exitQuiz = useCallback(() => {
    clearQuizSession();
  }, [clearQuizSession]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    sessionRestoredRef.current = false;

    const tryRestore = async (): Promise<boolean> => {
      const saved = loadGameSession<QuizRunSession>(sessionKey);
      if (!saved?.questionIds.length) return false;
      const restored = await getQuestionsByIdsOrdered(saved.questionIds);
      if (restored.length !== saved.questionIds.length) return false;
      if (!cancelled) applyQuizSession(saved, restored);
      return true;
    };

    const loadQuestions = async () => {
      if (await tryRestore()) return;

      if (mode === 'review') {
        const history = studyRepo.getAnswerHistory();
        const wrongQuestionIds = new Set(history.filter((a) => !a.isCorrect).map((a) => a.questionId));
        const allQuestions = await getAllQuestionsAsync();
        const wrongQuestions = allQuestions.filter((q) => wrongQuestionIds.has(q.id));
        wrongQuestions.sort(() => Math.random() - 0.5);
        if (!cancelled) {
          setQuestions(wrongQuestions);
          setLoading(false);
        }
        return;
      }

      if (!themeId || !validDiff) {
        if (!cancelled) {
          setQuestions([]);
          setLoading(false);
        }
        return;
      }

      const practiceStageIndex = Number.isFinite(stageIndex) && stageIndex >= 0 ? stageIndex : 0;
      const questionCount = isStageRoute ? PRACTICE_QUESTIONS_PER_STAGE : QUESTIONS_PER_LEVEL;

      if (effectiveNodeId) {
        try {
          const topicHierarchy = await loadAllTopicHierarchies();

          let targetNode: import('../types').TopicNode | null = null;
          for (const h of Object.values(topicHierarchy)) {
            const findNode = (node: import('../types').TopicNode, targetId: string): import('../types').TopicNode | null => {
              if (node.id === targetId) return node;
              if (node.children) {
                for (const child of node.children) {
                  const found = findNode(child, targetId);
                  if (found) return found;
                }
              }
              return null;
            };
            targetNode = findNode(h, effectiveNodeId);
            if (targetNode) break;
          }

          if (targetNode?.aggregateThemeIds && validDiff) {
            const aggQuestions = isStageRoute
              ? await getQuestionsForCategoryStageAsync(
                  targetNode.aggregateThemeIds,
                  validDiff,
                  practiceStageIndex,
                  questionCount,
                )
              : await getQuestionsForCategoryAsync(
                  themeId ?? targetNode.aggregateThemeIds[0],
                  targetNode.aggregateThemeIds,
                  validDiff,
                  questionCount,
                );
            if (!cancelled) {
              setQuestions(aggQuestions);
              setLoading(false);
            }
            return;
          }

          const rootNode = findRootByThemeId(topicHierarchy, themeId ?? '');
          if (rootNode) {
            const nodeQuestions = isStageRoute
              ? await getQuestionsForNodeStageAsync(
                  effectiveNodeId,
                  rootNode,
                  validDiff,
                  practiceStageIndex,
                  questionCount,
                  false,
                  false,
                )
              : await getQuestionsForNodeAsync(
                  effectiveNodeId,
                  rootNode,
                  validDiff ?? undefined,
                  questionCount,
                  false,
                  false,
                );
            if (!cancelled) {
              setQuestions(nodeQuestions);
              setLoading(false);
            }
            return;
          }
        } catch (error) {
          console.error('Failed to load questions for node:', error);
        }
      }

      const qs = isStageRoute
        ? await getQuestionsForStageAsync(themeId, validDiff, practiceStageIndex, questionCount)
        : await getQuestionsForLevelAsync(themeId, validDiff, questionCount);
      if (!cancelled) {
        setQuestions(qs);
        setLoading(false);
      }
    };

    loadQuestions();

    return () => {
      cancelled = true;
    };
  }, [themeId, validDiff, mode, effectiveNodeId, stageIndex, isStageRoute, sessionKey, applyQuizSession]);

  const backToThemeUrl = `/play/study/themes/${themeId}${effectiveNodeId ? `/${effectiveNodeId}` : ''}`;

  const stageAccessBlocked = useMemo(() => {
    if (mode !== 'practice' || !isStageRoute || !validDiff || !themeId) return false;
    if (!canPlayDifficulty(profile.playerRank, validDiff)) return true;
    const track = findPracticeTrack(profile.practiceTracks ?? [], themeId, effectiveNodeId, validDiff)
      ?? getOrCreatePracticeTrack([], themeId, effectiveNodeId, validDiff);
    return !isStageUnlocked(track, stageIndex);
  }, [mode, isStageRoute, validDiff, themeId, profile, effectiveNodeId, stageIndex]);

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

  const current = questions[index];
  const reduced = useReducedMotion();
  const progress = questions.length
    ? ((index + (showResult ? 1 : 0)) / questions.length) * 100
    : 0;

  useEffect(() => {
    if (!current || showResult || loading || finished) return;
    startQuestionTimer();
    return clearQuestionTimer;
  }, [index, showResult, loading, finished, current, startQuestionTimer, clearQuestionTimer]);

  useEffect(() => {
    if (questionTimeLeft > 0 || showResult || !current || loading || finished) return;
    clearQuestionTimer();
    setSelected(-1);
    setShowResult(true);
    recordAnswerEvent({
      themeId: themeId ?? '',
      questionId: current.id,
      isCorrect: false,
      nodeId: effectiveNodeId ?? undefined,
    });
    haptic.notification('error');
  }, [
    questionTimeLeft,
    showResult,
    current,
    loading,
    finished,
    effectiveNodeId,
    themeId,
    clearQuestionTimer,
    recordAnswerEvent,
  ]);

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
        nodeId: effectiveNodeId ?? undefined,
      });
      if (optionIndex === current.correctIndex) {
        setCorrectCount((c) => c + 1);
        haptic.notification('success');
      } else {
        haptic.notification('error');
      }
    },
    [showResult, current, clearQuestionTimer, themeId, effectiveNodeId, recordAnswerEvent],
  );

  const handleNext = useCallback(() => {
    if (!current) return;
    if (mode === 'practice' && (!validDiff || !themeId)) return;

    haptic.impact('light');

    if (index < questions.length - 1) {
      clearQuestionTimer();
      setQuestionTimeLeft(QUESTION_TIME);
      setIndex((i) => i + 1);
      setSelected(null);
      setShowResult(false);
      setExplanationOpen(false);
      return;
    }

    if (mode === 'practice' && themeId && validDiff) {
      const practiceStageIndex = isStageRoute ? stageIndex : 0;
      const result = completePracticeStage(
        themeId,
        validDiff,
        practiceStageIndex,
        correctCount,
        questions.length,
        effectiveNodeId,
      );
      setEarnedPoints(result.points);
      setEarnedWisdom(result.wisdomEarned);
      setStagePassed(result.passed);
      setStagePerfect(result.stagePerfect);
      setNextStageUnlocked(result.nextStageUnlocked);
      setRankPromoted(result.rankPromoted);
      setNewRankLabel(result.newRankLabel);
      if (result.points > 0) {
        showToast(`+${result.points} монет`, 'success');
      }
      if (result.wisdomEarned > 0) {
        showToast(`+${result.wisdomEarned} мудрості`, 'success');
      }
      if (result.rankPromoted) {
        showToast(`Новий ранг: ${result.newRankLabel}`, 'success');
      }
      if (result.streakDays > 1 && result.passed) {
        showToast(`Серія ${result.streakDays} дн.!`, 'info');
      }
      haptic.notification(result.passed ? 'success' : 'error');
    } else {
      haptic.notification('success');
    }
    setFinished(true);
  }, [
    index,
    questions.length,
    current,
    correctCount,
    completePracticeStage,
    themeId,
    validDiff,
    mode,
    clearQuestionTimer,
    isStageRoute,
    stageIndex,
    effectiveNodeId,
    showToast,
  ]);

  const handleSaveQuestion = useCallback(async (updated: Question) => {
    setEditSaving(true);
    setEditError(null);
    try {
      const saved = await updateQuestionOnServer(updated);
      invalidateAllQuestionsCache();
      clearQuestionDbCache();
      setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...saved } : q)));
      setEditOpen(false);
      setShowResult(false);
      setSelected(null);
      setExplanationOpen(false);
      clearQuestionTimer();
      setQuestionTimeLeft(QUESTION_TIME);
    } catch (error) {
      setEditError(
        error instanceof Error
          ? `${error.message}. Запусти сервер: npm run server:dev`
          : 'Не вдалось зберегти',
      );
    } finally {
      setEditSaving(false);
    }
  }, [index, clearQuestionTimer]);

  const handleDeleteQuestion = useCallback(async (questionId: string) => {
    setEditSaving(true);
    setEditError(null);
    try {
      await deleteQuestionOnServer(questionId);
      invalidateAllQuestionsCache();
      clearQuestionDbCache();
      setQuestions((prev) => {
        const next = prev.filter((q) => q.id !== questionId);
        if (next.length === 0) {
          setFinished(true);
        } else if (index >= next.length) {
          setIndex(next.length - 1);
        }
        return next;
      });
      setEditOpen(false);
      setShowResult(false);
      setSelected(null);
      setExplanationOpen(false);
      clearQuestionTimer();
      setQuestionTimeLeft(QUESTION_TIME);
    } catch (error) {
      setEditError(
        error instanceof Error
          ? `${error.message}. Запусти сервер: npm run server:dev`
          : 'Не вдалось видалити',
      );
    } finally {
      setEditSaving(false);
    }
  }, [index, clearQuestionTimer]);

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

  if (stageAccessBlocked) {
    return (
      <section className={styles.page}>
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>🔒</span>
          <h2 className={styles.emptyTitle}>Етап ще недоступний</h2>
          <p className={styles.emptyDesc}>
            Спочатку пройди попередні етапи або підвищ свій ранг у практиці.
          </p>
          <Link to={backToThemeUrl} className={styles.emptyBtn}>
            Повернутися до вибору
          </Link>
        </div>
      </section>
    );
  }

  if (mode === 'practice' && (!theme && !effectiveNodeId || !validDiff || questions.length === 0)) {
    return (
      <section className={styles.page}>
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>📜</span>
          <h2 className={styles.emptyTitle}>Ой, тут ще пусто!</h2>
          <p className={styles.emptyDesc}>
            Ми активно працюємо над тим, щоб додати сюди нові цікаві запитання.
            Спробуй обрати іншу складність або тему!
          </p>
          <Link to={backToThemeUrl} className={styles.emptyBtn}>
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
    const totalAnswered = questions.length;
    const pct = Math.round((correctCount / totalAnswered) * 100) || 0;
    const nextStagePath =
      mode === 'practice' && themeId && validDiff && nextStageUnlocked
        ? getStageQuizPath(themeId, validDiff, stageIndex + 1, effectiveNodeId)
        : null;

    return (
      <section className={styles.page}>
        <article className={`${styles.resultCard} ${stagePassed ? styles.resultCardSuccess : styles.resultCardFail}`}>
          <span className={styles.resultIcon}>{stagePassed ? '🎉' : '📖'}</span>
          <h1>{stagePassed ? (correctCount === totalAnswered ? 'Етап пройдено без помилок!' : 'Етап пройдено!') : 'Спробуй ще раз'}</h1>

          {mode === 'review' ? (
            <p className={styles.resultTheme}>Робота над помилками</p>
          ) : effectiveNodeId && (effectiveNodeId === 'ot-all' || effectiveNodeId === 'nt-all') ? (
            <p className={styles.resultTheme}>
              📚 Усі питання · {validDiff && DIFFICULTY_LABELS[validDiff]}
              {isStageRoute ? ` · Етап ${stageIndex + 1}` : ''}
            </p>
          ) : (
            <p className={styles.resultTheme}>
              {theme?.icon} {theme?.title} · {validDiff && DIFFICULTY_LABELS[validDiff]}
              {isStageRoute ? ` · Етап ${stageIndex + 1}` : ''}
            </p>
          )}

          <p className={styles.resultScore}>
            {correctCount} / {totalAnswered} правильних ({pct}%)
          </p>

          {mode === 'practice' && (
            <>
              {!stagePassed && (
                <p className={styles.resultHint}>
                  Для проходження потрібно щонайменше {PASS_MIN_CORRECT} з {PRACTICE_QUESTIONS_PER_STAGE} правильних відповідей.
                </p>
              )}
              {stagePassed && earnedWisdom > 0 && (
                <p className={styles.resultWisdom}>+{earnedWisdom} очок мудрості</p>
              )}
              {stagePassed && (
                <p className={styles.resultPointsRow}>
                  <span className={styles.resultPoints}>
                    {earnedPoints > 0
                      ? `+${earnedPoints} донараховано монет за етап`
                      : 'Максимум монет за цей етап вже отримано'}
                  </span>
                  <InfoTooltip label="Як рахуються монети за етап" text={STAGE_POINTS_TOOLTIP} />
                </p>
              )}
              {rankPromoted && (
                <p className={styles.resultRank}>Новий ранг: {newRankLabel}</p>
              )}
              {nextStageUnlocked && (
                <p className={styles.resultHint}>Наступний етап розблоковано!</p>
              )}
            </>
          )}

          <div className={styles.resultActions}>
            {nextStagePath && (
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => {
                  clearQuizSession();
                  navigate(nextStagePath);
                }}
              >
                Етап {stageIndex + 2} →
              </button>
            )}
            <button
              type="button"
              className={nextStagePath ? styles.btnSecondary : styles.btnPrimary}
              onClick={() => {
                clearQuizSession();
                if (mode === 'practice') {
                  navigate(backToThemeUrl);
                } else {
                  navigate('/play/study');
                }
              }}
            >
              {mode === 'practice' ? 'До теми' : 'В меню'}
            </button>
            {mode === 'practice' && !stagePassed && themeId && validDiff && (
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => {
                  clearQuizSession();
                  navigate(getStageQuizPath(themeId, validDiff, stageIndex, effectiveNodeId));
                }}
              >
                Повторити етап
              </button>
            )}
          </div>
        </article>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <header className={styles.top}>
        <div className={styles.topRow}>
          <Link
            to={mode === 'practice' ? backToThemeUrl : '/play/study'}
            className={styles.close}
            aria-label="Закрити"
            onClick={exitQuiz}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </Link>

          <div className={styles.topBadges}>
            {mode === 'practice' && validDiff && isStageRoute && (
              <span className={styles.diffBadge}>Етап {stageIndex + 1}</span>
            )}
            {mode === 'practice' && validDiff && (
              <span className={styles.diffBadge}>{DIFFICULTY_LABELS[validDiff]}</span>
            )}
            <span className={styles.themeBadge}>
              {mode === 'review'
                ? '🧠 Робота над помилками'
                : effectiveNodeId && (effectiveNodeId === 'ot-all' || effectiveNodeId === 'nt-all')
                  ? '📚 Усі питання'
                  : `${theme?.icon} ${theme?.title}`}
            </span>
          </div>
        </div>

        <div className={styles.progressArea}>
          <span className={styles.counter}>
            {index + 1} / {questions.length}
          </span>
          <div className={styles.progressBar} role="progressbar" aria-valuenow={progress}>
            <span style={{ width: `${progress}%` }} />
          </div>
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
              style={{ transition: 'stroke-dashoffset 1s linear, stroke var(--duration-normal) var(--ease-out)' }}
            />
          </svg>
          <span className={styles.timerText}>{questionTimeLeft}</span>
        </div>
      </div>

      <footer className={styles.bottomPanel}>
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial="initial"
            animate="animate"
            exit="exit"
            variants={questionVariants}
            transition={reducedTransition(transitionPage, !!reduced)}
          >
            <div className={styles.questionCard}>
              {showResult && (
                <motion.div
                  className={styles.answerFlash}
                  variants={answerRevealFlashVariants}
                  initial="idle"
                  animate="flash"
                  aria-hidden
                />
              )}
              {mode === 'practice' && (
                <button
                  type="button"
                  className={styles.editBtn}
                  onClick={() => setEditOpen(true)}
                  aria-label="Редагувати питання"
                >
                  ✏️
                </button>
              )}
              <p className={styles.questionText}>{current.text}</p>
            </div>

            <MotionStagger as="ul" className={styles.options}>
              {current.options.map((opt, i) => {
                let state = '';
                let visual: AnswerOptionVisualState = 'idle';
                if (showResult) {
                  if (i === current.correctIndex) {
                    state = styles.correct;
                    visual = 'correct';
                  } else if (i === selected) {
                    state = styles.wrong;
                    visual = 'wrong';
                  }
                } else if (i === selected) {
                  state = styles.selected;
                  visual = 'selected';
                }
                return (
                  <MotionStaggerItem as="li" key={i}>
                    <AnswerOptionButton
                      className={`${styles.option} ${state}`}
                      visualState={visual}
                      onClick={() => handleSelect(i)}
                      disabled={showResult}
                    >
                      {opt}
                    </AnswerOptionButton>
                  </MotionStaggerItem>
                );
              })}
            </MotionStagger>

            <AnimatePresence mode="wait" initial={false}>
              {showResult && (
                <motion.div
                  key={`quiz-feedback-${current.id}`}
                  variants={answerFeedbackVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={reducedTransition(transitionUi, !!reduced)}
                  style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}
                >
                  <motion.button
                    type="button"
                    className={styles.referenceButton}
                    onClick={() => setExplanationOpen(true)}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={reducedTransition(transitionUi, !!reduced)}
                  >
                    Пояснення {current.reference ? `· ${current.reference}` : ''}
                  </motion.button>

                  <motion.button
                    type="button"
                    className={styles.btnPrimary}
                    onClick={handleNext}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={reducedTransition(transitionUi, !!reduced)}
                  >
                    {index < questions.length - 1 ? 'Далі →' : 'Завершити етап'}
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </footer>

      <ExplanationModal
        question={current}
        open={explanationOpen}
        onClose={() => setExplanationOpen(false)}
      />

      {mode === 'practice' && (
        <QuestionEditModal
          question={current}
          open={editOpen}
          saving={editSaving}
          error={editError}
          onClose={() => {
            setEditOpen(false);
            setEditError(null);
          }}
          onSave={handleSaveQuestion}
          onDelete={handleDeleteQuestion}
        />
      )}
    </section>
  );
}
