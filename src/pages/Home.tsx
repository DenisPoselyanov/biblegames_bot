import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { useTelegram } from '../hooks/useTelegram';
import { Icon } from '../components/Icon';
import { getAvatarById } from '../data/cosmetics';
import { studyRepo } from '../repos/studyRepo';
import { buildLearningInsight, getDailyTasks } from '../lib/learning';
import { trackEvent } from '../lib/telemetry';
import { normalizeBollsTranslation } from '../lib/bollsConstants';
import { fetchDailyScripture } from '../repos/scriptureRepo';
import type { DailyScripture } from '../types/scripture';
import styles from './Home.module.css';

const FALLBACK_DAILY = {
  text: 'Бо так полюбив Бог світ, що віддав Сина Свого Однородженого...',
  reference: 'Івана 3:16',
};

export function Home() {
  const { profile } = usePlayer();
  const { displayName } = useTelegram();
  const avatarEmoji = profile.avatar ? (getAvatarById(profile.avatar)?.emoji ?? '📖') : '📖';
  const translation = normalizeBollsTranslation(profile.bibleTranslation);
  const [dailyVerse, setDailyVerse] = useState<DailyScripture | typeof FALLBACK_DAILY>(FALLBACK_DAILY);

  useEffect(() => {
    void fetchDailyScripture(translation).then((daily) => {
      if (daily?.text) setDailyVerse(daily);
    });
  }, [translation]);
  const history = studyRepo.getAnswerHistory();
  const dailyTasks = getDailyTasks(profile, history);
  const insight = buildLearningInsight(profile, history);
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

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div className={styles.greeting}>
          <div className={styles.greetingRow}>
            <span className={styles.avatarBadge}>{avatarEmoji}</span>
            Мир тобі, {displayName}!
          </div>
          <cite className={styles.verseInline}>
            "{dailyVerse.text}"
            <span className={styles.verseRef}>{dailyVerse.reference}</span>
          </cite>
        </div>
      </header>

      <ul className={styles.statsGrid}>
        <li className={styles.stat}>
          <span className={styles.statIconWrap}>
            <Icon name="coins" size={30} />
          </span>
          <span className={styles.statValue}>{profile.coins}</span>
          <span className={styles.statLabel}>монет</span>
        </li>
        <li className={styles.stat}>
          <span className={styles.statIconWrap}>
            <Icon name="trophy" size={30} />
          </span>
          <span className={styles.statValue}>{profile.completedLevels.length}</span>
          <span className={styles.statLabel}>рівнів</span>
        </li>
        <li className={styles.stat}>
          <span className={`${styles.statIconWrap} ${styles.statIconWrapEmoji}`}>
            {streakFire || '📅'}
          </span>
          <span className={styles.statValue}>{profile.streakDays}</span>
          <span className={styles.statLabel}>streak</span>
        </li>
        <li className={styles.stat}>
          <span className={styles.statIconWrap}>
            <Icon name="book" size={30} />
          </span>
          <span className={styles.statValue}>
            {Object.keys(profile.themePoints).filter((k) => profile.themePoints[k] > 0).length}
          </span>
          <span className={styles.statLabel}>тем</span>
        </li>
      </ul>

      <Link to="/play" className={styles.cta}>
        <Icon name="play" size={24} />
        <span>Продовжити дослідження</span>
        <Icon name="arrow-right" size={20} />
      </Link>

      <section className={styles.tasksSection}>
        <h2>Щоденні завдання</h2>
        <ul className={styles.taskList}>
          {dailyTasks.map((task) => {
            const pct = task.goal > 0 ? Math.min((task.progress / task.goal) * 100, 100) : 0;
            const done = pct >= 100;
            return (
              <li
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
              </li>
            );
          })}
        </ul>
      </section>

      <section className={styles.tasksSection}>
        <h2>Learning KPI</h2>
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
