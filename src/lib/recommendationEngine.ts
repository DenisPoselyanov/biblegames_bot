import type {
  Recommendation,
  RecommendationType,
  TopicNode,
  TopicHierarchyMap,
  MasteryState,
  PlayerProfile,
} from '../types';

/**
 * Recommendation Engine
 * 
 * Генерує персоналізовані рекомендації для навчання на основі:
 * - Логічного шляху по ієрархії тем
 * - Слабких місць користувача (низький mastery)
 * - Часу від останнього повторення (spaced repetition)
 * - Пріоритетів користувача
 */

interface RecommendationContext {
  profile: PlayerProfile;
  topicHierarchy: TopicHierarchyMap;
  currentThemeId?: string;
  recentRecommendations?: string[]; // Щоб уникнути дублікатів
  availableTime?: number; // у хвилинах
}

interface NodeMasteryInfo {
  node: TopicNode;
  mastery: MasteryState;
  pathFromRoot: TopicNode[];
  depth: number;
  parentMastery?: number;
}

/**
 * Головна функція для генерації рекомендацій
 */
export function generateRecommendations(
  context: RecommendationContext,
  maxRecommendations: number = 5,
): Recommendation[] {
  const {
    profile,
    topicHierarchy,
    currentThemeId,
    recentRecommendations = [],
    availableTime,
  } = context;

  const allRecommendations: Recommendation[] = [];

  // 1. Рекомендації за слабкими місцями (пріоритетні)
  const weaknessRecommendations = generateWeaknessRecommendations(
    profile,
    topicHierarchy,
    recentRecommendations,
  );
  allRecommendations.push(...weaknessRecommendations);

  // 2. Логічні рекомендації за ієрархією
  const logicalRecommendations = generateLogicalRecommendations(
    profile,
    topicHierarchy,
    currentThemeId,
    recentRecommendations,
  );
  allRecommendations.push(...logicalRecommendations);

  // 3. Рекомендації для повторення (spaced repetition)
  const reviewRecommendations = generateReviewRecommendations(
    profile,
    topicHierarchy,
    recentRecommendations,
  );
  allRecommendations.push(...reviewRecommendations);

  // 4. Рекомендації для мікротренування
  const microRecommendations = generateMicroTrainingRecommendations(
    profile,
    topicHierarchy,
    recentRecommendations,
    availableTime,
  );
  allRecommendations.push(...microRecommendations);

  // Сортуємо за пріоритетом і уникаємо дублікатів
  const uniqueRecommendations = deduplicateRecommendations(allRecommendations);
  uniqueRecommendations.sort((a, b) => b.priority - a.priority);

  return uniqueRecommendations.slice(0, maxRecommendations);
}

/**
 * Генерація рекомендацій за слабкими місцями
 */
function generateWeaknessRecommendations(
  profile: PlayerProfile,
  topicHierarchy: TopicHierarchyMap,
  recentRecommendations: string[],
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  
  // Знаходимо вузли з низьким mastery
  const weakNodes = findWeakNodes(profile, topicHierarchy);
  
  // Сортуємо за важливістю (нижче mastery + більше відповідей)
  weakNodes.sort((a, b) => {
    const aPriority = (100 - a.mastery.mastery) + (a.mastery.wrongCount * 5);
    const bPriority = (100 - b.mastery.mastery) + (b.mastery.wrongCount * 5);
    return bPriority - aPriority;
  });

  // Беремо топ-3 слабкі місця
  weakNodes.slice(0, 3).forEach((nodeInfo, index) => {
    if (recentRecommendations.includes(nodeInfo.node.id)) return;

    const mastery = nodeInfo.mastery.mastery;
    let priority = 10 - index; // 10, 9, 8
    
    // Додаткові бали за часті помилки
    if (nodeInfo.mastery.wrongCount > nodeInfo.mastery.totalAnswers * 0.6) {
      priority += 2;
    }

    recommendations.push({
      id: `weakness-${nodeInfo.node.id}-${Date.now()}`,
      type: 'weakness',
      nodeId: nodeInfo.node.id,
      title: `Повторити: ${nodeInfo.node.title}`,
      description: `Твій рівень знань тут лише ${Math.round(mastery)}%. Час закріпити матеріал!`,
      priority,
      estimatedTime: nodeInfo.node.estimatedTime || 15,
      reason: `Низький рівень знань (${Math.round(mastery)}%), ${nodeInfo.mastery.wrongCount} помилок з ${nodeInfo.mastery.totalAnswers} відповідей`,
      masteryBefore: mastery,
      targetMastery: Math.min(mastery + 20, 90),
    });
  });

  return recommendations;
}

/**
 * Генерація логічних рекомендацій за ієрархією
 */
