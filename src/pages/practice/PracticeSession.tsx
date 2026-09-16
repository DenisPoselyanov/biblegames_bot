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
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAnswerPracticeSession } from '../../queries/useLearning';
import { useEventOnce } from '../../hooks/useEventOnce';
import { trackEvent } from '../../lib/telemetry';
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
} from '../../components/ui';

export function PracticeSession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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

  const answer = useAnswerPracticeSession(sessionId ?? '');
  const celebrate = useEventOnce(
    result && result.achievementsGranted.length > 0 ? `practice-answer:${result.eventId}` : null,
  );

  // §19 practice/review analytics — `finishedRef` gates the abandon event on
  // unmount so it never fires after a normal completion.
  const trackedSeedRef = useRef<PracticeSessionCreateResponse | undefined>(undefined);
  const finishedRef = useRef(false);
  const indexRef = useRef(index);
  indexRef.current = index;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    answer.mutate(chosenIndex, {
      onSuccess: (data) => setResult(data),
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
    <AppPage noBottomNav>
      <PageHeader onBack={backTo} title="Практика" />
      <ProgressBar value={pct} label={`${index + 1} / ${questionCount}`} />
      <CelebrationLayer active={celebrate} />

      <ContentCard>
        <p>{question.text}</p>
      </ContentCard>

      {question.options.map((option, i) => {
        let visualState: AnswerOptionVisualState = 'idle';
        if (result) {
          if (i === result.correctIndex) visualState = 'correct';
          else if (i === selected) visualState = 'wrong';
          else visualState = 'hidden';
        } else if (i === selected) {
          visualState = 'selected';
        }
        return (
          <AnswerOption key={i} visualState={visualState} disabled={result !== null} onClick={() => choose(i)}>
            {option}
          </AnswerOption>
        );
      })}

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
        </>
      )}
    </AppPage>
  );
}
