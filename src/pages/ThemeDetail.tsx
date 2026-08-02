import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { getThemeById } from '../data/themes';
import {
  fetchQuestionCountByCategory,
  fetchQuestionCountByDifficulty,
  fetchQuestionCountForNode,
  fetchQuestionCounts,
} from '../repos/questionsRepo';
import { usePlayer } from '../context/PlayerContext';
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  DIFFICULTY_ORDER,
} from '../types';
import type { Difficulty, PracticeTrackProgress, TopicNode } from '../types';
import { Icon } from '../components/Icon';
import { InfoTooltip } from '../components/InfoTooltip';
import { STAGE_POINTS_TOOLTIP, THEME_POINTS_TOOLTIP } from '../lib/practiceScoringHelp';
import { PracticeStageStepper } from '../components/PracticeStageStepper';
import { ThemeDetailSkeleton } from '../components/skeletons';
import { MotionStagger, MotionStaggerItem } from '../components/motion';
import { useMotionEntrance } from '../hooks/useMotionEntrance';
import { loadTopicHierarchy, loadAllTopicHierarchies, findNodeById, findParentNode } from '../data/topicDbLoader';
import {
  canPlayDifficulty,
  computeNodePracticeProgressPercent,
  countPassedStages,
  findPracticeTrack,
  getDifficultyUnlockRankLabel,
  getDifficultyUnlockRequirement,
  getStageQuizPath,
  getPracticeStageCount,
} from '../lib/practiceProgression';
import { PracticeNodeStageEditor } from '../components/PracticeNodeStageEditor';
import { usePracticeNodeOverridesStore } from '../stores/practiceNodeOverridesStore';
import styles from './ThemeDetail.module.css';

