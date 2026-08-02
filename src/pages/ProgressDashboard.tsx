import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import { studyRepo } from '../repos/studyRepo';
import { loadTopicHierarchy } from '../data/topicDbLoader';
import { buildProgressSummary } from '../lib/progressDashboard';
import type { ProgressSummary, TopicNode } from '../types';
import { Icon } from '../components/Icon';
import { StreakBadge } from '../components/StreakBadge';
import styles from './ProgressDashboard.module.css';

export function ProgressDashboard() {
  const navigate = useNavigate();
  const { profile } = usePlayer();
  const [hierarchies, setHierarchies] = useState<Record<string, TopicNode | null> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const themeIds = profile.unlockedThemes ?? [];

    void Promise.all(themeIds.map((themeId) => loadTopicHierarchy(themeId))).then((roots) => {
      if (cancelled) return;
      const map: Record<string, TopicNode | null> = {};
      themeIds.forEach((themeId, i) => {
        map[themeId] = roots[i];
      });
      setHierarchies(map);
    });

    return () => {
      cancelled = true;
    };
  }, [profile.unlockedThemes]);

  if (!hierarchies) {
    return <section className={styles.page} />;
  }

  const history = studyRepo.getAnswerHistory();
  const summary: ProgressSummary = buildProgressSummary(profile, history, hierarchies);
  const wisdomPct =
    summary.wisdom.required > 0
      ? Math.min(100, Math.round((summary.wisdom.current / summary.wisdom.required) * 100))
      : 100;

  return (
    <section className={styles.page}>
      <div className={styles.topRow}>
        <button
          type="button"
          className={styles.backBtn}
          aria-label="Назад"
          onClick={() => navigate('/profile')}
        >
          <Icon name="back" size={20} />
        </button>
      </div>

      <header className={styles.hero}>
        <h1>Прогрес</h1>
        <StreakBadge streakDays={summary.streakDays} />
      </header>

      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <Icon name="star" size={20} />
          <strong>{summary.accuracy7d}%</strong>
          <span>Точність 7д</span>
        </div>
        <div className={styles.kpiCard}>
          <Icon name="stats" size={20} />
          <strong>{summary.accuracy30d}%</strong>
          <span>Точність 30д</span>
        </div>
        <div className={styles.kpiCard}>
          <Icon name="brain" size={20} />
          <strong>{summary.masteredSubthemes}</strong>
          <span>Освоєно підтем</span>
        </div>
        <div className={styles.kpiCard}>
          <Icon name="trophy" size={20} />
          <strong>{summary.stagesPassed}</strong>
          <span>Етапів пройдено</span>
        </div>
      </div>

      <section className={styles.rankSection}>
        <h2>{summary.rankLabel}</h2>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${wisdomPct}%` }} />
        </div>
        <p className={styles.rankLabel}>
          {summary.wisdom.label}: {summary.wisdom.current}/{summary.wisdom.required}
        </p>
      </section>

      {summary.reviewDueCount > 0 && (
        <Link to={`/play/study/review-queue/${profile.activeTheme}`} className={styles.reviewCta}>
          <span aria-hidden>🔄</span>
          <span>Повторити {summary.reviewDueCount} тем</span>
          <Icon name="arrow-right" size={20} />
        </Link>
      )}
    </section>
  );
}
