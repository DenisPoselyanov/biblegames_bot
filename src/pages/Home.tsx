import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { useTelegram } from '../hooks/useTelegram';
import { Icon } from '../components/Icon';
import { StreakBadge } from '../components/StreakBadge';
import { getAvatarById } from '../data/cosmetics';
import { studyRepo } from '../repos/studyRepo';
import { formatRankLabel } from '../lib/practiceProgression';
import { buildLearningInsight, countTotalPassedStages, getDailyTasks } from '../lib/learning';
import { trackEvent } from '../lib/telemetry';
import { normalizeBollsTranslation } from '../lib/bollsConstants';
import { fetchDailyScripture } from '../repos/scriptureRepo';
import type { DailyScripture } from '../types/scripture';
import type { DailyPlanItem, Recommendation } from '../types';
import { formatRecommendation, getRecommendationLink } from '../lib/recommendationEngine';
import { isFeatureEnabled } from '../lib/flags';
import { buildReviewQueue } from '../lib/reviewScheduler';
import { loadTopicHierarchy } from '../data/topicDbLoader';
import type { TopicNode } from '../types';
import { MotionStagger, MotionStaggerItem } from '../components/motion';
import { useMotionEntrance } from '../hooks/useMotionEntrance';
import styles from './Home.module.css';

const FALLBACK_DAILY = {
  text: 'Бо так полюбив Бог світ, що віддав Сина Свого Однородженого...',
  reference: 'Івана 3:16',
};

const learningFirstNav = isFeatureEnabled('learning_first_navigation');
const dailyPlanV2 = isFeatureEnabled('daily_plan_v2');
const todayDashboard = isFeatureEnabled('today_dashboard');
const reviewSchedulerV2 = isFeatureEnabled('review_scheduler_v2');

const TODAY_DATE_FORMAT = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long' });

