import type {
  Difficulty,
  Question,
  TopicNode,
  AdaptiveTestConfig,
  MasteryState,
  QuestionSelectionStrategy,
} from '../types';
import { DIFFICULTY_ORDER, DIFFICULTIES } from '../types';

/**
 * Adaptive Testing Engine
 * 
 * Ця бібліотека забезпечує інтелектуальний підбір питань на основі:
 * - Поточного рівня знань користувача (mastery)
 * - Ієрархічної структури тем
 * - Обраної стратегії навчання
 */

interface QuestionSelectionContext {
  masteryStates: Record<string, MasteryState>;
  targetNodeId?: string;
  targetDifficulty?: Difficulty;
  hierarchyPath?: string[];
  answeredQuestionIds: Set<string>;
}

interface QuestionScore {
  question: Question;
  score: number;
  reason: string;
}

/**
 * Основна функція для підбору питань для адаптивного тесту
 */
export async function selectAdaptiveQuestions(
  config: AdaptiveTestConfig,
  context: QuestionSelectionContext,
  allQuestions: Question[],
  topicHierarchy?: TopicNode,
): Promise<Question[]> {
  const {
    strategy,
    targetDifficulty,
    includeParentNodes,
    includeChildNodes,
    questionCount,
  } = config;

  // Отримуємо кандидатів питань на основі ієрархії
  const candidateQuestions = filterQuestionsByHierarchy(
    allQuestions,
    context.targetNodeId,
    topicHierarchy,
    includeParentNodes,
    includeChildNodes,
  );

  // Застосовуємо стратегію вибору
  let scoredQuestions: QuestionScore[];
  
  switch (strategy) {
    case 'balanced':
      scoredQuestions = applyBalancedStrategy(candidateQuestions, context);
      break;
    case 'weakness-focused':
      scoredQuestions = applyWeaknessFocusedStrategy(candidateQuestions, context);
      break;
    case 'progressive':
      scoredQuestions = applyProgressiveStrategy(candidateQuestions, context);
      break;
    case 'random':
      scoredQuestions = applyRandomStrategy(candidateQuestions);
      break;
    default:
      scoredQuestions = applyBalancedStrategy(candidateQuestions, context);
  }

  // Фільтруємо за цільовою складністю (якщо вказано)
  if (targetDifficulty) {
    scoredQuestions = scoredQuestions.filter(
      (sq) => sq.question.difficulty === targetDifficulty,
    );
  }

  // Вилучаємо вже відповідані питання
  scoredQuestions = scoredQuestions.filter(
    (sq) => !context.answeredQuestionIds.has(sq.question.id),
  );

  // Сортуємо за балами і повертаємо топ-N
  scoredQuestions.sort((a, b) => b.score - a.score);
  
  return scoredQuestions
    .slice(0, questionCount)
    .map((sq) => sq.question);
}

/**
 * Фільтрація питань за ієрархією тем
 */
function filterQuestionsByHierarchy(
  questions: Question[],
  targetNodeId?: string,
  topicHierarchy?: TopicNode,
  includeParentNodes = false,
  includeChildNodes = false,
): Question[] {
  if (!targetNodeId || !topicHierarchy) {
    // Якщо немає ієрархії, повертаємо всі питання
    return questions;
  }

  const targetNode = findNodeById(topicHierarchy, targetNodeId);
  if (!targetNode) {
    return questions;
  }

  const relevantThemeIds = new Set<string>();

  // Додаємо тему самого вузла (якщо є themeId)
  if (targetNode.themeId) {
    relevantThemeIds.add(targetNode.themeId);
  }

  // Додаємо батьківські вузли
  if (includeParentNodes) {
    const parentPath = findParentPath(topicHierarchy, targetNodeId);
    parentPath.forEach((node) => {
      if (node.themeId) relevantThemeIds.add(node.themeId);
    });
  }

  // Додаємо дочірні вузли
  if (includeChildNodes) {
    const childNodes = findAllChildNodes(targetNode);
    childNodes.forEach((node) => {
      if (node.themeId) relevantThemeIds.add(node.themeId);
    });
  }

  // Якщо немає themeId, спробуємо маппінг через ідентифікатор
  if (relevantThemeIds.size === 0) {
    // Простий підхід: використовуємо nodeId як themeId
    relevantThemeIds.add(targetNodeId);
  }

  return questions.filter((q) => relevantThemeIds.has(q.themeId));
}