function generateLogicalRecommendations(
  profile: PlayerProfile,
  topicHierarchy: TopicHierarchyMap,
  currentThemeId?: string,
  recentRecommendations: string[] = [],
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  if (!currentThemeId) {
    // Якщо немає активної теми, рекомендуємо початок найбільшого розділу
    const rootNodes = Object.values(topicHierarchy);
    rootNodes.forEach((rootNode) => {
      if (recentRecommendations.includes(rootNode.id)) return;

      const mastery = profile.studyMastery[rootNode.id]?.mastery || 0;
      
      if (mastery < 50) {
        recommendations.push({
          id: `logical-start-${rootNode.id}-${Date.now()}`,
          type: 'next-logical',
          nodeId: rootNode.id,
          title: `Почати вивчення: ${rootNode.title}`,
          description: `Це фундаментальний розділ. Почни з нього, щоб побудувати міцну базу знань.`,
          priority: 7,
          estimatedTime: rootNode.estimatedTime || 30,
          reason: 'Початок логічного шляху вивчення',
          masteryBefore: mastery,
          targetMastery: 50,
        });
      }
    });
  } else {
    // Рекомендуємо наступні теми в ієрархії
    const currentHierarchy = topicHierarchy[currentThemeId];
    if (currentHierarchy) {
      const nextNodes = findNextLogicalNodes(currentHierarchy, profile.studyMastery);
      
      nextNodes.forEach((node, index) => {
        if (recentRecommendations.includes(node.id)) return;

        const mastery = profile.studyMastery[node.id]?.mastery || 0;
        
        recommendations.push({
          id: `logical-next-${node.id}-${Date.now()}`,
          type: 'next-logical',
          nodeId: node.id,
          title: `Наступна тема: ${node.title}`,
          description: `Логічне продовження твоєго навчання. Ця тема базується на вже вивченому матеріалі.`,
          priority: 8 - index, // 8, 7, 6...
          estimatedTime: node.estimatedTime || 20,
          reason: 'Наступний крок у логічному поряді навчання',
          masteryBefore: mastery,
          targetMastery: Math.min(mastery + 15, 85),
        });
      });
    }
  }

  return recommendations;
}

/**
 * Генерація рекомендацій для повторення (spaced repetition)
 */
function generateReviewRecommendations(
  profile: PlayerProfile,
  topicHierarchy: TopicHierarchyMap,
  recentRecommendations: string[] = [],
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const threeDaysMs = 3 * oneDayMs;

  // Знаходимо теми, які потрібно повторити
  Object.entries(profile.studyMastery).forEach(([nodeId, mastery]) => {
    if (recentRecommendations.includes(nodeId)) return;

    const lastReviewed = mastery.lastReviewedAt ? new Date(mastery.lastReviewedAt).getTime() : 0;
    const daysSinceReview = (now - lastReviewed) / oneDayMs;

    // Якщо пройшло достатньо часу і mastery в середині (не занадто низький, не занадто високий)
    if (daysSinceReview >= 3 && mastery.mastery >= 50 && mastery.mastery <= 80) {
      const node = findNodeInHierarchy(topicHierarchy, nodeId);
      if (!node) return;

      recommendations.push({
        id: `review-${nodeId}-${Date.now()}`,
        type: 'review-scheduled',
        nodeId,
        title: `Повторити: ${node.title}`,
        description: `Ти не повторював цю тему ${Math.round(daysSinceReview)} днів. Час освіжити знання!`,
        priority: 5,
        estimatedTime: 10,
        reason: `Повторення через ${Math.round(daysSinceReview)} днів (spaced repetition)`,
        masteryBefore: mastery.mastery,
        targetMastery: Math.min(mastery.mastery + 10, 95),
      });
    }
  });

  // Сортуємо за часом з останнього повторення
  recommendations.sort((a, b) => {
    const aMastery = profile.studyMastery[a.nodeId];
    const bMastery = profile.studyMastery[b.nodeId];
    const aTime = aMastery?.lastReviewedAt ? new Date(aMastery.lastReviewedAt).getTime() : 0;
    const bTime = bMastery?.lastReviewedAt ? new Date(bMastery.lastReviewedAt).getTime() : 0;
    return aTime - bTime; // Найстаріші спочатку
  });

  return recommendations.slice(0, 2);
}

/**
 * Генерація рекомендацій для мікротренування
 */
