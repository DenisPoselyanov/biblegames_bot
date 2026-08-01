import type { TopicNode, TopicHierarchyMap } from '../types';

export function findNodeById(root: TopicNode, targetId: string): TopicNode | null {
  if (root.id === targetId) return root;
  for (const child of root.children ?? []) {
    const found = findNodeById(child, targetId);
    if (found) return found;
  }
  return null;
}

export function findParentNode(root: TopicNode, targetId: string): TopicNode | null {
  if (root.id === targetId) return null;
  for (const child of root.children ?? []) {
    if (child.id === targetId) return root;
    const found = findParentNode(child, targetId);
    if (found) return found;
  }
  return null;
}

function findNodePath(node: TopicNode, targetId: string, ancestors: string[] = []): string[] | null {
  if (node.id === targetId) {
    return [...ancestors, node.id];
  }
  for (const child of node.children ?? []) {
    const found = findNodePath(child, targetId, [...ancestors, node.id]);
    if (found) return found;
  }
  return null;
}

export function buildBrowseState(
  hierarchies: Record<string, TopicNode>,
  targetId: string,
): { activeId: string; history: string[] } | null {
  for (const root of Object.values(hierarchies)) {
    const path = findNodePath(root, targetId);
    if (path && path.length > 0) {
      return {
        activeId: targetId,
        history: path.slice(0, -1),
      };
    }
  }
  return null;
}

export function findNodeByThemeId(root: TopicNode, targetThemeId: string): TopicNode | null {
  if (root.id === targetThemeId) return root;

  for (const child of root.children ?? []) {
    const found = findNodeByThemeId(child, targetThemeId);
    if (found) return found;
  }

  if (root.themeId === targetThemeId && !root.aggregateThemeIds?.length) {
    return root;
  }

  return null;
}

export function findRootByThemeId(hierarchies: TopicHierarchyMap, themeId: string): TopicNode | null {
  if (hierarchies[themeId]) return hierarchies[themeId];
  for (const root of Object.values(hierarchies)) {
    if (root.id === themeId || root.themeId === themeId) return root;
    for (const child of root.children ?? []) {
      if (child.id === themeId || child.themeId === themeId) return child;
    }
    const deep = findNodeByThemeId(root, themeId);
    if (deep) return deep;
  }
  return null;
}

export function countTopicNodes(node: TopicNode | null): number {
  if (!node) return 0;
  let count = 1;
  for (const child of node.children ?? []) {
    count += countTopicNodes(child);
  }
  return count;
}

export function flattenTopicNodes(node: TopicNode | null, depth: number = 0): Array<{ node: TopicNode; depth: number }> {
  if (!node) return [];
  const result: Array<{ node: TopicNode; depth: number }> = [{ node, depth }];
  for (const child of node.children ?? []) {
    result.push(...flattenTopicNodes(child, depth + 1));
  }
  return result;
}

function collectSubtreeNodeIds(node: TopicNode, ids: Set<string>): void {
  ids.add(node.id);
  for (const child of node.children ?? []) {
    collectSubtreeNodeIds(child, ids);
  }
}

export function countQuestionsForTopicNode(
  node: TopicNode,
  questions: Array<{ id: string; themeId: string; topicNodeId?: string }>,
): number {
  if (node.aggregateThemeIds && node.aggregateThemeIds.length > 0) {
    const themeIds = new Set(node.aggregateThemeIds);
    const seen = new Set<string>();
    for (const q of questions) {
      if (themeIds.has(q.themeId)) seen.add(q.id);
    }
    return seen.size;
  }

  const subtreeIds = new Set<string>();
  collectSubtreeNodeIds(node, subtreeIds);

  const withNodeId = questions.filter(
    (q) => q.topicNodeId && subtreeIds.has(q.topicNodeId),
  );
  if (withNodeId.length > 0) {
    const seen = new Set<string>();
    for (const q of withNodeId) {
      seen.add(q.id);
    }
    return seen.size;
  }

  if (node.children && node.children.length > 0) {
    let total = 0;
    for (const child of node.children) {
      total += countQuestionsForTopicNode(child, questions);
    }
    return total;
  }

  const themeId = node.themeId ?? node.id;
  return questions.filter(
    (q) => !q.topicNodeId && q.themeId === themeId,
  ).length;
}

