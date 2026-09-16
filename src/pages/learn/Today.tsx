/**
 * Today screen (Phase 3 WS6, spec §9) — server-backed via `GET /learning/today`.
 * §9.2 priority order: continue active lesson > due review > daily plan lesson
 * > optional challenge (never populated server-side, §9.1) > supporting
 * verse/streak/progress. §9.3 states covered: first-time, active plan,
 * all-done, offline, failed generation. Timezone-transition, migrated-legacy-
 * user and account-restricted have no distinct server payload today — not
 * invented client-side, same rule as `optionalChallenge`.
 */
import { useNavigate } from 'react-router-dom';
import { useAuthSession } from '../../context/AuthSessionContext';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useEventOnce } from '../../hooks/useEventOnce';
import { useTodayView } from '../../queries/useLearning';
import {
  AppPage,
  AnimatedNumber,
  Button,
  CelebrationLayer,
  ContentCard,
  ErrorState,
  HeroCard,
  MetricTile,
  MetricTileGrid,
  OfflineState,
  PageHeader,
} from '../../components/ui';
import { Icon } from '../../components/Icon';
import { ListPageSkeleton } from '../../components/skeletons';
import styles from './Today.module.css';

export function Today() {
  const { userId } = useAuthSession();
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useTodayView(userId);

  const allDoneToday = Boolean(data && data.dailyGoal.completed >= data.dailyGoal.target);
  const celebrate = useEventOnce(allDoneToday && data ? `daily-goal:${data.date}` : null);

  if (isLoading) {
    return (
      <AppPage>
        <PageHeader kicker="Сьогодні" title="Твій день" />
        <ListPageSkeleton cards={2} />
      </AppPage>
    );
  }

  if (!online && !data) {
    return (
      <AppPage>
        <OfflineState onRetry={() => void refetch()} />
      </AppPage>
    );
  }

  if (isError || !data) {
    return (
      <AppPage>
        <ErrorState
          title="Не вдалося сформувати план на сьогодні"
          onRetry={() => void refetch()}
        />
      </AppPage>
    );
  }

  const { activeLesson, dueReview, dailyGoal, streak, verseOfDay, recentOutcome } = data;

  return (
    <AppPage className={styles.page}>
      <PageHeader kicker="Сьогодні" title="Твій день" />
      <CelebrationLayer active={celebrate} />

      {/* §9.2 priority 1: continue active lesson */}
      {activeLesson && (
        <HeroCard
          kicker="Продовжити"
          title={activeLesson.lesson.title}
          footer={
            <Button onClick={() => navigate(`/learn/lessons/${activeLesson.lesson.id}`)}>
              Продовжити урок
            </Button>
          }
        />
      )}

      {/* §9.2 priority 2: due review, shown only when no active lesson is already the hero */}
      {!activeLesson && dueReview && (
        <HeroCard
          kicker="Час повторити"
          title={dueReview.title}
          footer={
            <Button onClick={() => navigate(`/learn/lessons/${dueReview.lessonId}`)}>
              Повторити
            </Button>
          }
        />
      )}

      {/* §9.3 first-time / no active plan yet */}
      {!activeLesson && !dueReview && dailyGoal.completed === 0 && (
        <HeroCard
          kicker="Початок"
          title="Розпочни навчання"
          description="Обери план у розділі «Навчання», щоб побачити тут свій прогрес."
          footer={<Button onClick={() => navigate('/learn')}>До розділу навчання</Button>}
        />
      )}

      {/* §9.3 all tasks completed */}
      {allDoneToday && (
        <ContentCard>
          <p className={styles.doneText}>Сьогоднішню ціль виконано. 🎉</p>
        </ContentCard>
      )}

      <MetricTileGrid>
        <MetricTile
          icon={<Icon name="check" size={20} />}
          value={<AnimatedNumber value={dailyGoal.completed} />}
          label={`з ${dailyGoal.target} уроків сьогодні`}
        />
        <MetricTile
          icon={<Icon name="fire" size={20} />}
          value={<AnimatedNumber value={streak.days} />}
          label="днів поспіль"
        />
      </MetricTileGrid>

      {verseOfDay && (
        <ContentCard>
          <p className={styles.verseText}>{verseOfDay.text}</p>
          <p className={styles.verseRef}>
            {verseOfDay.reference} · {verseOfDay.translation}
          </p>
        </ContentCard>
      )}

      {recentOutcome && (
        <p className={styles.recentOutcome}>Востаннє: {recentOutcome.title}</p>
      )}
    </AppPage>
  );
}
