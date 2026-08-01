import {
  DIFFICULTY_LABELS,
  type Recommendation,
  type RecommendationType,
  type TopicNode,
  type TopicHierarchyMap,
  type MasteryState,
  type PlayerProfile,
} from '../types';
import {
  getPracticeStageCount,
  PRACTICE_QUESTIONS_PER_STAGE,
  canPlayDifficulty,
  isStagePassed,
  getStageQuizPath,
} from './practiceProgression';

const PRACTICE_SESSION_MINUTES = Math.ceil((PRACTICE_QUESTIONS_PER_STAGE * 30) / 60);

interface RecommendationContext {
  profile: PlayerProfile;
  topicHierarchy: TopicHierarchyMap;
  currentThemeId?: string;
  recentRecommendations?: string[];
}

interface NodeMasteryInfo {
  node: TopicNode;
  mastery: MasteryState;
  pathFromRoot: TopicNode[];
  depth: number;
}

export function generateRecommendations(
  context: RecommendationContext,
  maxRecommendations: number = 5,
): Recommendation[] {
  const {
    profile,
    topicHierarchy,
    currentThemeId,
    recentRecommendations = [],
  } = context;

  const allRecommendations: Recommendation[] = [];

  const continueRecommendations = generateContinuePracticeRecommendations(
    profile,
    topicHierarchy,
    recentRecommendations,
  );
  allRecommendations.push(...continueRecommendations);

  const weaknessRecommendations = generateWeaknessRecommendations(
    profile,
    topicHierarchy,
    recentRecommendations,
  );
  allRecommendations.push(...weaknessRecommendations);

  const logicalRecommendations = generateLogicalRecommendations(
    profile,
    topicHierarchy,
    currentThemeId,
    recentRecommendations,
  );
  allRecommendations.push(...logicalRecommendations);

  const reviewRecommendations = generateReviewRecommendations(
    profile,
    topicHierarchy,
    recentRecommendations,
  );
  allRecommendations.push(...reviewRecommendations);

  const uniqueRecommendations = deduplicateRecommendations(allRecommendations);
  uniqueRecommendations.sort((a, b) => b.priority - a.priority);

  return uniqueRecommendations.slice(0, maxRecommendations);
}

function generateContinuePracticeRecommendations(
  profile: PlayerProfile,
  topicHierarchy: TopicHierarchyMap,
  recentRecommendations: string[],
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const rank = profile.playerRank;
  const tracks = profile.practiceTracks ?? [];

  for (const track of tracks) {
    if (!canPlayDifficulty(rank, track.difficulty)) continue;

    const stageCount = getPracticeStageCount(track.nodeId, track.difficulty);
    let nextStage: number | null = null;

    for (let stageIndex = 0; stageIndex < stageCount; stageIndex++) {
      if (stageIndex > track.highestUnlockedStage) break;
      if (!isStagePassed(track, stageIndex)) {
        nextStage = stageIndex;
        break;
      }
    }

    if (nextStage == null) continue;

    const dedupeKey = `continue-${track.themeId}-${track.nodeId ?? '_root'}-${track.difficulty}-${nextStage}`;
    if (recentRecommendations.includes(dedupeKey)) continue;

    const nodeTitle = track.nodeId
      ? findNodeInHierarchy(topicHierarchy, track.nodeId)?.title
      : null;
    const diffLabel = DIFFICULTY_LABELS[track.difficulty];

    recommendations.push({
      id: `${dedupeKey}-${Date.now()}`,
      type: 'continue-practice',
      themeId: track.themeId,
      nodeId: track.nodeId ?? track.themeId,
      difficulty: track.difficulty,
      stageIndex: nextStage,
      title: nodeTitle
        ? `Етап ${nextStage + 1}: ${nodeTitle}`
        : `Етап ${nextStage + 1} · ${diffLabel}`,
      description: `Продовж практику — ${PRACTICE_QUESTIONS_PER_STAGE} питань, потрібно 7+ правильних.`,
      priority: 12,
      estimatedTime: PRACTICE_SESSION_MINUTES,
      reason: 'Незавершений етап практики',
    });
  }

  return recommendations;
}

function resolveThemeIdForNode(
  nodeId: string,
  topicHierarchy: TopicHierarchyMap,
): string | null {
  for (const [themeKey, root] of Object.entries(topicHierarchy)) {
    if (root.id === nodeId) {
      return root.themeId ?? themeKey;
    }
    const found = findNodeById(root, nodeId);
    if (found) {
      return found.themeId ?? themeKey;
    }
  }
  return null;
}

