/**
 * Practice/review session (Phase 3 WS7, spec §12.2-§12.4). One question at a
 * time; each answer calls `POST /practice-sessions/:id/answers` — the server
 * is authoritative for correctness, the next question and mastery/achievement
 * deltas (§12.2). Reward is always secondary to the explanation and there is
 * no routine fullscreen confetti (§12.3) — `CelebrationLayer` only fires when
 * the server actually granted an achievement.
 *
 * There is no `GET` for an existing session (WS2 exposes create/answer only),
 * so a session is seeded once from the React Query cache entry the launching
 * page (`PracticeIntent`/`ReviewHub`) writes before navigating here. A hard
 * reload loses that seed — a known, flagged gap, not a fabricated resume.
 *
 * Phase 3.5 §6 WS4 re-skin (behind `designSystemV2`): a segmented per-question
 * progress bar (same pattern `LessonSession` already uses for lesson blocks)
 * and a non-scrolling, viewport-sized result screen (§4 locked decision) that
 * shows the accuracy ring plus achievements actually granted this session —
 * `correctCount` is tallied client-side from the server's own per-answer
 * `isCorrect` verdicts, not invented; no XP/coin totals are shown because the
 * practice-session contract doesn't return any (not fabricated, same rule as
 * `PracticeIntent`/`ReviewHub`).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAnswerPracticeSession } from '../../queries/useLearning';
import { useEventOnce } from '../../hooks/useEventOnce';
import { trackEvent } from '../../lib/telemetry';
import { isFeatureEnabled } from '../../lib/flags';
import { buildOptionOrder, toCanonicalIndex, toDisplayIndex } from '../../lib/optionShuffle';
import { queryKeys } from '../../queries/keys';
import type {
  PracticeQuestionView,
  PracticeSessionAnswerResponse,
  PracticeSessionCreateResponse,
} from '../../../contracts/api/learning';
import {
  AnswerFeedback,
  AnswerOption,
  type AnswerOptionVisualState,
  AppPage,
  Button,
  CelebrationLayer,
  ContentCard,
  PageHeader,
  ProgressBar,
  ProgressRing,
} from '../../components/ui';
import { Icon } from '../../components/Icon';
import { ReportQuestion } from './ReportQuestion';
import styles from './PracticeSession.module.css';

/** Segmented per-question progress (Phase 3.5 §6 WS4) — mirrors `LessonSession`'s `SegmentedProgress`. */
function SegmentedProgress({ count, filled }: { count: number; filled: number }) {
  return (
    <div className={styles.segments} role="progressbar" aria-valuenow={filled} aria-valuemin={0} aria-valuemax={count}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={i < filled ? styles.segmentFilled : styles.segment} />
      ))}
    </div>
  );
}