/**
 * Стратегія: Збалансована
 * 40% нові питання, 40% закріплення, 20% складніші
 */
function applyBalancedStrategy(
  questions: Question[],
  context: QuestionSelectionContext,
): QuestionScore[] {
  const scored: QuestionScore[] = [];
  const { masteryStates } = context;

  questions.forEach((question) => {
    const mastery = masteryStates[question.themeId];
    let score = 50; // Базовий бал
    let reason = 'balanced';

    if (!mastery || mastery.totalAnswers === 0) {
      // Нові питання
      score += 30;
      reason = 'new';
    } else if (mastery.mastery < 60) {
      // Слабкі місця - пріоритет
      score += 40;
      reason = 'weakness';
    } else if (mastery.mastery >= 60 && mastery.mastery < 80) {
      // Закріплення
      score += 20;
      reason = 'reinforce';
    } else {
      // Добре засвоєні - менший пріоритет
      score -= 10;
      reason = 'mastered';
    }

    // Додаємо варіативність за складністю
    const diffScore = addDifficultyVariability(question, mastery);
    score += diffScore;

    scored.push({ question, score, reason });
  });

  return scored;
}

/**
 * Стратегія: Фокус на слабких місцях
 * Пріоритет питанням з низьким mastery
 */
function applyWeaknessFocusedStrategy(
  questions: Question[],
  context: QuestionSelectionContext,
): QuestionScore[] {
  const scored: QuestionScore[] = [];
  const { masteryStates } = context;

  questions.forEach((question) => {
    const mastery = masteryStates[question.themeId];
    let score = 0;
    let reason = 'unknown';

    if (!mastery || mastery.totalAnswers === 0) {
      score = 70; // Нові питання також важливі
      reason = 'new';
    } else {
      // Чим нижче mastery, тим вищий бал
      score = 100 - mastery.mastery;
      
      // Додаткові бали за часті помилки
      if (mastery.wrongCount > mastery.totalAnswers * 0.5) {
        score += 30;
        reason = 'frequent-mistakes';
      } else {
        reason = 'low-mastery';
      }

      // Бали за низьку впевненість
      if (mastery.confidence < 50) {
        score += 20;
      }
    }

    // Невелика варіативність за складністю
    const diffScore = addDifficultyVariability(question, mastery) * 0.3;
    score += diffScore;

    scored.push({ question, score, reason });
  });

  return scored;
}

/**
 * Стратегія: Прогресивна
 * Поступово збільшує складність
 */
function applyProgressiveStrategy(
  questions: Question[],
  context: QuestionSelectionContext,
): QuestionScore[] {
  const scored: QuestionScore[] = [];
  const { masteryStates, targetDifficulty } = context;

  questions.forEach((question) => {
    const mastery = masteryStates[question.themeId];
    let score = 50;
    let reason = 'progressive';

    // Базуємося на поточному рівні користувача
    if (mastery && mastery.mastery > 70) {
      // Якщо добре знає тему, давай складніші питання
      if (isHigherDifficulty(question.difficulty, targetDifficulty)) {
        score += 40;
        reason = 'challenge';
      } else {
        score += 10;
        reason = 'maintain';
      }
    } else if (mastery && mastery.mastery < 40) {
      // Якщо погано знає, легші питання
      if (isLowerDifficulty(question.difficulty, targetDifficulty)) {
        score += 40;
        reason = 'build-foundation';
      } else {
        score -= 20;
        reason = 'too-hard';
      }
    } else {
      // Середній рівень - збалансовано
      score += 20;
      reason = 'balanced';
    }

    scored.push({ question, score, reason });
  });

  return scored;
}

/**
 * Стратегія: Випадкова
 */
function applyRandomStrategy(questions: Question[]): QuestionScore[] {
  return questions.map((question) => ({
    question,
    score: Math.random() * 100,
    reason: 'random',
  }));
}

/**
 * Додавання варіативності за складністю
 */
