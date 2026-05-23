import { useMemo, useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { trackEvent } from '../lib/telemetry';
import { Icon } from '../components/Icon';
import { loadAllTopicHierarchies } from '../data/topicDbLoader';
import type { TopicNode } from '../types';
import styles from './Themes.module.css';

export function Themes() {
  const navigate = useNavigate();
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [nodeHistory, setNodeHistory] = useState<string[]>([]);
  const [topicHierarchies, setTopicHierarchies] = useState<Record<string, TopicNode>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllTopicHierarchies().then((hierarchies) => {
      setTopicHierarchies(hierarchies);
      setLoading(false);
    }).catch((error) => {
      console.error('Themes.tsx: Error loading hierarchies:', error);
      setLoading(false);
    });
  }, []);

  const activeNode = useMemo(
    () => (activeNodeId ? (findNodeInHierarchies(topicHierarchies, activeNodeId) ?? null) : null),
    [activeNodeId, topicHierarchies],
  );

  const children = useMemo(() => {
    if (!activeNode) return [];
    return activeNode.children ?? [];
  }, [activeNode]);

  const handleOpenGroup = useCallback((nextNodeId: string) => {
    setNodeHistory([]);
    setActiveNodeId(nextNodeId);
    trackEvent('study_path_advanced', { groupId: nextNodeId, step: 'open-group' });
  }, []);

  const handleNodeClick = useCallback((node: TopicNode) => {
    if (node.aggregateThemeIds) {
      navigate(`/play/study/themes/${activeNodeId}/${node.id}`);
      return;
    }
    if (node.children && node.children.length > 0) {
      setNodeHistory((prev) => [...prev, activeNodeId!]);
      setActiveNodeId(node.id);
      return;
    }
    // Листовий вузол — переходимо в ThemeDetail
    const targetThemeId = node.themeId ?? node.id;
    navigate(`/play/study/themes/${targetThemeId}`);
  }, [activeNodeId, navigate]);

  const handleBack = useCallback(() => {
    if (nodeHistory.length > 0) {
      const prev = nodeHistory[nodeHistory.length - 1];
      setNodeHistory((prev) => prev.slice(0, -1));
      setActiveNodeId(prev);
    } else {
      setActiveNodeId(null);
    }
  }, [nodeHistory]);

  return (
    <section className={styles.page}>
      <div className={styles.topRow}>
        <Link to="/play/study" className={styles.backBtn} aria-label="Назад">
          <Icon name="back" size={20} />
        </Link>
        <div className={styles.topChips}>
          <span className={styles.chip}>📖 Дослідження</span>
        </div>
      </div>

      <header className={styles.header}>
        <h1>{!activeNode ? 'Обери тематику' : activeNode.title}</h1>
        <p>{!activeNode ? 'Оберіть Завіт, а потім заглиблюйтесь у теми' : activeNode.description}</p>
      </header>

      {loading ? (
        <p className={styles.loading}>Завантаження тем...</p>
      ) : !activeNode ? (
        <ul className={styles.grid}>
          {['old-testament', 'new-testament'].map((gid) => {
            const rootNode = topicHierarchies[gid];
            if (!rootNode) return null;
            return (
              <li key={rootNode.id}>
                <button type="button" className={styles.groupCard} onClick={() => handleOpenGroup(rootNode.id)}>
                  <span className={styles.groupIcon}>{rootNode.icon}</span>
                  <div className={styles.groupBody}>
                    <span className={styles.groupTitle}>{rootNode.title}</span>
                    <span className={styles.groupDesc}>{rootNode.description}</span>
                    <span className={styles.groupMeta}>
                      {rootNode.children?.filter((c) => !c.aggregateThemeIds).length ?? 0} тем
                    </span>
                  </div>
                  <span className={styles.groupArrow}>→</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <>
          <div className={styles.groupHeader}>
            <button type="button" className={styles.backToGroups} onClick={handleBack}>
              <Icon name="back" size={16} />
              {nodeHistory.length > 0 ? 'Назад' : 'До загальних тем'}
            </button>
          </div>
          <ul className={styles.grid}>
            {children.flatMap((node, idx) => {
              const hasChildren = node.children && node.children.length > 0;
              const isAllQuestions = !!node.aggregateThemeIds;
              const showDivider = isAllQuestions && idx === 0 && children.length > 1;
              return [
                <li key={node.id}>
                  <button
                    type="button"
                    className={styles.subThemeCard}
                    onClick={() => handleNodeClick(node)}
                    style={{ '--accent': isAllQuestions ? '#a67c00' : '#4a7c59' } as React.CSSProperties}
                  >
                    <div className={styles.cardLeft}>
                      <div className={styles.cardLeftContent}>
                        <h3>{node.title}</h3>
                        <p>{node.description}</p>
                        <div className={styles.cardMeta}>
                          {hasChildren && !isAllQuestions && (
                            <span className={styles.qCount}>
                              {node.children!.length} підтем
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div
                      className={styles.cardRight}
                      style={{ background: isAllQuestions ? '#a67c00' : '#4a7c59' }}
                    >
                      <span className={styles.cardIcon}>{node.icon}</span>
                    </div>
                  </button>
                </li>,
                ...(showDivider ? [<div key={`div-${node.id}`} className={styles.divider} />] : []),
              ];
            })}
          </ul>
        </>
      )}
    </section>
  );
}

function findNodeInHierarchies(
  hierarchies: Record<string, TopicNode>,
  targetId: string,
): TopicNode | undefined {
  for (const node of Object.values(hierarchies)) {
    const found = findNodeRecursive(node, targetId);
    if (found) return found;
  }
  return undefined;
}

function findNodeRecursive(node: TopicNode, targetId: string): TopicNode | undefined {
  if (node.id === targetId) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findNodeRecursive(child, targetId);
      if (found) return found;
    }
  }
  return undefined;
}
