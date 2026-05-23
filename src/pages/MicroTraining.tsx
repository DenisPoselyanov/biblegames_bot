import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import { loadAllTopicHierarchies, flattenTopicNodes } from '../data/topicDbLoader';
import type { TopicNode, TopicHierarchyMap } from '../types';
import { Icon } from '../components/Icon';
import { haptic } from '../lib/telegram';
import styles from './MicroTraining.module.css';

export function MicroTraining() {
  const navigate = useNavigate();
  const { profile } = usePlayer();
  const [topicHierarchies, setTopicHierarchies] = useState<TopicHierarchyMap>({});
  const [loading, setLoading] = useState(true);
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'weak' | 'quick'>('quick');

  useEffect(() => {
    loadAllTopicHierarchies().then((hierarchies) => {
      setTopicHierarchies(hierarchies);
      setLoading(false);
    });
  }, []);

  // Отримуємо всі вузли-листи (без дочірніх вузлів)
  const microNodes = useMemo(() => {
    const nodes: Array<{ node: TopicNode; themeId: string }> = [];
    
    Object.entries(topicHierarchies).forEach(([themeId, rootNode]) => {
      const flatNodes = flattenTopicNodes(rootNode);
      flatNodes.forEach(({ node }) => {
        // Вузли без дітей - кандидати для мікротренування (виключаємо агрегатні "всі питання")
        if ((!node.children || node.children.length === 0) && node.themeId && !node.aggregateThemeIds) {
          nodes.push({ node, themeId });
        }
      });
    });

    return nodes;
  }, [topicHierarchies]);

  // Фільтрація вузлів
  const filteredNodes = useMemo(() => {
    return microNodes.filter(({ node }) => {
      const mastery = profile.studyMastery[node.id]?.mastery ?? 0;
      
      switch (filterMode) {
        case 'weak':
          return mastery < 60 && mastery > 0; // Слабкі місця, але вже початі
        case 'quick':
          return mastery >= 0 && mastery <= 80; // Швидкі для покращення
        default:
          return true;
      }
    });
  }, [microNodes, profile.studyMastery, filterMode]);

  const handleStartMicroTraining = (node: TopicNode, themeId: string) => {
    haptic.impact('light');
    navigate(`/play/study/micro/${themeId}/${node.id}`);
  };

  const handleThemeChange = (themeId: string | null) => {
    setSelectedThemeId(themeId);
  };

  if (loading) {
    return (
      <section className={styles.page}>
        <p className={styles.loading}>Завантаження мікротем...</p>
      </section>
    );
  }

  const filteredByTheme = selectedThemeId 
    ? filteredNodes.filter(({ themeId }) => themeId === selectedThemeId)
    : filteredNodes;

  return (
    <section className={styles.page}>
      <div className={styles.topRow}>
        <Link to="/play/study" className={styles.backBtn} aria-label="Назад">
          <Icon name="back" size={20} />
        </Link>
        <div className={styles.topChips}>
          <span className={styles.chip}>⚡ Мікротренування</span>
        </div>
      </div>

      <header className={styles.header}>
        <h1>Мікротренування</h1>
        <p>Короткі сфокусовані сесії по конкретних темах</p>
      </header>

      {/* Фільтри */}
      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Статус:</span>
          <button
            type="button"
            className={`${styles.filterBtn} ${filterMode === 'quick' ? styles.filterBtnActive : ''}`}
            onClick={() => setFilterMode('quick')}
          >
            Швидкі (до 80%)
          </button>
          <button
            type="button"
            className={`${styles.filterBtn} ${filterMode === 'weak' ? styles.filterBtnActive : ''}`}
            onClick={() => setFilterMode('weak')}
          >
            Слабкі місця
          </button>
          <button
            type="button"
            className={`${styles.filterBtn} ${filterMode === 'all' ? styles.filterBtnActive : ''}`}
            onClick={() => setFilterMode('all')}
          >
            Всі
          </button>
        </div>

        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Тема:</span>
          <select
            className={styles.themeSelect}
            value={selectedThemeId ?? ''}
            onChange={(e) => handleThemeChange(e.target.value || null)}
          >
            <option value="">Всі теми</option>
            {Object.keys(topicHierarchies).map((themeId) => (
              <option key={themeId} value={themeId}>{themeId}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Список мікротем */}
      <div className={styles.nodesGrid}>
        {filteredByTheme.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>🔍</span>
            <p className={styles.emptyText}>Не знайдено мікротем за вибраними фільтрами</p>
          </div>
        ) : (
          filteredByTheme.map(({ node, themeId }) => {
            const mastery = profile.studyMastery[node.id]?.mastery ?? 0;
            const totalAnswers = profile.studyMastery[node.id]?.totalAnswers ?? 0;
            
            return (
              <div key={node.id} className={styles.nodeCard}>
                <div className={styles.nodeHeader}>
                  <span className={styles.nodeIcon}>{node.icon}</span>
                  <span className={styles.nodeTitle}>{node.title}</span>
                  <div 
                    className={styles.masteryBadge}
                    style={{ 
                      background: mastery >= 80 ? '#39d353' : mastery >= 60 ? '#26a641' : mastery >= 40 ? '#006d32' : mastery > 0 ? '#0e4429' : 'rgba(255,255,255,0.1)',
                      color: mastery > 40 ? 'white' : 'var(--text-dim)'
                    }}
                  >
                    {Math.round(mastery)}%
                  </div>
                </div>
                
                <p className={styles.nodeDesc}>{node.description}</p>
                
                <div className={styles.nodeMeta}>
                  <span className={styles.metaItem}>📝 {totalAnswers} відповідей</span>
                </div>

                <button
                  type="button"
                  className={styles.startBtn}
                  onClick={() => handleStartMicroTraining(node, themeId)}
                >
                  ⚡ Почати (3 хв)
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Інформація про мікротренування */}
      <div className={styles.infoBox}>
        <h3>💡 Про мікротренування</h3>
        <p>Короткі сесії по 5-8 питань фокусуються на конкретних темах для швидкого покращення знань. Ідеально підходить для:</p>
        <ul>
          <li>Заповнення прогалин у знаннях</li>
          <li>Швидкого повторення перед важливими подіями</li>
          <li>Підтримки матеріалу, який почав забуватися</li>
        </ul>
      </div>
    </section>
  );
}