function generateWeaknessRecommendations(
  profile: PlayerProfile,
  topicHierarchy: TopicHierarchyMap,
  recentRecommendations: string[],
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const weakNodes = findWeakNodes(profile, topicHierarchy);

  weakNodes.sort((a, b) => {
    const aPriority = (100 - a.mastery.mastery) + a.mastery.wrongCount * 5;
    const bPriority = (100 - b.mastery.mastery) + b.mastery.wrongCount * 5;
    return bPriority - aPriority;
  });

  weakNodes.slice(0, 3).forEach((nodeInfo, index) => {
    if (recentRecommendations.includes(nodeInfo.node.id)) return;

    const mastery = nodeInfo.mastery.mastery;
    let priority = 10 - index;

    if (nodeInfo.mastery.wrongCount > nodeInfo.mastery.totalAnswers * 0.6) {
      priority += 2;
    }

    const themeId = resolveThemeIdForNode(nodeInfo.node.id, topicHierarchy) ?? undefined;

    recommendations.push({
      id: `weakness-${nodeInfo.node.id}-${Date.now()}`,
      type: 'weakness',
      themeId,
      nodeId: nodeInfo.node.id,
      title: `Повторити: ${nodeInfo.node.title}`,
      description: `Твій рівень знань тут лише ${Math.round(mastery)}%. Час закріпити матеріал!`,
      priority,
      estimatedTime: PRACTICE_SESSION_MINUTES,
      reason: `Низький рівень знань (${Math.round(mastery)}%), ${nodeInfo.mastery.wrongCount} помилок з ${nodeInfo.mastery.totalAnswers} відповідей`,
      masteryBefore: mastery,
      targetMastery: Math.min(mastery + 20, 90),
    });
  });

  return recommendations;
}

function generateLogicalRecommendations(
  profile: PlayerProfile,
  topicHierarchy: TopicHierarchyMap,
  currentThemeId?: string,
  recentRecommendations: string[] = [],
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  if (!currentThemeId) {
    const rootNodes = Object.values(topicHierarchy);
    rootNodes.forEach((rootNode) => {
      if (recentRecommendations.includes(rootNode.id)) return;

      const mastery = profile.studyMastery[rootNode.id]?.mastery || 0;
      const themeId = rootNode.themeId ?? resolveThemeIdForNode(rootNode.id, topicHierarchy) ?? rootNode.id;

      if (mastery < 50) {
        recommendations.push({
          id: `logical-start-${rootNode.id}-${Date.now()}`,
          type: 'next-logical',
          themeId,
          nodeId: rootNode.id,
          title: `Почати вивчення: ${rootNode.title}`,
          description: 'Це фундаментальний розділ. Почни з нього, щоб побудувати міцну базу знань.',
          priority: 7,
          estimatedTime: PRACTICE_SESSION_MINUTES * 2,
          reason: 'Початок логічного шляху вивчення',
          masteryBefore: mastery,
          targetMastery: 50,
        });
      }
    });
  } else {
    const currentHierarchy = topicHierarchy[currentThemeId];
    if (currentHierarchy) {
      const nextNodes = findNextLogicalNodes(currentHierarchy, profile.studyMastery);

      nextNodes.forEach((node, index) => {
        if (recentRecommendations.includes(node.id)) return;

        const mastery = profile.studyMastery[node.id]?.mastery || 0;
        const themeId =
          node.themeId ?? resolveThemeIdForNode(node.id, topicHierarchy) ?? currentThemeId;

        recommendations.push({
          id: `logical-next-${node.id}-${Date.now()}`,
          type: 'next-logical',
          themeId,
          nodeId: node.id,
          title: `Наступна тема: ${node.title}`,
          description: 'Логічне продовження твоєго навчання. Ця тема базується на вже вивченому матеріалі.',
          priority: 8 - index,
          estimatedTime: PRACTICE_SESSION_MINUTES,
          reason: 'Наступний крок у логічному поряді навчання',
          masteryBefore: mastery,
          targetMastery: Math.min(mastery + 15, 85),
        });
      });
    }
  }

  return recommendations;
}

function generateReviewRecommendations(
  profile: PlayerProfile,
  topicHierarchy: TopicHierarchyMap,
  recentRecommendations: string[] = [],
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;

  Object.entries(profile.studyMastery).forEach(([nodeId, mastery]) => {
    if (recentRecommendations.includes(nodeId)) return;

    const lastReviewed = mastery.lastReviewedAt ? new Date(mastery.lastReviewedAt).getTime() : 0;
    const daysSinceReview = (now - lastReviewed) / oneDayMs;

    if (daysSinceReview >= 3 && mastery.mastery >= 50 && mastery.mastery <= 80) {
      const node = findNodeInHierarchy(topicHierarchy, nodeId);
      if (!node) return;

      const themeId = resolveThemeIdForNode(nodeId, topicHierarchy) ?? undefined;

      recommendations.push({
        id: `review-${nodeId}-${Date.now()}`,
        type: 'review-scheduled',
        themeId,
        nodeId,
        title: `Повторити: ${node.title}`,
        description: `Ти не повторював цю тему ${Math.round(daysSinceReview)} днів. Час освіжити знання!`,
        priority: 5,
        estimatedTime: PRACTICE_SESSION_MINUTES,
        reason: `Повторення через ${Math.round(daysSinceReview)} днів (spaced repetition)`,
        masteryBefore: mastery.mastery,
        targetMastery: Math.min(mastery.mastery + 10, 95),
      });
    }
  });

  recommendations.sort((a, b) => {
    const aMastery = profile.studyMastery[a.nodeId];
    const bMastery = profile.studyMastery[b.nodeId];
    const aTime = aMastery?.lastReviewedAt ? new Date(aMastery.lastReviewedAt).getTime() : 0;
    const bTime = bMastery?.lastReviewedAt ? new Date(bMastery.lastReviewedAt).getTime() : 0;
    return aTime - bTime;
  });

  return recommendations.slice(0, 2);
}