export function propagateThemeId(node: TopicNode, themeId: string): void {
  node.themeId = themeId;
  for (const child of node.children ?? []) {
    propagateThemeId(child, themeId);
  }
}

export function buildFallbackHierarchies(): TopicHierarchyMap {
  const map: TopicHierarchyMap = {};

  const otGroup: TopicNode = {
    id: 'old-testament',
    title: 'Старий Завіт',
    description: 'Перша частина Біблії, яка описує створення світу та історію ізраїльського народу.',
    icon: '📜',
    children: [
      { id: 'pentateuch', themeId: 'pentateuch', title: 'Пятикнижжя', description: 'П\'ять книг Тори', icon: '📜', children: [] },
      { id: 'judges', themeId: 'judges', title: 'Судді', description: 'Гедеон, Самсон, Девора та інші', icon: '⚔️', children: [] },
      { id: 'kings', themeId: 'kings', title: 'Царі', description: 'Давид, Соломон та царства Ізраїля', icon: '👑', children: [] },
      { id: 'prophets', themeId: 'prophets', title: 'Пророки', description: 'Ісая, Єремія, Ілля та інші', icon: '🔥', children: [] },
      { id: 'wisdom-poetry', themeId: 'wisdom-poetry', title: 'Мудрість і поезія', description: 'Йов, Псалми, Приповісті', icon: '📖', children: [] },
      { id: 'geography', themeId: 'geography', title: 'Географія Старого Завіту', description: 'Місця та регіони СЗ', icon: '🗺️', children: [] },
    ],
  };

  const ntGroup: TopicNode = {
    id: 'new-testament',
    title: 'Новий Завіт',
    description: 'Друга частина Біблії, яка описує життя Ісуса Христа та народження християнської церкви.',
    icon: '✝️',
    children: [
      { id: 'gospels', themeId: 'gospels', title: 'Євангелія', description: 'Життя, слова та чудеса Ісуса', icon: '📖', children: [] },
      { id: 'parables', themeId: 'parables', title: 'Притчі', description: 'Притчі Ісуса Христа', icon: '🌾', children: [] },
      { id: 'miracles', themeId: 'miracles', title: 'Чудеса Ісуса', description: 'Зцілення, воскресіння та знамення', icon: '✨', children: [] },
      { id: 'acts', themeId: 'acts', title: 'Дії апостолів', description: 'Народження церкви та місії', icon: '🔥', children: [] },
      { id: 'paul', themeId: 'paul', title: 'Апостол Павло', description: 'Подорожі, листи та служіння', icon: '✉️', children: [] },
      { id: 'general-epistles', themeId: 'general-epistles', title: 'Загальні послання', description: 'Євреї, Яків, Петро, Іван', icon: '📬', children: [] },
      { id: 'revelation', themeId: 'revelation', title: 'Відкриття', description: 'Апокаліпсис та останні події', icon: '🌅', children: [] },
      { id: 'geography-nt', themeId: 'geography-nt', title: 'Географія Нового Завіту', description: 'Місця Ісуса та апостолів', icon: '🗺️', children: [] },
    ],
  };

  map['old-testament'] = otGroup;
  map['new-testament'] = ntGroup;

  return map;
}

export function seedFallbackTopicCache(
  map: TopicHierarchyMap,
  cache: Map<string, TopicNode | null>,
): void {
  const ot = map['old-testament'];
  const nt = map['new-testament'];
  if (ot) cache.set('old-testament', ot);
  if (nt) cache.set('new-testament', nt);
}
