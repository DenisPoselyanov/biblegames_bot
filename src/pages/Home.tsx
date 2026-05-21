import { Link } from 'react-router-dom';
import { useEffect, useMemo } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { useTelegram } from '../hooks/useTelegram';
import { studyRepo } from '../repos/studyRepo';
import { buildLearningInsight, getDailyTasks } from '../lib/learning';
import { trackEvent } from '../lib/telemetry';
import styles from './Home.module.css';

export function Home() {
  const { profile } = usePlayer();
  const { displayName } = useTelegram();
  const verses = [
    { text: 'Бо так полюбив Бог світ, що віддав Сина Свого Однородженого...', reference: 'Івана 3:16' },
    { text: 'Слово Твоє — світильник нозі моїй і світло стежці моїй.', reference: 'Псалом 119:105' },
    { text: 'Блаженні голодні та спраглі правди, бо вони наситяться.', reference: 'Матвія 5:6' },
  ];
  const dayIndex = Math.floor(Date.now() / 86400000) % verses.length;
  const dailyVerse = verses[dayIndex];
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

  return (
    <section className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.greeting}>Мир тобі, {displayName}!</p>
        <div className={styles.verseCard}>
          <blockquote>"{dailyVerse.text}"</blockquote>
          <cite>— {dailyVerse.reference}</cite>
        </div>
      </header>

      <ul className={styles.statsRow}>
        <li className={styles.stat}>
          <strong>{profile.coins}</strong>
          <span>монет</span>
        </li>
        <li className={styles.stat}>
          <strong>{profile.completedLevels.length}</strong>
          <span>рівнів</span>
        </li>
        <li className={styles.stat}>
          <strong>{profile.streakDays}</strong>
          <span>streak</span>
        </li>
        <li className={styles.stat}>
          <strong>
            {Object.keys(profile.themePoints).filter((k) => profile.themePoints[k] > 0).length}
          </strong>
          <span>тем</span>
        </li>
      </ul>

      <Link to="/play" className={styles.cta}>
        Продовжити дослідження →
      </Link>

      <section className={styles.tasksSection}>
        <h2>Щоденні завдання</h2>
        <ul className={styles.taskList}>
          {dailyTasks.map((task) => (
            <li key={task.id} className={styles.taskCard}>
              <span>{task.title}</span>
              <strong>{task.progress}/{task.goal}</strong>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.tasksSection}>
        <h2>Learning KPI</h2>
        <ul className={styles.taskList}>
          <li className={styles.taskCard}><span>Освоєні підтеми</span><strong>{insight.masteredSubthemes}</strong></li>
          <li className={styles.taskCard}><span>Точність 7 днів</span><strong>{insight.accuracy7d}%</strong></li>
          <li className={styles.taskCard}><span>Точність 30 днів</span><strong>{insight.accuracy30d}%</strong></li>
        </ul>
      </section>
    </section>
  );
}