export function PracticeSession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const designSystemV2 = isFeatureEnabled('designSystemV2');

  const [seed] = useState<PracticeSessionCreateResponse | undefined>(() =>
    sessionId
      ? queryClient.getQueryData<PracticeSessionCreateResponse>(queryKeys.practice.session(sessionId))
      : undefined,
  );

  const [question, setQuestion] = useState<PracticeQuestionView | undefined>(seed?.currentQuestion);
  const [index, setIndex] = useState(seed?.session.currentIndex ?? 0);
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<PracticeSessionAnswerResponse | null>(null);
  const [finished, setFinished] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [achievements, setAchievements] = useState<string[]>([]);

  const answer = useAnswerPracticeSession(sessionId ?? '');
  // Options shown shuffled (seeded by session, so stable within it). The server grades
  // canonical indexes: `selected` is a display index, mapped on the way in and out.
  const optionOrder = useMemo(
    () => (question ? buildOptionOrder(question.options, `${sessionId}:${question.questionId}`) : []),
    [question, sessionId],
  );
  const celebrate = useEventOnce(
    result && result.achievementsGranted.length > 0 ? `practice-answer:${result.eventId}` : null,
  );

  // §19 practice/review analytics — `finishedRef` gates the abandon event on
  // unmount so it never fires after a normal completion.
  const trackedSeedRef = useRef<PracticeSessionCreateResponse | undefined>(undefined);
  const finishedRef = useRef(false);
  const indexRef = useRef(index);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);
  useEffect(() => {
    if (!seed || trackedSeedRef.current === seed) return;
    trackedSeedRef.current = seed;
    trackEvent('practice_session_started', { mode: seed.session.mode, objectiveId: seed.session.objectiveId });
    return () => {
      if (!finishedRef.current) {
        trackEvent('practice_session_abandoned', { mode: seed.session.mode, index: indexRef.current });
      }
    };
    // Mount/unmount only, keyed on the seed identity — reading the latest
    // index via `indexRef` avoids re-firing this cleanup on every answer.
  }, [seed]);

  useEffect(() => {
    if (!finished || !seed) return;
    finishedRef.current = true;
    trackEvent('practice_session_completed', { mode: seed.session.mode, questionCount: seed.session.questionCount });
  }, [finished, seed]);

  const backTo = () => navigate('/practice');

  if (!sessionId || !seed || !question) {
    return (
      <AppPage noBottomNav>
        <PageHeader onBack={backTo} title="Практика" />
        <ContentCard>
          <p>
            Сесію не знайдено — практичні сесії не зберігаються між перезавантаженнями сторінки. Почніть
            нову.
          </p>
          <Button fullWidth onClick={backTo}>
            Почати нову сесію
          </Button>
        </ContentCard>
      </AppPage>
    );
  }

  const questionCount = seed.session.questionCount;
  const pct = questionCount > 0 ? ((index + (result ? 1 : 0)) / questionCount) * 100 : 0;

  function choose(chosenIndex: number) {
    if (selected !== null || answer.isPending) return;
    setSelected(chosenIndex);
    answer.mutate(toCanonicalIndex(optionOrder, chosenIndex), {
      onSuccess: (data) => {
        setResult(data);
        if (data.isCorrect) setCorrectCount((c) => c + 1);
        if (data.achievementsGranted.length > 0) {
          setAchievements((prev) => [...prev, ...data.achievementsGranted]);
        }
      },
      onError: () => setSelected(null),
    });
  }

  function next() {
    if (!result) return;
    if (result.nextQuestion) {
      setQuestion(result.nextQuestion);
      setIndex((i) => i + 1);
      setSelected(null);
      setResult(null);
    } else {
      setFinished(true);
    }
  }

  if (finished) {
    const accuracy = questionCount > 0 ? (correctCount / questionCount) * 100 : 0;

    if (designSystemV2) {
      return (
        <AppPage noBottomNav>
          <PageHeader onBack={backTo} title="Практику завершено" />
          <div className={styles.resultWrap}>
            <ProgressRing value={accuracy} size={128} strokeWidth={10} label="Точність" />
            <p className={styles.resultCount}>
              {correctCount} з {questionCount} правильно
            </p>
            {achievements.length > 0 && (
              <p className={styles.resultAchievements}>Отримано досягнень: {achievements.length}</p>
            )}
            <Button fullWidth onClick={backTo}>
              Готово
            </Button>
          </div>
        </AppPage>
      );
    }

    return (
      <AppPage noBottomNav>
        <PageHeader onBack={backTo} title="Практику завершено" />
        <ContentCard>
          <p>Ви пройшли {questionCount} питань.</p>
        </ContentCard>
        <Button fullWidth onClick={backTo}>
          Готово
        </Button>
      </AppPage>
    );
  }

  return (
    <AppPage noBottomNav className={designSystemV2 ? styles.sessionPage : undefined}>
      {/* Proto `Practice`: the exit control and the per-question progress share
          one thin row, so the question itself owns the first screenful. */}
      {designSystemV2 ? (
        <div className={styles.sessionHeader}>
          <button type="button" className={styles.exitBtn} onClick={backTo} aria-label="Вийти з практики">
            <Icon name="close" size={16} />
          </button>
          <SegmentedProgress count={questionCount} filled={index + (result ? 1 : 0)} />
        </div>
      ) : (
        <>
          <PageHeader onBack={backTo} title="Практика" />
          <ProgressBar value={pct} label={`${index + 1} / ${questionCount}`} />
        </>
      )}
      <CelebrationLayer active={celebrate} />

      {designSystemV2 ? (
        <div className={styles.questionBlock}>
          <p className={styles.questionMeta}>
            Питання {index + 1} з {questionCount}
          </p>
          <h1 className={styles.questionText}>{question.text}</h1>
        </div>
      ) : (
        <ContentCard>
          <p>{question.text}</p>
        </ContentCard>
      )}

      <div className={designSystemV2 ? styles.optionList : undefined}>
        {optionOrder.map((canonicalIndex, i) => {
          const option = question.options[canonicalIndex];
          let visualState: AnswerOptionVisualState = 'idle';
          if (result) {
            if (i === toDisplayIndex(optionOrder, result.correctIndex)) visualState = 'correct';
            else if (i === selected) visualState = 'wrong';
            else visualState = 'hidden';
          } else if (i === selected) {
            visualState = 'selected';
          }
          return (
            <AnswerOption
              key={i}
              index={designSystemV2 ? i : undefined}
              visualState={visualState}
              disabled={result !== null}
              onClick={() => choose(i)}
            >
              {option}
            </AnswerOption>
          );
        })}
      </div>

      {answer.isError && <p role="alert">Не вдалося надіслати відповідь. Спробуйте ще раз.</p>}

      {result && (
        <>
          <AnswerFeedback
            correct={result.isCorrect}
            explanation={result.explanationShort ?? undefined}
            reference={result.reference ?? undefined}
          />
          <Button fullWidth onClick={next}>
            {result.nextQuestion ? 'Далі' : 'Завершити'}
          </Button>
          <ReportQuestion
            key={question.revisionId}
            questionId={question.questionId}
            revisionId={question.revisionId}
            sessionId={sessionId}
          />
        </>
      )}
    </AppPage>
  );
}
