/**
 * Today screen (Phase 3 WS6, spec §9) — server-backed via `GET /learning/today`.
 * §9.2 priority order: continue active lesson > due review > daily plan lesson
 * > optional challenge (never populated server-side, §9.1) > supporting
 * verse/streak/progress. §9.3 states covered: first-time, active plan,
 * all-done, offline, failed generation. Timezone-transition, migrated-legacy-
 * user and account-restricted have no distinct server payload today — not
 * invented client-side, same rule as `optionalChallenge`.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthSession } from '../../context/AuthSessionContext';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useEventOnce } from '../../hooks/useEventOnce';
import { isFeatureEnabled } from '../../lib/flags';
import { trackEvent } from '../../lib/telemetry';
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
  Pill,
  SectionHeader,
} from '../../components/ui';
import { Icon } from '../../components/Icon';
import type { IconName } from '../../components/Icon';
import { ListPageSkeleton } from '../../components/skeletons';
import styles from './Today.module.css';

/** Local time, not server data — a greeting is presentation, not a fact the backend needs to own. */
function greetingForHour(hour: number): string {
  if (hour < 5) return 'Доброї ночі';
  if (hour < 12) return 'Доброго ранку';
  if (hour < 18) return 'Доброго дня';
  return 'Доброго вечора';
}

export function Today() {
  const { userId, displayName } = useAuthSession();
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useTodayView(userId);
  const designSystemV2 = isFeatureEnabled('designSystemV2');
  const greeting = `${greetingForHour(new Date().getHours())}, ${displayName}`;

  const allDoneToday = Boolean(data && data.dailyGoal.completed >= data.dailyGoal.target);
  const celebrate = useEventOnce(allDoneToday && data ? `daily-goal:${data.date}` : null);

  useEffect(() => {
    if (!data) return;
    trackEvent('today_viewed', {
      hasActiveLesson: Boolean(data.activeLesson),
      hasDueReview: Boolean(data.dueReview),
      allDoneToday,
    });
    // Fire once per fetched day's payload, not on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.date]);

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
      <PageHeader kicker="Сьогодні" title={designSystemV2 ? greeting : 'Твій день'} />
      <CelebrationLayer active={celebrate} />

      {/* §9.2 priority 1: continue active lesson */}
      {activeLesson && (
        <HeroCard
          tone={designSystemV2 ? 'cover' : 'surface'}
          coverSeed={activeLesson.lesson.id}
          badges={
            <Pill tone="onColor" icon={<Icon name="crown" size={12} />}>
              Урок дня
            </Pill>
          }
          kicker="Продовжити"
          title={activeLesson.lesson.title}
          footer={
            <Button
              variant={designSystemV2 ? 'onColor' : 'primary'}
              fullWidth={designSystemV2}
              onClick={() => {
                trackEvent('today_action_selected', { action: 'continue_lesson' });
                navigate(`/learn/lessons/${activeLesson.lesson.id}`);
              }}
            >
              Продовжити урок
            </Button>
          }
        />
      )}

      {/* §9.2 priority 2: due review, shown only when no active lesson is already the hero */}
      {!activeLesson && dueReview && (
        <HeroCard
          tone={designSystemV2 ? 'cover' : 'surface'}
          coverSeed={dueReview.lessonId}
          badges={
            <Pill tone="onColor" icon={<Icon name="refresh" size={12} />}>
              Повторення
            </Pill>
          }
          kicker="Час повторити"
          title={dueReview.title}
          footer={
            <Button
              variant={designSystemV2 ? 'onColor' : 'primary'}
              fullWidth={designSystemV2}
              onClick={() => {
                trackEvent('today_action_selected', { action: 'review' });
                navigate(`/learn/lessons/${dueReview.lessonId}`);
              }}
            >
              Повторити
            </Button>
          }
        />
      )}

      {/* §9.3 first-time / no active plan yet */}
      {!activeLesson && !dueReview && dailyGoal.completed === 0 && (
        <HeroCard
          tone={designSystemV2 ? 'cover' : 'surface'}
          coverSeed="start-learning"
          badges={
            <Pill tone="onColor" icon={<Icon name="book" size={12} />}>
              Початок
            </Pill>
          }
          kicker="Початок"
          title="Розпочни навчання"
          description="Обери план у розділі «Навчання», щоб побачити тут свій прогрес."
          footer={
            <Button
              variant={designSystemV2 ? 'onColor' : 'primary'}
              fullWidth={designSystemV2}
              onClick={() => {
                trackEvent('today_action_selected', { action: 'start_learning' });
                navigate('/learn');
              }}
            >
              До розділу навчання
            </Button>
          }
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

      {designSystemV2 && (
        <section>
          <SectionHeader title="Швидкий підхід" />
          <div className={styles.quickGrid}>
            <QuickTile
              icon="brain"
              title="Практика"
              meta="Тренуй вивчене"
              emphasis
              onClick={() => {
                trackEvent('today_action_selected', { action: 'quick_practice' });
                navigate('/practice');
              }}
            />
            <QuickTile
              icon="clock"
              title="Повторення"
              meta={dueReview ? 'Є що повторити' : 'Заплановане повторення'}
              onClick={() => {
                trackEvent('today_action_selected', { action: 'quick_review' });
                navigate('/review');
              }}
            />
          </div>
        </section>
      )}

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

function QuickTile({
  icon,
  title,
  meta,
  onClick,
  emphasis,
}: {
  icon: IconName;
  title: string;
  meta: string;
  onClick: () => void;
  emphasis?: boolean;
}) {
  return (
    <button
      type="button"
      className={`${styles.quickTile}${emphasis ? ` ${styles.quickTileEmphasis}` : ''}`}
      onClick={onClick}
    >
      <span className={styles.quickTileIcon}>
        <Icon name={icon} size={18} />
      </span>
      <span className={styles.quickTileTitle}>{title}</span>
      <span className={styles.quickTileMeta}>{meta}</span>
    </button>
  );
}
