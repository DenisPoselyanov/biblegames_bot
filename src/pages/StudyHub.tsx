import { Link } from 'react-router-dom';
import { useMemo, useState, useEffect } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { loadAllTopicHierarchies } from '../data/topicDbLoader';
import { generateRecommendations, formatRecommendation } from '../lib/recommendationEngine';
import type { Recommendation, TopicHierarchyMap } from '../types';
import styles from './StudyHub.module.css';

export function StudyHub() {
  const { profile } = usePlayer();
  const [topicHierarchies, setTopicHierarchies] = useState<TopicHierarchyMap>({});
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  // Завантаження ієрархій тем та генерація рекомендацій
  useEffect(() => {
    loadAllTopicHierarchies().then((hierarchies) => {
      setTopicHierarchies(hierarchies);
      
      // Генерація рекомендацій
      const recs = generateRecommendations({
        profile,
        topicHierarchy: hierarchies,
      }, 3);
      
      setRecommendations(recs);
      setLoading(false);
    });
  }, [profile]);

  const recommendation = recommendations[0]; // Головна рекомендація

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1>Навчання</h1>
        <p>Обери режим навчання на сьогодні</p>
      </header>

      {!loading && (
        <ul className={styles.modesList}>
          <li>
            <Link to="/play/study/themes" className={styles.card}>
              <div className={styles.icon}>📚</div>
              <div className={styles.cardInfo}>
                <h2>Practice (Практика)</h2>
                <p>Вибери тему і рівень, щоб пройти стандартний тест.</p>
              </div>
              <div className={styles.arrow}>→</div>
            </Link>
          </li>
          <li>
            <Link to="/play/study/review" className={styles.card}>
              <div className={styles.icon}>🧠</div>
              <div className={styles.cardInfo}>
                <h2>Review Mistakes</h2>
                <p>Повтори питання, в яких ти раніше робив помилки (всі одразу).</p>
              </div>
              <div className={styles.arrow}>→</div>
            </Link>
          </li>
          <li>
            <Link to="/play/study/sprint" className={styles.card}>
              <div className={styles.icon}>⏱️</div>
              <div className={styles.cardInfo}>
                <h2>Sprint (5 хв)</h2>
                <p>Відповідай на максимальну кількість питань за 5 хвилин.</p>
              </div>
              <div className={styles.arrow}>→</div>
            </Link>
          </li>
          <li>
            <Link to="/play/study/adaptive" className={styles.card}>
              <div className={styles.icon}>🤖</div>
              <div className={styles.cardInfo}>
                <h2>Adaptive Test</h2>
                <p>Інтелектуальний тест, який адаптується під твій рівень знань.</p>
              </div>
              <div className={styles.arrow}>→</div>
            </Link>
          </li>
          <li>
            <Link to="/play/study/micro" className={styles.card}>
              <div className={styles.icon}>⚡</div>
              <div className={styles.cardInfo}>
                <h2>Micro Training</h2>
                <p>Виберіть мікротему для короткої сфокусованої сесії.</p>
              </div>
              <div className={styles.arrow}>→</div>
            </Link>
          </li>
        </ul>
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
                    to={rec.nodeId ? `/play/study/themes/${rec.nodeId}` : '/play/study'} 
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
