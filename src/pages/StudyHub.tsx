import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { STUDY_THEME_GROUPS } from '../data/study_themes';
import styles from './StudyHub.module.css';

export function StudyHub() {
  const { profile } = usePlayer();

  const recommendation = useMemo(() => {
    let weakest = null;
    let minMastery = 101;
    for (const g of STUDY_THEME_GROUPS) {
      for (const s of g.subthemes) {
        const m = profile.studyMastery[s.id]?.mastery;
        if (m !== undefined && m < minMastery) {
          minMastery = m;
          weakest = s;
        }
      }
    }
    return weakest;
  }, [profile.studyMastery]);

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1>Навчання</h1>
        <p>Обери режим навчання на сьогодні</p>
      </header>

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
      </ul>

      {recommendation && (
        <section className={styles.recommendationBox}>
          <h3>💡 Рекомендація на сьогодні</h3>
          <p>Тобі варто повторити тему <strong>{recommendation.title}</strong>. 
          Твій рівень знань тут лише {Math.round(profile.studyMastery[recommendation.id]?.mastery ?? 0)}%.</p>
          <Link to={`/play/study/themes/${recommendation.themeId}`} className={styles.btnRec}>
            Почати практику
          </Link>
        </section>
      )}
    </section>
  );
}
