import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { loadTopicHierarchy } from '../data/topicDbLoader';
import { usePlayer } from '../context/PlayerContext';
import { buildReviewQueue } from '../lib/reviewScheduler';
import type { ReviewQueueItem, TopicNode } from '../types';
import { Icon } from '../components/Icon';
import styles from './ReviewQueue.module.css';

export function ReviewQueue() {
  const { themeId } = useParams<{ themeId: string }>();
  const navigate = useNavigate();
  const { profile } = usePlayer();
  const [hierarchy, setHierarchy] = useState<TopicNode | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      if (!themeId) {
        if (!cancelled) setLoading(false);
        return;
      }
      const root = await loadTopicHierarchy(themeId);
      if (cancelled) return;
      setHierarchy(root);
      setLoading(false);
    };

    init();

    return () => {
      cancelled = true;
    };
  }, [themeId]);

  if (loading) {
    return <section className={styles.page} />;
  }

  if (!hierarchy || !themeId) {
    return (
      <section className={styles.page}>
        <p>Тему не знайдено.</p>
        <Link to="/play/study/themes">← Назад до тем</Link>
      </section>
    );
  }

  const items: ReviewQueueItem[] = buildReviewQueue(profile, hierarchy, themeId);

  return (
    <section className={styles.page}>
      <div className={styles.topRow}>
        <button
          type="button"
          className={styles.backBtn}
          aria-label="Назад"
          onClick={() => navigate(`/play/study/themes/${themeId}`)}
        >
          <Icon name="back" size={20} />
        </button>
      </div>

      <header className={styles.hero}>
        <h1>Повторення</h1>
        <p className={styles.subtitle}>
          {items.length > 0
            ? `Готово до повторення: ${items.length}`
            : 'Немає елементів для повторення'}
        </p>
      </header>

      {items.length > 0 && (
        <ol className={styles.list}>
          {items.map((item) => (
            <li key={item.learningObjectiveId}>
              <Link to={item.practicePath} className={styles.item}>
                <span className={styles.icon}>{item.icon}</span>
                <span className={styles.itemBody}>
                  <span className={styles.itemTitle}>{item.title}</span>
                  <span className={styles.itemMeta}>
                    {item.overdueDays > 0
                      ? `Прострочено на ${item.overdueDays} дн.`
                      : 'Час повторити'}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