export function Home() {
  const { shouldEnter } = useMotionEntrance('home');
  const { profile, getRecommendations, getDailyPlan } = usePlayer();
  const { displayName } = useTelegram();
  const [reviewHierarchy, setReviewHierarchy] = useState<TopicNode | null>(null);
  const avatarEmoji = profile.avatar ? (getAvatarById(profile.avatar)?.emoji ?? '📖') : '📖';
  const translation = normalizeBollsTranslation(profile.bibleTranslation);
  const [dailyVerse, setDailyVerse] = useState<DailyScripture | typeof FALLBACK_DAILY>(FALLBACK_DAILY);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [dailyPlan, setDailyPlan] = useState<DailyPlanItem[]>([]);

  useEffect(() => {
    void fetchDailyScripture(translation).then((daily) => {
      if (daily?.text) setDailyVerse(daily);
    });
  }, [translation]);

  useEffect(() => {
    if (dailyPlanV2) {
      void getDailyPlan().then(setDailyPlan);
      return;
    }
    if (!learningFirstNav) return;
    void getRecommendations(3).then(setRecommendations);
  }, [getRecommendations, getDailyPlan]);
  const history = studyRepo.getAnswerHistory();
  const dailyTasks = getDailyTasks(profile, history);
  const insight = buildLearningInsight(profile, history);
  const passedStages = countTotalPassedStages(profile);
  const completedTaskIds = useMemo(
    () => dailyTasks.filter((task) => task.completed).map((task) => task.id),
    [dailyTasks],
  );

  useEffect(() => {
    const key = `bible-game-daily-completed-${new Date().toISOString().slice(0, 10)}`;
    let already: string[] = [];
    try {
      already = JSON.parse(localStorage.getItem(key) ?? '[]') as string[];
    } catch {
      already = [];
    }

    const fresh = completedTaskIds.filter((id) => !already.includes(id));
    if (fresh.length > 0) {
      fresh.forEach((taskId) => {
        trackEvent('daily_task_completed', { taskId });
      });
      localStorage.setItem(key, JSON.stringify([...already, ...fresh]));
    }
  }, [completedTaskIds]);

  const streakFire = profile.streakDays >= 3 ? '🔥' : profile.streakDays >= 1 ? '✨' : '';

  const reviewThemeId = profile.activeTheme;

  useEffect(() => {
    if (!reviewSchedulerV2 || !reviewThemeId) return;
    let cancelled = false;
    void loadTopicHierarchy(reviewThemeId).then((root) => {
      if (!cancelled) setReviewHierarchy(root);
    });
    return () => {
      cancelled = true;
    };
  }, [reviewThemeId]);

  const reviewQueue = useMemo(
    () => (reviewHierarchy ? buildReviewQueue(profile, reviewHierarchy, reviewThemeId) : []),
    [reviewHierarchy, profile, reviewThemeId],
  );

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        {todayDashboard && (
          <div className={styles.todayRow}>
            <span className={styles.todayDate}>
              Сьогодні, {TODAY_DATE_FORMAT.format(new Date())}
            </span>
            <StreakBadge streakDays={profile.streakDays} />
          </div>
        )}
        <div className={styles.greeting}>
          <div className={styles.greetingRow}>
            <span className={styles.avatarBadge}>{avatarEmoji}</span>
            <span>
              Мир тобі, {displayName}!
              <span className={styles.rankChip}>
                {formatRankLabel(profile.playerRank.tier, profile.playerRank.plaque)}
              </span>
            </span>
          </div>
          <cite className={styles.verseInline}>
            "{dailyVerse.text}"
            <span className={styles.verseRef}>{dailyVerse.reference}</span>
          </cite>
        </div>
      </header>

      <MotionStagger as="ul" className={styles.statsGrid} enter={shouldEnter}>
        <MotionStaggerItem className={styles.stat}>
          <span className={styles.statIconWrap}>
            <Icon name="coins" size={30} />
          </span>
          <span className={styles.statValue}>{profile.coins}</span>
          <span className={styles.statLabel}>монет</span>
        </MotionStaggerItem>
        <MotionStaggerItem className={styles.stat}>
          <span className={styles.statIconWrap}>
            <Icon name="trophy" size={30} />
          </span>
          <span className={styles.statValue}>{passedStages}</span>
          <span className={styles.statLabel}>етапів</span>
        </MotionStaggerItem>
        {!todayDashboard && (
          <MotionStaggerItem className={styles.stat}>
            <span className={`${styles.statIconWrap} ${styles.statIconWrapEmoji}`}>
              {streakFire || '📅'}
            </span>
            <span className={styles.statValue}>{profile.streakDays}</span>
            <span className={styles.statLabel}>серія</span>
          </MotionStaggerItem>
        )}
        <MotionStaggerItem className={styles.stat}>
          <span className={styles.statIconWrap}>
            <Icon name="book" size={30} />
          </span>
          <span className={styles.statValue}>
            {Object.keys(profile.themePoints).filter((k) => profile.themePoints[k] > 0).length}
          </span>
          <span className={styles.statLabel}>тем</span>
        </MotionStaggerItem>
      </MotionStagger>

      {reviewSchedulerV2 && reviewQueue.length > 0 && (
        <Link to={`/play/study/review-queue/${reviewThemeId}`} className={styles.cta}>
          <span aria-hidden>🔄</span>
          <span>Повторити {reviewQueue.length} тем{reviewQueue.length === 1 ? 'у' : ''}</span>
          <Icon name="arrow-right" size={20} />
        </Link>
      )}

      {dailyPlanV2 ? (
        dailyPlan.length > 0 ? (
          <section className={styles.dailyPlanSection}>
            <h2>Сьогоднішній план</h2>
            <MotionStagger as="ul" className={styles.dailyPlanList} enter={shouldEnter}>
              {dailyPlan.map((item) => (
                <MotionStaggerItem key={item.id} className={styles.dailyPlanCardWrap}>
                  <Link to={item.link} className={styles.dailyPlanCard}>
                    <span className={styles.dailyPlanIcon} aria-hidden>
                      {item.icon}
                    </span>
                    <span className={styles.dailyPlanBody}>
                      <span className={styles.dailyPlanTitle}>{item.title}</span>
                      <span className={styles.dailyPlanSubtitle}>{item.subtitle}</span>
                    </span>
                    <Icon name="arrow-right" size={20} />
                  </Link>
                </MotionStaggerItem>
              ))}
            </MotionStagger>
          </section>
        ) : (
          <Link to="/play" className={styles.cta}>
            <Icon name="play" size={24} />
            <span>Продовжити дослідження</span>
            <Icon name="arrow-right" size={20} />
          </Link>
        )
      ) : (
        <>
          {learningFirstNav && recommendations.length > 0 ? (
            <section className={styles.recommendationsSection}>
              {recommendations.map((rec) => {
                const formatted = formatRecommendation(rec);
                return (
                  <Link
                    key={rec.id}
                    to={getRecommendationLink(rec)}
                    className={styles.cta}
                  >
                    <span aria-hidden>{formatted.icon}</span>
                    <span>{formatted.title}</span>
                    <Icon name="arrow-right" size={20} />
                  </Link>
                );
              })}
            </section>
          ) : (
            <Link to="/play" className={styles.cta}>
              <Icon name="play" size={24} />
              <span>Продовжити дослідження</span>
              <Icon name="arrow-right" size={20} />
            </Link>
          )}

          <section className={styles.tasksSection}>
            <h2>Щоденні завдання</h2>
            <MotionStagger as="ul" className={styles.taskList} enter={shouldEnter}>
              {dailyTasks.map((task) => {
                const pct = task.goal > 0 ? Math.min((task.progress / task.goal) * 100, 100) : 0;
                const done = pct >= 100;
                return (
                  <MotionStaggerItem
                    key={task.id}
                    className={`${styles.taskCard} ${done ? styles.taskCardCompleted : ''}`}
                  >
                    <div className={styles.taskInfo}>
                      <span>{task.title}</span>
                      <div className={styles.progressBar}>
                        <div
                          className={`${styles.progressFill} ${done ? styles.progressFillComplete : ''}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    {done ? (
                      <span className={styles.taskCheck}>
                        <Icon name="check" size={16} />
                      </span>
                    ) : (
                      <span className={styles.taskCount}>
                        {task.progress}/{task.goal}
                      </span>
                    )}
                  </MotionStaggerItem>
                );
              })}
            </MotionStagger>
          </section>
        </>
      )}

      <section className={styles.kpiSection}>
        <h2>Навчальні показники</h2>
        <div className={styles.kpiGrid}>
          <div className={styles.kpiCard}>
            <Icon name="brain" size={20} />
            <strong>
              <span className={`${styles.kpiBadge} ${styles.kpiBadgeGold}`}>
                {insight.masteredSubthemes}
              </span>
            </strong>
            <span>Освоєно підтем</span>
          </div>
          <div className={styles.kpiCard}>
            <Icon name="star" size={20} />
            <strong>
              <span className={`${styles.kpiBadge} ${styles.kpiBadgeGreen}`}>
                {insight.accuracy7d}%
              </span>
            </strong>
            <span>Точність 7д</span>
          </div>
          <div className={styles.kpiCard}>
            <Icon name="stats" size={20} />
            <strong>
              <span className={`${styles.kpiBadge} ${styles.kpiBadgeTeal}`}>
                {insight.accuracy30d}%
              </span>
            </strong>
            <span>Точність 30д</span>
          </div>
        </div>
      </section>
    </section>
  );
}
