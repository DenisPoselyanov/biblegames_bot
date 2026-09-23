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
import { isFeatureEnabled } from '../../lib/flags';
import { trackEvent } from '../../lib/telemetry';
import {
  useCompleteLessonSession,
  useProgressLessonSession,
  useStartLessonSession,
} from '../../queries/useLearning';
import { LessonBlockRenderer } from '../../components/learn/LessonBlockRenderer';
import { INTERACTIVE_LESSON_BLOCK_TYPES } from '../../components/learn/lessonBlockPayloads';
import { Icon } from '../../components/Icon';
import {
  AppPage,
  Button,
  CelebrationLayer,
  ContentCard,
  CoverArt,
  Dialog,
  ErrorState,
  PageHeader,
  ProgressBar,
  ProgressRing,
} from '../../components/ui';
import { AppSkeleton } from '../../components/skeletons';
import styles from './LessonSession.module.css';

/** Segmented per-block progress (Phase 3.5 §6 WS3) — one span per real block, filled up to the current index. Same `index`/`blocks.length` data the legacy linear `ProgressBar` already used, just a different shell. */
function SegmentedProgress({ count, filled }: { count: number; filled: number }) {
  return (
    <div className={styles.segments} role="progressbar" aria-valuenow={filled} aria-valuemin={0} aria-valuemax={count}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={i < filled ? styles.segmentFilled : styles.segment} />
      ))}
    </div>
  );
}

export function LessonSession() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const { userId } = useAuthSession();

  const designSystemV2 = isFeatureEnabled('designSystemV2');
  const start = useStartLessonSession(lessonId ?? '');
  // `null` until the user advances past the resumed position — while null, the
  // effective index is derived from the server's checkpoint below instead of
  // being set from an effect (avoids a setState-in-effect cascade).
  const [advancedIndex, setAdvancedIndex] = useState<number | null>(null);
  const [showCompletion, setShowCompletion] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

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
    if (designSystemV2) bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [index, designSystemV2]);
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
          if (designSystemV2) {
            setShowCompletion(true);
          } else {
            navigate('/', { replace: true });
          }
        },
      });
      return;
    }
    progress.mutate(currentBlock.id);
    setAdvancedIndex(Math.min(index + 1, blocks.length - 1));
  }

  return (
    <AppPage noBottomNav className={styles.page}>
      {/* Proto `LessonReader`: a thin reading header — close, per-block
          progress, position — then the lesson's own title block. The lesson
          title belongs to the text, not to a chrome bar above it. */}
      {designSystemV2 ? (
        <>
          <div className={styles.readerHeader}>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={() => navigate('/learn')}
              aria-label="Закрити урок"
            >
              <Icon name="close" size={16} />
            </button>
            <SegmentedProgress count={blocks.length} filled={index + 1} />
            <span className={styles.readerCount}>
              {Math.min(index + 1, blocks.length)}/{blocks.length}
            </span>
          </div>
          <header className={styles.lessonHead}>
            <h1 className={styles.lessonTitle}>{lesson.title}</h1>
            {lesson.description && <p className={styles.lessonReference}>{lesson.description}</p>}
          </header>
        </>
      ) : (
        <>
          <PageHeader onBack={() => navigate('/learn')} title={lesson.title} />
          <ProgressBar value={pct} />
        </>
      )}
      <CelebrationLayer active={celebrateComplete} />

      {/* §4 Phase 3.5 audit: v2 shows every block read so far cumulatively
          (scroll down), not just the current one — v1's one-block-at-a-time
          shell is untouched below. */}
      {designSystemV2 ? (
        <div className={styles.blocksStack}>
          {blocks.slice(0, index + 1).map((block) =>
            // Interactive blocks read as a distinct "task" card in the scrolling lesson.
            (INTERACTIVE_LESSON_BLOCK_TYPES as readonly string[]).includes(block.blockType) ? (
              <ContentCard key={block.id}>
                <LessonBlockRenderer block={block} richBlocks />
              </ContentCard>
            ) : (
              <LessonBlockRenderer key={block.id} block={block} richBlocks />
            ),
          )}
          {blocks.length === 0 && <p>У цьому уроці ще немає вмісту.</p>}
          <div ref={bottomRef} />
        </div>
      ) : (
        <ContentCard className={styles.blockCard}>
          {currentBlock ? (
            <LessonBlockRenderer block={currentBlock} />
          ) : (
            <p>У цьому уроці ще немає вмісту.</p>
          )}
        </ContentCard>
      )}

      <div className={designSystemV2 ? styles.readerAction : undefined}>
        <Button
          fullWidth
          size={designSystemV2 ? 'lg' : 'md'}
          onClick={advance}
          disabled={progress.isPending || complete.isPending}
        >
          {isLast ? 'Завершити урок' : 'Далі'}
        </Button>
      </div>

      {designSystemV2 && (
        <Dialog open={showCompletion} className={styles.completionModal}>
          <CoverArt seed={lessonId ?? 'lesson-complete'} glyph="rays" scrim className={styles.completionCover} />
          <div className={styles.completionContent}>
            <ProgressRing value={100} size={84} strokeWidth={7} onColor centerLabel={<Icon name="check" size={30} />} label="Урок завершено" />
            <h2 className={styles.completionTitle}>Урок завершено</h2>
            <p className={styles.completionDesc}>Закріпи прочитане практикою, поки воно свіже</p>
            <Button
              variant="onColor"
              fullWidth
              onClick={() => {
                if (lessonId) trackEvent('today_action_selected', { action: 'post_lesson_practice' });
                navigate('/practice');
              }}
            >
              До практики
            </Button>
            <button type="button" className={styles.completionLater} onClick={() => navigate('/', { replace: true })}>
              Пізніше
            </button>
          </div>
        </Dialog>
      )}
    </AppPage>
  );
}