export function ThemeDetail() {
  const { shouldEnter } = useMotionEntrance('theme-detail');
  const { themeId, nodeId: urlNodeId } = useParams<{ themeId: string; nodeId?: string }>();
  const navigate = useNavigate();
  const theme = getThemeById(themeId ?? '');
  const { profile } = usePlayer();
  const nodeStageOverrides = usePracticeNodeOverridesStore((s) => s.overrides);
  void nodeStageOverrides;

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
    const batch = await fetchQuestionCounts({ themeIds });
    if (batch) {
      setQuestionCounts(batch);
      return;
    }
    const entries = await Promise.all(
      DIFFICULTIES.map(async (diff) => {
        const count = await fetchQuestionCountByCategory(themeIds, diff);
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
        let hierarchy: TopicNode | null = null;
        hierarchy = await loadTopicHierarchy(tid);
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

        const batch = await fetchQuestionCounts({
          themeId: tid,
          topicNodeId: urlNodeId || undefined,
        });
        if (batch && !cancelled) {
          setQuestionCounts(batch);
        } else {
          const entries = await Promise.all(
            DIFFICULTIES.map(async (diff) => {
              const count =
                urlNodeId && hierarchy
                  ? await fetchQuestionCountForNode(urlNodeId, hierarchy, diff, tid)
                  : await fetchQuestionCountByDifficulty(tid, diff);
              return [diff, count] as const;
            }),
          );
          if (!cancelled) {
            setQuestionCounts(Object.fromEntries(entries));
          }
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
        <ThemeDetailSkeleton />
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

  const effectiveNodeId = selectedNode?.id ?? urlNodeId ?? null;
  const trackNodeId = isAggregate ? (selectedNode?.id ?? urlNodeId ?? null) : effectiveNodeId;
  const parentBranchChips =
    selectedNode && topicHierarchy
      ? (findNodePath(topicHierarchy, selectedNode.id) ?? [])
          .slice(0, -1)
          .map((node) => node.title)
      : [];

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

  const isSubtopicPage =
    !isAggregate &&
    Boolean(trackNodeId) &&
    Boolean(topicHierarchy) &&
    trackNodeId !== topicHierarchy?.id;

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
          {parentBranchChips.map((title) => (
            <span key={title} className={styles.heroChip}>
              {title}
            </span>
          ))}
          {!isAggregate && (
            <span className={styles.heroChipPoints}>
              <Icon name="star" size={12} /> {themePoints} монет теми
              <InfoTooltip label="Як рахуються монети теми" text={THEME_POINTS_TOOLTIP} />
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
            <motion.span
              animate={{ rotate: showHierarchy ? 90 : 0 }}
              transition={{ duration: 0.2 }}
              style={{ display: 'inline-flex' }}
            >
              <Icon name="back" size={16} />
            </motion.span>
            {showHierarchy ? 'Сховати деталі' : 'Показати деталі теми'}
          </button>

          {showHierarchy && (
            <div className={styles.hierarchyTree}>
              <HierarchyTree
                node={topicHierarchy}
                themeId={theme?.id ?? ''}
                practiceTracks={profile.practiceTracks ?? []}
                selectedNodeId={selectedNode?.id ?? null}
                onSelectNode={handleSelectNode}
              />
            </div>
          )}
        </div>
      )}

      <h2 className={styles.subtitle}>
        <span>
          Обери рівень складності{selectedNode && !isAggregate ? ` для ${selectedNode.title}` : ''}
        </span>
        {!isAggregate && (
          <InfoTooltip label="Як рахуються монети за етап" text={STAGE_POINTS_TOOLTIP} />
        )}
      </h2>

      {isSubtopicPage && trackNodeId && selectedNode && (
        <PracticeNodeStageEditor
          nodeId={trackNodeId}
          nodeTitle={selectedNode.title}
          hierarchyRoot={topicHierarchy}
        />
      )}

      <MotionStagger as="ul" className={styles.levels} enter={shouldEnter}>
        {sortedDifficulties.map((diff) => {
          const availableQuestions = questionCounts[diff] ?? 0;
          const diffIndex = DIFFICULTY_ORDER[diff];
          const emojis = ['👶', '🧒', '🧑', '🎓', '📖', '👨‍🏫', '⛪'];
          const stageCount = getPracticeStageCount(trackNodeId, diff, {
            hierarchyRoot: topicHierarchy,
          });
          const difficultyUnlocked = canPlayDifficulty(profile.playerRank, diff);
          const track = findPracticeTrack(
            profile.practiceTracks ?? [],
            effectiveThemeId,
            trackNodeId,
            diff,
          );
          const passedStages = track ? countPassedStages(track) : 0;
          const progressPct = stageCount > 0 ? Math.round((passedStages / stageCount) * 100) : 0;
          const unlockHint = getDifficultyUnlockRequirement(diff);
          const unlockRankLabel = getDifficultyUnlockRankLabel(diff);
          const nextStageIndex =
            passedStages === stageCount ? 0 : (track?.highestUnlockedStage ?? 0);
          const nextStagePath = difficultyUnlocked && availableQuestions > 0
            ? getStageQuizPath(effectiveThemeId, diff, nextStageIndex, trackNodeId)
            : null;

          return (
            <MotionStaggerItem as="li" key={diff}>
              <div
                className={`${styles.level} ${passedStages === stageCount ? styles.levelDone : ''} ${!difficultyUnlocked || availableQuestions === 0 ? styles.levelLocked : ''}`}
              >
                <div className={styles.levelTop}>
                  <div className={styles.levelInfo}>
                    <span className={styles.levelEmoji}>{emojis[diffIndex]}</span>
                    <div>
                      <span className={styles.levelLabel}>
                        {!difficultyUnlocked && '🔒 '}
                        {DIFFICULTY_LABELS[diff]}
                      </span>
                      <span className={styles.levelMeta}>
                        {stageCount} етапів · {availableQuestions} питань
                      </span>
                    </div>
                  </div>
                  {difficultyUnlocked && nextStagePath && availableQuestions > 0 ? (
                    <Link to={nextStagePath} className={`${styles.levelStatus} ${styles.levelStatusNew}`}>
                      {passedStages === stageCount ? 'Повторити' : `Етап ${nextStageIndex + 1}`}
                    </Link>
                  ) : !difficultyUnlocked && unlockHint ? (
                    <span
                      className={`${styles.levelStatus} ${styles.levelStatusLocked}`}
                      title={unlockHint}
                      aria-label={unlockHint}
                    >
                      <span className={styles.unlockBadgePrefix}>Ранг</span>
                      <span className={styles.unlockBadgeRank}>{unlockRankLabel}</span>
                    </span>
                  ) : (
                    <span className={`${styles.levelStatus} ${styles.levelStatusLocked}`}>
                      {availableQuestions === 0 ? 'Немає питань' : '—'}
                    </span>
                  )}
                </div>

                {difficultyUnlocked && (
                  <>
                    <PracticeStageStepper
                      themeId={effectiveThemeId}
                      difficulty={diff}
                      nodeId={trackNodeId}
                      questionPoolSize={availableQuestions}
                      track={track}
                    />
                    <div className={styles.progressArea}>
                      <div className={styles.progressRow}>
                        <span className={styles.progressLabel}>Прогрес</span>
                        <span className={styles.progressValue}>
                          {passedStages}/{stageCount} етапів
                        </span>
                      </div>
                      <div className={styles.progressBar} role="progressbar" aria-valuenow={progressPct}>
                        <span style={{ width: `${progressPct}%` }} />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </MotionStaggerItem>
          );
        })}
      </MotionStagger>
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

function findNodePath(node: TopicNode, targetId: string): TopicNode[] | null {
  if (node.id === targetId) return [node];
  if (!node.children?.length) return null;
  for (const child of node.children) {
    const childPath = findNodePath(child, targetId);
    if (childPath) return [node, ...childPath];
  }
  return null;
}

function progressBorderColor(percent: number): string {
  if (percent >= 80) return 'var(--mastery-4)';
  if (percent >= 60) return 'var(--mastery-3)';
  if (percent >= 40) return 'var(--mastery-2)';
  if (percent > 0) return 'var(--mastery-1)';
  return 'rgba(255,255,255,0.2)';
}

function HierarchyTree({
  node,
  themeId,
  practiceTracks,
  selectedNodeId,
  onSelectNode,
}: {
  node: TopicNode;
  themeId: string;
  practiceTracks: PracticeTrackProgress[];
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
}) {
  const allNodes = getAllNodes(node, 0);

  return (
    <div className={styles.hierarchyTree}>
      {allNodes.map(({ node: currentNode, depth }) => {
        // Пропускаємо агрегатні вузли в ієрархії
        if (currentNode.aggregateThemeIds) return null;
        const progress = computeNodePracticeProgressPercent(
          practiceTracks,
          themeId,
          currentNode.id,
          { hierarchyRoot: node },
        );
        const isSelected = selectedNodeId === currentNode.id;
        const hasChildren = currentNode.children && currentNode.children.length > 0;

        return (
          <div key={currentNode.id} className={styles.hierarchyNode} style={{ marginLeft: `${depth * 16}px` }}>
            <button
              type="button"
              className={`${styles.hierarchyNodeBtn} ${isSelected ? styles.hierarchyNodeSelected : ''}`}
              onClick={() => onSelectNode(isSelected ? null : currentNode.id)}
              style={{ borderLeft: `3px solid ${progressBorderColor(progress)}` }}
            >
              <span className={styles.hierarchyNodeIcon}>{currentNode.icon}</span>
              <span className={styles.hierarchyNodeTitle}>{currentNode.title}</span>
              {hasChildren && (
                <span className={styles.hierarchyExpandIcon}>▶</span>
              )}
              <span className={styles.hierarchyMastery}>{progress}%</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
