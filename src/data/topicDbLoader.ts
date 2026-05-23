import type { Question, TopicNode, TopicHierarchyMap } from '../types';

const topicModules = import.meta.glob('../../data/topics-db/*.json');

const cache = new Map<string, TopicNode | null>();
let loadPromises = new Map<string, Promise<TopicNode | null>>();

function themeIdFromPath(path: string): string {
  const match = path.match(/\/([^/]+)\.json$/);
  return match?.[1] ?? '';
}

export async function loadTopicHierarchy(themeId: string): Promise<TopicNode | null> {
  if (cache.has(themeId)) return cache.get(themeId)!;

  if (!loadPromises.has(themeId)) {
    const loader = Object.entries(topicModules).find(
      ([path]) => themeIdFromPath(path) === themeId,
    );

    const promise = loader
      ? (loader[1]() as Promise<{ default: TopicNode }>).then((mod) => {
          const node = (mod.default ?? mod) as TopicNode;
          cache.set(themeId, node);
          return node;
        })
      : Promise.resolve(null).then((empty) => {
          cache.set(themeId, empty);
          return empty;
        });

    loadPromises.set(themeId, promise);
  }

  return loadPromises.get(themeId)!;
}

export async function loadAllTopicHierarchies(): Promise<TopicHierarchyMap> {
  const map: TopicHierarchyMap = {};
  for (const [path, loader] of Object.entries(topicModules)) {
    const themeId = themeIdFromPath(path);
    if (!themeId) continue;
    const mod = await loader() as { default: TopicNode };
    const node = (mod.default ?? mod) as TopicNode;
    map[themeId] = node;
    cache.set(themeId, node);
  }
  return map;
}

export function getCachedTopicHierarchy(themeId: string): TopicNode | null {
  return cache.get(themeId) ?? null;
}

export function countTopicNodes(node: TopicNode | null): number {
  if (!node) return 0;
  let count = 1;
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      count += countTopicNodes(child);
    }
  }
  return count;
}

export function flattenTopicNodes(node: TopicNode | null, depth: number = 0): Array<{ node: TopicNode; depth: number }> {
  if (!node) return [];
  const result: Array<{ node: TopicNode; depth: number }> = [{ node, depth }];
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      result.push(...flattenTopicNodes(child, depth + 1));
    }
  }
  return result;
}

/**
 * Перевіряє чи питання відноситься до конкретного вузла теми.
 * Порівнює ЛИШЕ текст питання та правильну відповідь — неправильні
 * варіанти ігноруються, щоб уникнути хибних збігів.
 */
export function questionMatchesTopicNode(question: Question, node: TopicNode): boolean {
  const correctAnswer = question.options[question.correctIndex] ?? '';
  const relevantText = (question.text + ' ' + correctAnswer).toLowerCase();

  const nodeTitle = node.title.toLowerCase();
  if (nodeTitle.length > 2 && relevantText.includes(nodeTitle)) {
    return true;
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      const childTitle = child.title.toLowerCase();
      if (childTitle.length > 2 && relevantText.includes(childTitle)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Рахує кількість питань, що відносяться до вузла теми.
 * Для кореневого вузла — повертає загальну кількість питань теми.
 * Для дочірніх вузлів — рахує лише ті питання, що відповідають
 * вузлу за текстом питання або правильною відповіддю.
 */
export function countQuestionsForTopicNode(
  node: TopicNode,
  questions: Question[],
  isRoot: boolean = false,
): number {
  if (isRoot) {
    return questions.length;
  }
  return questions.filter(q => questionMatchesTopicNode(q, node)).length;
}