function addDifficultyVariability(
  question: Question,
  mastery?: MasteryState,
): number {
  let variability = 0;

  if (!mastery) {
    // Для нових питань - невелика варіативність
    return (Math.random() - 0.5) * 10;
  }

  // Якщо користувач добре справляється, спробуй складніші
  if (mastery.mastery > 80 && mastery.correctStreak > 3) {
    const currentDiff = question.difficulty;
    const higherDiffs = DIFFICULTIES.filter(
      (d) => DIFFICULTY_ORDER[d] > DIFFICULTY_ORDER[currentDiff],
    );
    if (higherDiffs.includes(question.difficulty)) {
      variability += 15;
    }
  }

  // Невелика рандомізація для різноманітності
  variability += (Math.random() - 0.5) * 10;

  return variability;
}

/**
 * Порівняння складності
 */
function isHigherDifficulty(
  diff1: Difficulty,
  diff2?: Difficulty,
): boolean {
  if (!diff2) return false;
  return DIFFICULTY_ORDER[diff1] > DIFFICULTY_ORDER[diff2];
}

function isLowerDifficulty(
  diff1: Difficulty,
  diff2?: Difficulty,
): boolean {
  if (!diff2) return false;
  return DIFFICULTY_ORDER[diff1] < DIFFICULTY_ORDER[diff2];
}

/**
 * Пошук вузла в ієрархії за ID
 */
function findNodeById(node: TopicNode, targetId: string): TopicNode | null {
  if (node.id === targetId) {
    return node;
  }
  
  for (const child of node.children) {
    const found = findNodeById(child, targetId);
    if (found) return found;
  }
  
  return null;
}

/**
 * Знаходження шляху до кореня (батьківські вузли)
 */
function findParentPath(
  node: TopicNode,
  targetId: string,
  path: TopicNode[] = [],
): TopicNode[] {
  if (node.id === targetId) {
    return path;
  }

  for (const child of node.children) {
    const result = findParentPath(child, targetId, [...path, node]);
    if (result.length > 0 || child.id === targetId) {
      if (child.id === targetId) {
        return [...path, node];
      }
      return result;
    }
  }

  return [];
}

/**
 * Знаходження всіх дочірніх вузлів
 */
function findAllChildNodes(node: TopicNode): TopicNode[] {
  const children: TopicNode[] = [];
  
  for (const child of node.children) {
    children.push(child);
    children.push(...findAllChildNodes(child));
  }
  
  return children;
}

/**
 * Створення дефолтної конфігурації для адаптивного тесту
 */
export function createDefaultAdaptiveConfig(
  strategy: QuestionSelectionStrategy = 'balanced',
): AdaptiveTestConfig {
  return {
    strategy,
    includeParentNodes: true,
    includeChildNodes: false,
    questionCount: 10,
    timeLimit: 300, // 5 хвилин
  };
}

/**
 * Оцінка ефективності адаптивного тесту
 */
export interface AdaptiveTestPerformance {
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  averageResponseTime: number;
  improvementAreas: string[];
  masteredAreas: string[];
}

export function evaluateAdaptivePerformance(
  answers: Array<{ isCorrect: boolean; responseMs?: number; themeId: string }>,
  masteryBefore: Record<string, MasteryState>,
): AdaptiveTestPerformance {
  const totalQuestions = answers.length;
  const correctAnswers = answers.filter((a) => a.isCorrect).length;
  const accuracy = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
  
  const responseTimes = answers
    .map((a) => a.responseMs)
    .filter((rt): rt is number => rt !== undefined);
  const averageResponseTime = responseTimes.length > 0
    ? responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length
    : 0;

  // Аналіз областей для покращення
  const themePerformance = new Map<string, { correct: number; total: number }>();
  
  answers.forEach((answer) => {
    const current = themePerformance.get(answer.themeId) || { correct: 0, total: 0 };
    current.total++;
    if (answer.isCorrect) current.correct++;
    themePerformance.set(answer.themeId, current);
  });

  const improvementAreas: string[] = [];
  const masteredAreas: string[] = [];

  themePerformance.forEach((perf, themeId) => {
    const themeAccuracy = (perf.correct / perf.total) * 100;
    const beforeMastery = masteryBefore[themeId]?.mastery || 0;
    
    if (themeAccuracy < 60 && beforeMastery < 50) {
      improvementAreas.push(themeId);
    } else if (themeAccuracy > 80 && beforeMastery > 70) {
      masteredAreas.push(themeId);
    }
  });

  return {
    totalQuestions,
    correctAnswers,
    accuracy,
    averageResponseTime,
    improvementAreas,
    masteredAreas,
  };
}