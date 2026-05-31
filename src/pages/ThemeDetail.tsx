import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { getThemeById } from '../data/themes';
import { getQuestionCountByDifficulty, getQuestionCountByDifficultyAsync, getQuestionCountByCategoryAsync } from '../data/questions';
import { CATEGORIES } from '../data/categories';
import { usePlayer } from '../context/PlayerContext';
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  DIFFICULTY_ORDER,
  DIFFICULTY_POINTS,
} from '../types';
import type { Difficulty, TopicNode } from '../types';
import { Icon } from '../components/Icon';
import { loadTopicHierarchy, loadAllTopicHierarchies, findNodeById, findParentNode } from '../data/topicDbLoader';
import styles from './ThemeDetail.module.css';

export function ThemeDetail() {
  const { themeId, nodeId: urlNodeId } = useParams<{ themeId: string; nodeId?: string }>();
  const navigate = useNavigate();
  const theme = getThemeById(themeId ?? '');
  const { profile } = usePlayer();

  const themePoints = profile.themePoints[theme?.id ?? ''] ?? 0;
  const [loading, setLoading] = useState(true);
  const [questionCounts, setQuestionCounts] = useState<Partial<Record<Difficulty, number>>>({});
  const [topicHierarchy, setTopicHierarchy] = useState<TopicNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<TopicNode | null>(null);
  const [isAggregate, setIsAggregate] = useState(false);
  const [aggregateThemeIds, setAggregateThemeIds] = useState<string[]>([]);
  const [showHierarchy, setShowHierarchy] = useState(!urlNodeId);

  // Визначаємо, чи це агрегатний вузол "Всі питання"
  const loadAggregateCounts = async (themeIds: string[]) => {
    const entries = await Promise.all(
      DIFFICULTIES.map(async (diff) => {
        const count = await getQuestionCountByCategoryAsync(themeIds, diff);
        return [diff, count] as const;
      }),
    );
    setQuestionCounts(Object.fromEntries(entries));
  };

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      // Спочатку завантажуємо ієрархію (групи)
      const hierarchies = await loadAllTopicHierarchies();
      if (cancelled) return;

      // Шукаємо вузол в ієрархіях груп
      const allNodes: TopicNode[] = [];
      for (const h of Object.values(hierarchies)) {
        const findNode = (node: TopicNode, targetId: string): TopicNode | null => {
          if (node.id === targetId) return node;
          if (node.children) {
            for (const child of node.children) {
              const found = findNode(child, targetId);
              if (found) return found;
            }
          }
          return null;
        };
        const found = urlNodeId ? findNode(h, urlNodeId) : null;
        if (found) {
          allNodes.push(found);
        }
      }

      // Якщо знайшли агрегатний вузол
      const aggNode = allNodes.find((n) => n.aggregateThemeIds && n.aggregateThemeIds.length > 0);
      if (aggNode) {
        setIsAggregate(true);
        setSelectedNode(aggNode);
        setAggregateThemeIds(aggNode.aggregateThemeIds ?? []);
        if (!cancelled) {
          await loadAggregateCounts(aggNode.aggregateThemeIds!);
        }
        if (!cancelled) setLoading(false);
        return;
      }

      // Інакше — завантажуємо звичайну тему
      const tid = themeId ?? '';
      if (tid) {
        const hierarchy = await loadTopicHierarchy(tid);
        if (!cancelled && hierarchy) {
          setTopicHierarchy(hierarchy);

          if (urlNodeId) {
            const node = findNodeById(hierarchy, urlNodeId);
            if (node && !node.aggregateThemeIds?.length) {
              setSelectedNode(node);
              setShowHierarchy(false);
            }
          }
        }

        const entries = await Promise.all(
          DIFFICULTIES.map(async (diff) => {
            const count = await getQuestionCountByDifficultyAsync(tid, diff);
            return [diff, count] as const;
          }),
        );
        if (!cancelled) {
          setQuestionCounts(Object.fromEntries(entries));
        }
      }
      if (!cancelled) setLoading(false);
    };

    init();

    return () => {
      cancelled = true;
    };
  }, [themeId, urlNodeId]);

  if (loading) {
    return (
      <section className={styles.page}>
        <p>Завантаження...</p>
      </section>
    );
  }

  if (!theme && !isAggregate) {
    return (
      <section className={styles.page}>
        <p>Тематику не знайдено.</p>
        <Link to="/play/study">← Назад до тем</Link>
      </section>
    );
  }

  const sortedDifficulties = [...DIFFICULTIES].sort(
    (a, b) => DIFFICULTY_ORDER[a] - DIFFICULTY_ORDER[b],
  );

  // Для агрегатного вузла використовуємо themeId групи
  const effectiveThemeId = isAggregate
    ? themeId ?? (aggregateThemeIds.length > 0 ? aggregateThemeIds[0] : '')
    : (theme?.id ?? '');

  const effectiveNodeId = selectedNode?.id;

  const handleBack = () => {
    if (isAggregate) {
      navigate('/play/study/themes');
      return;
    }

    const currentId = selectedNode?.id ?? urlNodeId;
    if (!currentId || !topicHierarchy || currentId === topicHierarchy.id) {
      navigate(`/play/study/themes?at=${themeId}`);
      return;
    }

    const parent = findParentNode(topicHierarchy, currentId);
    if (parent) {
      navigate(`/play/study/themes?at=${parent.id}`);
      return;
    }

    navigate('/play/study/themes');
  };

  const handleSelectNode = (id: string | null) => {
    if (!topicHierarchy) return;

    if (!id) {
      navigate(`/play/study/themes/${themeId}`);
      setSelectedNode(null);
      return;
    }

    const foundNode = findNodeById(topicHierarchy, id);
    if (!foundNode) return;

    if (foundNode.id === topicHierarchy.id) {
      navigate(`/play/study/themes/${themeId}`);
      setSelectedNode(null);
    } else {
      navigate(`/play/study/themes/${themeId}/${id}`);
      setSelectedNode(foundNode);
      setShowHierarchy(false);
    }
  };

  return (
    <section className={styles.page}>
      <div className={styles.topRow}>
        <button type="button" className={styles.backBtn} aria-label="Назад" onClick={handleBack}>
          <Icon name="back" size={20} />
        </button>
      </div>

      <header className={styles.hero}>
        <span className={styles.icon}>{selectedNode ? selectedNode.icon : theme?.icon}</span>
        <h1>{selectedNode ? selectedNode.title : theme?.title}</h1>
        <p>{selectedNode ? selectedNode.description : theme?.description}</p>
        <div className={styles.heroChips}>
          <span className={styles.heroChip}>
            {selectedNode ? selectedNode.title : theme?.title}
          </span>
          {themePoints > 0 && (
            <span className={styles.heroChipPoints}>
              <Icon name="star" size={12} /> {themePoints} очок
            </span>
          )}
        </div>
      </header>

      {!isAggregate && topicHierarchy && (
        <div className={styles.hierarchySection}>
          <button
            type="button"
            className={styles.hierarchyToggle}
            onClick={() => setShowHierarchy(!showHierarchy)}
          >
            <Icon name="back" size={16} style={{ transform: showHierarchy ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
            {showHierarchy ? 'Сховати деталі' : 'Показати деталі теми'}
          </button>

          {showHierarchy && (
            <div className={styles.hierarchyTree}>
              <HierarchyTree
                node={topicHierarchy}
                selectedNodeId={selectedNode?.id ?? null}
                onSelectNode={handleSelectNode}
                masteryStates={profile.studyMastery}
              />
            </div>
          )}
        </div>
      )}

      <h2 className={styles.subtitle}>
        Обери рівень складності{selectedNode && !isAggregate ? ` для ${selectedNode.title}` : ''}
      </h2>

      <ul className={styles.levels}>
        {sortedDifficulties.map((diff) => {
          const done = isAggregate
            ? false
            : profile.completedLevels.some(
                (l) => l.themeId === theme?.id && l.difficulty === diff,
              );
          const completedLevel = isAggregate
            ? null
            : profile.completedLevels.find(
                (l) => l.themeId === theme?.id && l.difficulty === diff,
              );
          const availableQuestions = questionCounts[diff] ?? 0;
          const diffIndex = DIFFICULTY_ORDER[diff];
          const emojis = ['👶', '🧒', '🧑', '🎓', '📖', '👨‍🏫', '⛪'];
          const points = DIFFICULTY_POINTS[diff];

          // Формуємо URL
          let toPath: string;
          if (isAggregate && effectiveNodeId) {
            toPath = `/play/study/quiz/${effectiveThemeId}/${diff}/${effectiveNodeId}`;
          } else if (effectiveNodeId) {
            toPath = `/play/study/quiz/${effectiveThemeId}/${diff}/${effectiveNodeId}`;
          } else {
            toPath = `/play/study/quiz/${effectiveThemeId}/${diff}`;
          }

          return (
            <li key={diff}>
              <Link
                to={toPath}
                className={`${styles.level} ${done ? styles.levelDone : ''} ${availableQuestions === 0 ? styles.levelDisabled : ''}`}
                style={{ pointerEvents: availableQuestions === 0 ? 'none' : 'auto' }}
              >
                <div className={styles.levelTop}>
                  <div className={styles.levelInfo}>
                    <span className={styles.levelEmoji}>{emojis[diffIndex]}</span>
                    <div>
                      <span className={styles.levelLabel}>{DIFFICULTY_LABELS[diff]}</span>
                      <span className={styles.levelMeta}>
                        {availableQuestions} питань · {points} очок
                      </span>
                    </div>
                  </div>
                  <span
                    className={`${styles.levelStatus} ${done ? styles.levelStatusDone : styles.levelStatusNew}`}
                  >
                    {done ? '✅' : availableQuestions === 0 ? 'Немає питань' : 'Почати'}
                  </span>
                </div>

                {done && !isAggregate && (
                  <div className={styles.progressArea}>
                    <div className={styles.progressRow}>
                      <span className={styles.progressLabel}>Результат</span>
                      <span className={styles.progressValue}>
                        {completedLevel?.score ?? 0}/{completedLevel?.maxScore ?? 0}
                      </span>
                    </div>
                    <div className={styles.progressBar} role="progressbar" aria-valuenow={completedLevel ? (completedLevel.score / completedLevel.maxScore) * 100 : 0}>
                      <span style={{ width: `${completedLevel ? (completedLevel.score / completedLevel.maxScore) * 100 : 0}%` }} />
                    </div>
                  </div>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function getAllNodes(node: TopicNode, depth = 0): Array<{ node: TopicNode; depth: number }> {
  const result: Array<{ node: TopicNode; depth: number }> = [{ node, depth }];
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      result.push(...getAllNodes(child, depth + 1));
    }
  }
  return result;
}

function HierarchyTree({
  node,
  selectedNodeId,
  onSelectNode,
  masteryStates
}: {
  node: TopicNode;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  masteryStates: Record<string, any>;
}) {
  const allNodes = getAllNodes(node, 0);

  return (
    <div className={styles.hierarchyTree}>
      {allNodes.map(({ node: currentNode, depth }) => {
        // Пропускаємо агрегатні вузли в ієрархії
        if (currentNode.aggregateThemeIds) return null;
        const mastery = masteryStates[currentNode.id]?.mastery ?? 0;
        const isSelected = selectedNodeId === currentNode.id;
        const hasChildren = currentNode.children && currentNode.children.length > 0;

        return (
          <div key={currentNode.id} className={styles.hierarchyNode} style={{ marginLeft: `${depth * 16}px` }}>
            <button
              type="button"
              className={`${styles.hierarchyNodeBtn} ${isSelected ? styles.hierarchyNodeSelected : ''}`}
              onClick={() => onSelectNode(isSelected ? null : currentNode.id)}
              style={{ borderLeft: `3px solid ${mastery >= 80 ? '#39d353' : mastery >= 60 ? '#26a641' : mastery >= 40 ? '#006d32' : mastery > 0 ? '#0e4429' : 'rgba(255,255,255,0.2)'}` }}
            >
              <span className={styles.hierarchyNodeIcon}>{currentNode.icon}</span>
              <span className={styles.hierarchyNodeTitle}>{currentNode.title}</span>
              {hasChildren && (
                <span className={styles.hierarchyExpandIcon}>▶</span>
              )}
              <span className={styles.hierarchyMastery}>{Math.round(mastery)}%</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
