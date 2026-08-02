import { useState, useMemo, type ReactElement } from 'react';
import type { TopicNode, TopicHierarchyMap, MasteryState } from '../types';
import { flattenTopicNodes } from '../data/topicDbLoader';
import styles from './TopicMap.module.css';

interface TopicMapProps {
  topicHierarchy: TopicHierarchyMap;
  masteryStates: Record<string, MasteryState>;
  onNodeClick?: (node: TopicNode) => void;
  onNodeExpand?: (nodeId: string) => void;
  maxHeight?: string;
  showQuestionCount?: boolean;
}

type ViewMode = 'tree' | 'heatmap' | 'list';
type FilterMode = 'all' | 'weak' | 'strong' | 'incomplete';

export function TopicMap({
  topicHierarchy,
  masteryStates,
  onNodeClick,
  onNodeExpand,
  maxHeight = '600px',
  showQuestionCount = true,
}: TopicMapProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Отримуємо всі вузли плоским списком для фільтрації та пошуку
  const allNodes = useMemo(() => {
    const nodes: Array<{ node: TopicNode; depth: number }> = [];
    Object.values(topicHierarchy).forEach((rootNode) => {
      nodes.push(...flattenTopicNodes(rootNode));
    });
    return nodes;
  }, [topicHierarchy]);

  // Фільтрація за режимом фільтрації та пошуком
  const filteredNodes = useMemo(() => {
    return allNodes.filter(({ node }) => {
      const mastery = masteryStates[node.id];
      const query = searchQuery.toLowerCase();

      // Пошук за назвою
      if (query && !node.title.toLowerCase().includes(query)) {
        return false;
      }

      // Фільтрація за режимом
      switch (filterMode) {
        case 'weak':
          return mastery && mastery.mastery < 50;
        case 'strong':
          return mastery && mastery.mastery >= 80;
        case 'incomplete':
          return !mastery || mastery.totalAnswers === 0;
        default:
          return true;
      }
    });
  }, [allNodes, masteryStates, filterMode, searchQuery]);

  // Toggle розкриття вузла
  const toggleExpand = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
    onNodeExpand?.(nodeId);
  };

  // Отримання кольору mastery
  const getMasteryColor = (nodeId: string): string => {
    const mastery = masteryStates[nodeId];
    if (!mastery || mastery.totalAnswers === 0) return 'rgba(255,255,255,0.04)';
    if (mastery.mastery >= 80) return 'var(--mastery-4)';
    if (mastery.mastery >= 60) return 'var(--mastery-3)';
    if (mastery.mastery >= 40) return 'var(--mastery-2)';
    if (mastery.mastery > 0) return 'var(--mastery-1)';
    return 'rgba(255,255,255,0.04)';
  };

  // Рендеринг вузла залежно від режиму
  const renderNode = (node: TopicNode, depth: number = 0): ReactElement => {
    const mastery = masteryStates[node.id];
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const masteryColor = getMasteryColor(node.id);
    const masteryPercent = mastery ? Math.round(mastery.mastery) : 0;

    const handleClick = () => {
      if (hasChildren) {
        toggleExpand(node.id);
      }
      onNodeClick?.(node);
    };

    if (viewMode === 'tree') {
      return (
        <div key={node.id} style={{ marginLeft: `${depth * 20}px` }}>
          <div
            className={`${styles.node} ${hasChildren ? styles.nodeWithChildren : styles.nodeLeaf}`}
            onClick={handleClick}
            style={{ borderLeft: `4px solid ${masteryColor}` }}
          >
            <div className={styles.nodeHeader}>
              <span className={styles.nodeIcon}>{node.icon}</span>
              <span className={styles.nodeTitle}>{node.title}</span>
              {hasChildren && (
                <span className={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</span>
              )}
            </div>
            <div className={styles.nodeMeta}>
              {mastery && (
                <span className={styles.masteryBadge} style={{ background: masteryColor }}>
                  {masteryPercent}%
                </span>
              )}
              {showQuestionCount && node.questionCount && (
                <span className={styles.questionCount}>{node.questionCount} питань</span>
              )}
            </div>
          </div>
          {hasChildren && isExpanded && node.children.map((child) => renderNode(child, depth + 1))}
        </div>
      );
    } else if (viewMode === 'heatmap') {
      return (
        <div
          key={node.id}
          className={`${styles.heatmapCell}`}
          onClick={() => onNodeClick?.(node)}
          style={{
            background: masteryColor,
            boxShadow: masteryPercent >= 80 ? '0 0 8px var(--mastery-glow)' : 'none',
          }}
          title={`${node.title}: ${masteryPercent}%`}
        >
          <span className={styles.heatmapIcon}>{node.icon}</span>
        </div>
      );
    } else {
      // List view
      return (
        <div key={node.id} className={styles.listItem}>
          <div
            className={`${styles.listItemContent}`}
            onClick={handleClick}
            style={{ borderLeft: `4px solid ${masteryColor}` }}
          >
            <div className={styles.listItemMain}>
              <span className={styles.listItemIcon}>{node.icon}</span>
              <div className={styles.listItemText}>
                <span className={styles.listItemTitle}>{node.title}</span>
                <span className={styles.listItemDesc}>{node.description}</span>
              </div>
            </div>
            <div className={styles.listItemMeta}>
              {mastery && (
                <span className={styles.masteryBadge} style={{ background: masteryColor }}>
                  {masteryPercent}%
                </span>
              )}
              {showQuestionCount && node.questionCount && (
                <span className={styles.questionCount}>{node.questionCount} питань</span>
              )}
            </div>
          </div>
        </div>
      );
    }
  };

  // Статистика для фільтрів
  const stats = useMemo(() => {
    const weak = allNodes.filter(({ node }) => {
      const m = masteryStates[node.id];
      return m && m.mastery < 50;
    }).length;

    const strong = allNodes.filter(({ node }) => {
      const m = masteryStates[node.id];
      return m && m.mastery >= 80;
    }).length;

    const incomplete = allNodes.filter(({ node }) => {
      const m = masteryStates[node.id];
      return !m || m.totalAnswers === 0;
    }).length;

    return { total: allNodes.length, weak, strong, incomplete };
  }, [allNodes, masteryStates]);

  return (
    <div className={styles.topicMap} style={{ maxHeight }}>
      {/* Контрольна панель */}
      <div className={styles.controls}>
        <div className={styles.viewModes}>
          <button
            type="button"
            className={`${styles.viewModeBtn} ${viewMode === 'tree' ? styles.viewModeBtnActive : ''}`}
            onClick={() => setViewMode('tree')}
          >
            🌳 Дерево
          </button>
          <button
            type="button"
            className={`${styles.viewModeBtn} ${viewMode === 'heatmap' ? styles.viewModeBtnActive : ''}`}
            onClick={() => setViewMode('heatmap')}
          >
            🔥 Карта
          </button>
          <button
            type="button"
            className={`${styles.viewModeBtn} ${viewMode === 'list' ? styles.viewModeBtnActive : ''}`}
            onClick={() => setViewMode('list')}
          >
            📋 Список
          </button>
        </div>

        <div className={styles.filters}>
          <button
            type="button"
            className={`${styles.filterBtn} ${filterMode === 'all' ? styles.filterBtnActive : ''}`}
            onClick={() => setFilterMode('all')}
          >
            Всі ({stats.total})
          </button>
          <button
            type="button"
            className={`${styles.filterBtn} ${filterMode === 'weak' ? styles.filterBtnActive : ''}`}
            onClick={() => setFilterMode('weak')}
          >
            Слабкі ({stats.weak})
          </button>
          <button
            type="button"
            className={`${styles.filterBtn} ${filterMode === 'strong' ? styles.filterBtnActive : ''}`}
            onClick={() => setFilterMode('strong')}
          >
            Сильні ({stats.strong})
          </button>
          <button
            type="button"
            className={`${styles.filterBtn} ${filterMode === 'incomplete' ? styles.filterBtnActive : ''}`}
            onClick={() => setFilterMode('incomplete')}
          >
            Нові ({stats.incomplete})
          </button>
        </div>

        <input
          type="text"
          className={styles.searchInput}
          placeholder="Пошук тем..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Легенда кольорів */}
      <div className={styles.legend}>
        <span className={styles.legendItem}>Легенда:</span>
        <span className={styles.legendItem} style={{ color: 'var(--mastery-4)' }}>● 80%+</span>
        <span className={styles.legendItem} style={{ color: 'var(--mastery-3)' }}>● 60-79%</span>
        <span className={styles.legendItem} style={{ color: 'var(--mastery-2)' }}>● 40-59%</span>
        <span className={styles.legendItem} style={{ color: 'var(--mastery-1)' }}>● 1-39%</span>
        <span className={styles.legendItem} style={{ color: 'rgba(255,255,255,0.3)' }}>● Не почато</span>
      </div>

      {/* Контент */}
      <div className={styles.content} style={{ maxHeight: `calc(${maxHeight} - 120px)` }}>
        {viewMode === 'tree' ? (
          <div className={styles.treeView}>
            {Object.values(topicHierarchy).map((rootNode) => (
              <div key={rootNode.id}>
                {renderNode(rootNode)}
              </div>
            ))}
          </div>
        ) : viewMode === 'heatmap' ? (
          <div className={styles.heatmapGrid}>
            {filteredNodes.map(({ node }) => renderNode(node))}
          </div>
        ) : (
          <div className={styles.listView}>
            {filteredNodes.map(({ node }) => renderNode(node))}
          </div>
        )}

        {filteredNodes.length === 0 && (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>🔍</span>
            <p className={styles.emptyText}>Нічого не знайдено</p>
          </div>
        )}
      </div>
    </div>
  );
}