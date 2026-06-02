import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { loadAllTopicHierarchies } from '../data/topicDbLoader';
import { generateRecommendations, formatRecommendation, getRecommendationLink } from '../lib/recommendationEngine';
import type { Recommendation } from '../types';
import { MotionStagger, MotionStaggerItem } from '../components/motion';
import { useMotionEntrance } from '../hooks/useMotionEntrance';
import styles from './StudyHub.module.css';

export function StudyHub() {
  const { shouldEnter } = useMotionEntrance('study-hub');
  const { profile } = usePlayer();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllTopicHierarchies().then((hierarchies) => {
      const recs = generateRecommendations({
        profile,
        topicHierarchy: hierarchies,
      }, 3);

      setRecommendations(recs);
      setLoading(false);
    });
  }, [profile]);

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1>Навчання</h1>
        <p>Обери режим навчання на сьогодні</p>
      </header>

      {!loading && (
        <MotionStagger as="ul" className={styles.modesList} enter={shouldEnter}>
          <MotionStaggerItem as="li">
            <Link to="/play/study/themes" className={styles.card}>
              <div className={styles.icon}>📚</div>
              <div className={styles.cardInfo}>
                <h2>Practice (Практика)</h2>
                <p>Вибери тему і рівень, щоб пройти стандартний тест.</p>
              </div>
              <div className={styles.arrow}>→</div>
            </Link>
          </MotionStaggerItem>
          <MotionStaggerItem as="li">
            <Link to="/play/study/review" className={styles.card}>
              <div className={styles.icon}>🧠</div>
              <div className={styles.cardInfo}>
                <h2>Робота над помилками</h2>
                <p>Повтори питання, в яких ти раніше робив помилки (всі одразу).</p>
              </div>
              <div className={styles.arrow}>→</div>
            </Link>
          </MotionStaggerItem>
        </MotionStagger>
      )}

      {!loading && recommendations.length > 0 && (
        <section className={styles.recommendationBox}>
          <h3>💡 Рекомендації на сьогодні</h3>
          <div className={styles.recommendationsList}>
            {recommendations.map((rec) => {
              const formatted = formatRecommendation(rec);
              return (
                <div key={rec.id} className={styles.recommendationItem}>
                  <span className={styles.recIcon}>{formatted.icon}</span>
                  <div className={styles.recContent}>
                    <h4>{formatted.title}</h4>
                    <p>{formatted.description}</p>
                    <small className={styles.recReason}>{formatted.subtitle}</small>
                  </div>
                  <Link
                    to={getRecommendationLink(rec)}
                    className={styles.btnRec}
                  >
                    Почати
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </section>
  );
}
