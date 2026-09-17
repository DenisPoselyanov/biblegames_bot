/**
 * Lesson session (Phase 3 WS6, spec §11.3-§11.5). One block shown at a time;
 * each "Далі" advance calls `POST /lesson-sessions/:id/progress` with the
 * block just shown as the checkpoint, and the last block calls `.../complete`
 * — the server is authoritative for session state (§11.4), this view only
 * caches it for the current render. Resuming a lesson jumps back to the
 * server's `checkpointBlockId` instead of restarting at block 0.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthSession } from '../../context/AuthSessionContext';
import { useEventOnce } from '../../hooks/useEventOnce';
import { trackEvent } from '../../lib/telemetry';
import {
  useCompleteLessonSession,
  useProgressLessonSession,
  useStartLessonSession,
} from '../../queries/useLearning';
import { LessonBlockRenderer } from '../../components/learn/LessonBlockRenderer';
import { AppPage, Button, CelebrationLayer, ContentCard, ErrorState, PageHeader, ProgressBar } from '../../components/ui';
import { AppSkeleton } from '../../components/skeletons';
import styles from './LessonSession.module.css';

export function LessonSession() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const { userId } = useAuthSession();

  const start = useStartLessonSession(lessonId ?? '');
  // `null` until the user advances past the resumed position — while null, the
  // effective index is derived from the server's checkpoint below instead of
  // being set from an effect (avoids a setState-in-effect cascade).
  const [advancedIndex, setAdvancedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!lessonId) return;
    start.mutate();
    // Fire once per mounted lesson id — a re-render must not re-start the session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  const session = start.data?.session;
  const lesson = start.data?.lesson;
  const blocks = useMemo(() => lesson?.blocks ?? [], [lesson]);

  // Resume at the server's checkpoint instead of restarting at block 0.
  const resumeIndex = useMemo(() => {
    if (!session?.checkpointBlockId || blocks.length === 0) return 0;
    const at = blocks.findIndex((b) => b.id === session.checkpointBlockId);
    return at >= 0 ? Math.min(at + 1, blocks.length - 1) : 0;
  }, [session, blocks]);
  const index = advancedIndex ?? resumeIndex;

  const sessionId = session?.id ?? '';
  const progress = useProgressLessonSession(sessionId);
  const complete = useCompleteLessonSession(sessionId, userId);
  const celebrateComplete = useEventOnce(complete.isSuccess && sessionId ? `lesson-complete:${sessionId}` : null);

  // §19 lesson analytics. `completedRef` gates the abandon event on unmount —
  // it must not fire after a normal completion. `indexRef` keeps the unmount
  // closure below reading the current block index instead of the one from
  // whenever the effect last ran.
  const trackedSessionRef = useRef<string | null>(null);
  const completedRef = useRef(false);
  const indexRef = useRef(index);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);
  useEffect(() => {
    if (!lessonId || !session || trackedSessionRef.current === session.id) return;
    trackedSessionRef.current = session.id;
    if (session.checkpointBlockId) {
      trackEvent('lesson_resumed', { lessonId, checkpointBlockId: session.checkpointBlockId });
    } else {
      trackEvent('lesson_started', { lessonId });
    }
  }, [lessonId, session]);

  useEffect(() => {
    return () => {
      if (lessonId && trackedSessionRef.current && !completedRef.current) {
        trackEvent('lesson_abandoned', { lessonId, blockIndex: indexRef.current });
      }
    };
    // Mount/unmount only — reading the latest index via `indexRef` instead of
    // a dependency avoids re-firing this cleanup on every block advance.
  }, [lessonId]);

  if (start.isError) {
    return (
      <AppPage noBottomNav>
        <PageHeader onBack={() => navigate('/learn')} title="Урок" />
        <ErrorState title="Не вдалося розпочати урок" onRetry={() => start.mutate()} />
      </AppPage>
    );
  }

  if (start.isPending || !lesson || !session) {
    return <AppSkeleton />;
  }

  const currentBlock = blocks[index];
  const isLast = index === blocks.length - 1;
  const pct = blocks.length > 0 ? ((index + 1) / blocks.length) * 100 : 0;

  function advance() {
    if (!currentBlock) return;
    if (isLast) {
      complete.mutate(undefined, {
        onSuccess: () => {
          completedRef.current = true;
          if (lessonId) trackEvent('lesson_completed', { lessonId, blockCount: blocks.length });
          navigate('/', { replace: true });
        },
      });
      return;
    }
    progress.mutate(currentBlock.id);
    setAdvancedIndex(Math.min(index + 1, blocks.length - 1));
  }

  return (
    <AppPage noBottomNav className={styles.page}>
      <PageHeader onBack={() => navigate('/learn')} title={lesson.title} />
      <ProgressBar value={pct} />
      <CelebrationLayer active={celebrateComplete} />

      <ContentCard className={styles.blockCard}>
        {currentBlock ? (
          <LessonBlockRenderer block={currentBlock} />
        ) : (
          <p>У цьому уроці ще немає вмісту.</p>
        )}
      </ContentCard>

      <Button fullWidth onClick={advance} disabled={progress.isPending || complete.isPending}>
        {isLast ? 'Завершити урок' : 'Далі'}
      </Button>
    </AppPage>
  );
}