function findWeakNodes(
  profile: PlayerProfile,
  topicHierarchy: TopicHierarchyMap,
): NodeMasteryInfo[] {
  const weakNodes: NodeMasteryInfo[] = [];

  Object.values(topicHierarchy).forEach((rootNode) => {
    collectWeakNodes(rootNode, profile.studyMastery, [], 0, weakNodes);
  });

  return weakNodes;
}

function collectWeakNodes(
  node: TopicNode,
  masteryStates: Record<string, MasteryState>,
  path: TopicNode[],
  depth: number,
  result: NodeMasteryInfo[],
): void {
  const mastery = masteryStates[node.id];

  if (mastery && mastery.totalAnswers > 0 && mastery.mastery < 70) {
    result.push({
      node,
      mastery,
      pathFromRoot: [...path, node],
      depth,
    });
  }

  if (node.children?.length) {
    node.children.forEach((child) => {
      collectWeakNodes(child, masteryStates, [...path, node], depth + 1, result);
    });
  }
}

function findNextLogicalNodes(
  rootNode: TopicNode,
  masteryStates: Record<string, MasteryState>,
): TopicNode[] {
  const nextNodes: TopicNode[] = [];

  function traverse(node: TopicNode): void {
    const mastery = masteryStates[node.id]?.mastery || 0;

    if (mastery >= 70) {
      if (node.children?.length) {
        node.children.forEach((child) => {
          const childMastery = masteryStates[child.id]?.mastery || 0;
          if (childMastery < 60) {
            nextNodes.push(child);
          } else {
            traverse(child);
          }
        });
      }
    }
  }

  traverse(rootNode);
  return nextNodes;
}

function findNodeInHierarchy(
  topicHierarchy: TopicHierarchyMap,
  nodeId: string,
): TopicNode | null {
  for (const rootNode of Object.values(topicHierarchy)) {
    const found = findNodeById(rootNode, nodeId);
    if (found) return found;
  }
  return null;
}

function findNodeById(node: TopicNode, targetId: string): TopicNode | null {
  if (node.id === targetId) return node;

  for (const child of node.children ?? []) {
    const found = findNodeById(child, targetId);
    if (found) return found;
  }

  return null;
}

function deduplicateRecommendations(
  recommendations: Recommendation[],
): Recommendation[] {
  const seen = new Set<string>();
  const unique: Recommendation[] = [];

  recommendations.forEach((rec) => {
    const key =
      rec.type === 'continue-practice' && rec.themeId && rec.difficulty != null && rec.stageIndex != null
        ? `continue-${rec.themeId}-${rec.nodeId}-${rec.difficulty}-${rec.stageIndex}`
        : `${rec.type}-${rec.nodeId}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(rec);
    }
  });

  return unique;
}

export function updateRecentRecommendations(
  current: string[],
  newRecommendationId: string,
  maxCount: number = 10,
): string[] {
  const filtered = current.filter((id) => id !== newRecommendationId);
  return [newRecommendationId, ...filtered].slice(0, maxCount);
}

/** Navigation path for a recommendation card */
export function getRecommendationLink(rec: Recommendation): string {
  if (rec.themeId && rec.difficulty != null && rec.stageIndex != null) {
    const nodeIdForPath = rec.nodeId !== rec.themeId ? rec.nodeId : null;
    return getStageQuizPath(rec.themeId, rec.difficulty, rec.stageIndex, nodeIdForPath);
  }
  if (rec.themeId && rec.nodeId && rec.nodeId !== rec.themeId) {
    return `/play/study/themes/${rec.themeId}/${rec.nodeId}`;
  }
  if (rec.themeId) {
    return `/play/study/themes/${rec.themeId}`;
  }
  return '/play/study/themes';
}

export function formatRecommendation(rec: Recommendation): {
  title: string;
  description: string;
  subtitle: string;
  icon: string;
} {
  let icon = '📚';
  switch (rec.type as RecommendationType) {
    case 'continue-practice':
      icon = '▶️';
      break;
    case 'weakness':
      icon = '⚠️';
      break;
    case 'next-logical':
      icon = '➡️';
      break;
    case 'review-scheduled':
      icon = '🔄';
      break;
  }

  return {
    title: rec.title,
    description: rec.description,
    subtitle: rec.reason,
    icon,
  };
}