function generateMicroTrainingRecommendations(
  profile: PlayerProfile,
  topicHierarchy: TopicHierarchyMap,
  recentRecommendations: string[] = [],
  availableTime?: number,
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // Знаходимо дрібні підтеми для швидкого тренування
  Object.entries(topicHierarchy).forEach(([themeId, rootNode]) => {
    const microNodes = findMicroNodes(rootNode); // Вузли з малою кількістю питань
    
    microNodes.forEach((node) => {
      if (recentRecommendations.includes(node.id)) return;

      const mastery = profile.studyMastery[node.id]?.mastery || 0;
      
      // Рекомендуємо для швидкого покращення або підтримки
      if (mastery < 70) {
        const timeNeeded = 5; // 5 хвилин на мікротренування
        
        if (!availableTime || timeNeeded <= availableTime) {
          recommendations.push({
            id: `micro-${node.id}-${Date.now()}`,
            type: 'micro-training',
            nodeId: node.id,
            title: `Швидке тренування: ${node.title}`,
            description: `Коротка сесія (5 хв) для закріплення конкретної теми.`,
            priority: 4,
            estimatedTime: timeNeeded,
            reason: 'Мікротренування для швидкого покращення',
            masteryBefore: mastery,
            targetMastery: Math.min(mastery + 15, 85),
          });
        }
      }
    });
  });

  // Сортуємо за потенційним покращенням
  recommendations.sort((a, b) => {
    const aImprovement = (a.targetMastery || 0) - (a.masteryBefore || 0);
    const bImprovement = (b.targetMastery || 0) - (b.masteryBefore || 0);
    return bImprovement - aImprovement;
  });

  return recommendations.slice(0, 2);
}

/**
 * Знаходження слабких вузлів
 */
function findWeakNodes(
  profile: PlayerProfile,
  topicHierarchy: TopicHierarchyMap,
): NodeMasteryInfo[] {
  const weakNodes: NodeMasteryInfo[] = [];

  Object.entries(topicHierarchy).forEach(([themeId, rootNode]) => {
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

  if (node.children && node.children.length > 0) {
    node.children.forEach((child) => {
      collectWeakNodes(child, masteryStates, [...path, node], depth + 1, result);
    });
  }
}

/**
 * Знаходження наступних логічних вузлів
 */
function findNextLogicalNodes(
  rootNode: TopicNode,
  masteryStates: Record<string, MasteryState>,
): TopicNode[] {
  const nextNodes: TopicNode[] = [];

  function traverse(node: TopicNode): void {
    const mastery = masteryStates[node.id]?.mastery || 0;
    
    // Якщо добре засвоєно, дивись дочірні вузли
    if (mastery >= 70) {
      if (node.children && node.children.length > 0) {
        node.children.forEach((child) => {
          const childMastery = masteryStates[child.id]?.mastery || 0;
          // Рекомендуємо, якщо ще не засвоєно
          if (childMastery < 60) {
            nextNodes.push(child);
          } else {
            traverse(child); // Рекурсивно шукаємо далі
          }
        });
      }
    }
  }

  traverse(rootNode);
  return nextNodes;
}

/**
 * Знаходження мікровузлів (для швидкого тренування)
 */
function findMicroNodes(rootNode: TopicNode): TopicNode[] {
  const microNodes: TopicNode[] = [];

  function traverse(node: TopicNode): void {
    // Вузли без дітей або з малою кількістю питань - кандидати для мікротренування
    if (!node.children || node.children.length === 0) {
      microNodes.push(node);
    } else {
      node.children.forEach(traverse);
    }
  }

  traverse(rootNode);
  return microNodes;
}

/**
 * Пошук вузла в ієрархії
 */
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
  
  for (const child of node.children) {
    const found = findNodeById(child, targetId);
    if (found) return found;
  }
  
  return null;
}

/**
 * Видалення дублікатів рекомендацій
 */
function deduplicateRecommendations(
  recommendations: Recommendation[],
): Recommendation[] {
  const seen = new Set<string>();
  const unique: Recommendation[] = [];

  recommendations.forEach((rec) => {
    const key = `${rec.type}-${rec.nodeId}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(rec);
    }
  });

  return unique;
}

/**
 * Оновлення списку нещодавніх рекомендацій
 */
export function updateRecentRecommendations(
  current: string[],
  newRecommendationId: string,
  maxCount: number = 10,
): string[] {
  const filtered = current.filter((id) => id !== newRecommendationId);
  return [newRecommendationId, ...filtered].slice(0, maxCount);
}

/**
 * Форматування рекомендації для відображення
 */
export function formatRecommendation(rec: Recommendation): {
  title: string;
  description: string;
  subtitle: string;
  icon: string;
} {
  const node = rec; // In real implementation, would fetch from hierarchy
  
  let icon = '📚';
  switch (rec.type) {
    case 'weakness':
      icon = '⚠️';
      break;
    case 'next-logical':
      icon = '➡️';
      break;
    case 'review-scheduled':
      icon = '🔄';
      break;
    case 'micro-training':
      icon = '⚡';
      break;
  }

  return {
    title: rec.title,
    description: rec.description,
    subtitle: rec.reason,
    icon,
  };
}