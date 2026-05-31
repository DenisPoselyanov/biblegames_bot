import type { TopicNode, TopicHierarchyMap } from '../types';
import { getThemeIdsByCategory } from './categories';

const mergedLoader = import.meta.glob('../../data/topics-db/topics-db.json');

const perThemeLoaders = import.meta.glob('../../data/topics-db/*.json');

const cache = new Map<string, TopicNode | null>();
let loadedMap: TopicHierarchyMap | null = null;
let loadPromise: Promise<TopicHierarchyMap> | null = null;

function buildMapFromRoot(root: TopicNode): TopicHierarchyMap {
  const map: TopicHierarchyMap = {};
  const children = root.children ?? [];
  for (const child of children) {
    map[child.id] = child;
    cache.set(child.id, child);
  }
  // Корінь topics-db.json (bible-topics) — лише контейнер для СЗ/НЗ, не окрема тема.
  if (children.length === 0 && root.id) {
    map[root.id] = root;
    cache.set(root.id, root);
  }
  return map;
}

async function loadMergedFile(): Promise<TopicHierarchyMap> {
  if (loadedMap) return loadedMap;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const entry = Object.entries(mergedLoader).find(([path]) =>
        path.endsWith('topics-db.json'),
      );
      if (entry) {
        const mod = (await entry[1]()) as { default: TopicNode };
        const root = mod.default ?? (mod as unknown as TopicNode);
        loadedMap = buildMapFromRoot(root);
        return loadedMap;
      }
      throw new Error('topics-db.json not in bundle');
    } catch (error) {
      console.error('Failed to load topics-db.json, using fallback:', error);
      const fallback = buildFallbackHierarchies();
      loadedMap = fallback;
      return fallback;
    } finally {
      loadPromise = null;
    }
  })();

  return loadPromise;
}

export async function loadTopicHierarchy(themeId: string): Promise<TopicNode | null> {
  if (cache.has(themeId)) return cache.get(themeId)!;

  const map = await loadMergedFile();
  const direct = map[themeId];
  if (direct) {
    cache.set(themeId, direct);
    return direct;
  }

  for (const root of Object.values(map)) {
    if (root.id === themeId || root.themeId === themeId) {
      cache.set(themeId, root);
      return root;
    }
    const found = findNodeByThemeId(root, themeId);
    if (found && !found.aggregateThemeIds?.length) {
      cache.set(themeId, found);
      return found;
    }
  }

  try {
    const entry = Object.entries(perThemeLoaders).find(([path]) => {
      const match = path.match(/\/([^/]+)\.json$/);
      return match?.[1] === themeId && !path.endsWith('topics-db.json');
    });
    if (entry) {
      const mod = (await entry[1]()) as { default: TopicNode };
      const node = mod.default ?? (mod as unknown as TopicNode);
      propagateThemeId(node, node.id);
      cache.set(themeId, node);
      return node;
    }
  } catch {
    // not found
  }

  cache.set(themeId, null);
  return null;
}

export async function loadAllTopicHierarchies(): Promise<TopicHierarchyMap> {
  return loadMergedFile();
}

export function getCachedTopicHierarchy(themeId: string): TopicNode | null {
  return cache.get(themeId) ?? null;
}

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

function propagateThemeId(node: TopicNode, themeId: string): void {
  node.themeId = themeId;
  for (const child of node.children ?? []) {
    propagateThemeId(child, themeId);
  }
}

function buildFallbackHierarchies(): TopicHierarchyMap {
  const map: TopicHierarchyMap = {};

  const otGroup: TopicNode = {
    id: 'old-testament',
    title: 'Старий Завіт',
    description: 'Перша частина Біблії, яка описує створення світу та історію ізраїльського народу.',
    icon: '📜',
    children: [
      {
        id: 'ot-all',
        title: 'Усі питання з цієї теми',
        description: 'Всі питання зі Старого Завіту',
        icon: '📚',
        themeId: 'old-testament',
        aggregateThemeIds: getThemeIdsByCategory('old-testament'),
        children: [],
      },
      { id: 'pentateuch', themeId: 'pentateuch', title: 'Пятикнижжя', description: 'П\'ять книг Тори', icon: '📜', children: [] },
      { id: 'patriarchs', themeId: 'patriarchs', title: 'Патріархи', description: 'Авраам, Ісак, Яків та Йосиф', icon: '🏕️', children: [] },
      { id: 'judges', themeId: 'judges', title: 'Судді', description: 'Гедеон, Самсон, Девора та інші', icon: '⚔️', children: [] },
      { id: 'kings', themeId: 'kings', title: 'Царі', description: 'Давид, Соломон та царства Ізраїля', icon: '👑', children: [] },
      { id: 'wisdom-poetry', themeId: 'wisdom-poetry', title: 'Мудрість і поезія', description: 'Job, Псалми, Приповісті', icon: '📖', children: [] },
      { id: 'prophets', themeId: 'prophets', title: 'Пророки', description: 'Ісая, Єремія, Ілля та інші', icon: '🔥', children: [] },
      { id: 'mosaic-law', themeId: 'mosaic-law', title: 'Закон Мойсея', description: 'Заповіді, устави та святині', icon: '⚖️', children: [] },
      { id: 'commandments', themeId: 'commandments', title: 'Десять заповідей', description: 'Божий закон на Синаї', icon: '📋', children: [] },
      { id: 'geography', themeId: 'geography', title: 'Географія Старого Завіту', description: 'Місця та регіони СЗ', icon: '🗺️', children: [] },
    ],
  };

  const ntGroup: TopicNode = {
    id: 'new-testament',
    title: 'Новий Завіт',
    description: 'Друга частина Біблії, яка описує життя Ісуса Христа та народження християнської церкви.',
    icon: '✝️',
    children: [
      {
        id: 'nt-all',
        title: 'Усі питання з цієї теми',
        description: 'Всі питання з Нового Завіту',
        icon: '📚',
        themeId: 'new-testament',
        aggregateThemeIds: getThemeIdsByCategory('new-testament'),
        children: [],
      },
      { id: 'gospels', themeId: 'gospels', title: 'Євангелія', description: 'Життя, слова та чудеса Ісуса', icon: '📖', children: [] },
      { id: 'acts', themeId: 'acts', title: 'Дії апостолів', description: 'Народження церкви та місії', icon: '🔥', children: [] },
      { id: 'paul', themeId: 'paul', title: 'Апостол Павло', description: 'Подорожі, листи та служіння', icon: '✉️', children: [] },
      { id: 'general-epistles', themeId: 'general-epistles', title: 'Загальні послання', description: 'Євреї, Яків, Петро, Іван', icon: '📬', children: [] },
      { id: 'revelation', themeId: 'revelation', title: 'Відкриття', description: 'Апокаліпсис та останні події', icon: '🌅', children: [] },
      { id: 'geography-nt', themeId: 'geography-nt', title: 'Географія Нового Завіту', description: 'Місця Ісуса та апостолів', icon: '🗺️', children: [] },
      { id: 'parables', themeId: 'parables', title: 'Притчі', description: 'Притчі Ісуса Христа', icon: '🌾', children: [] },
      { id: 'miracles', themeId: 'miracles', title: 'Чудеса Ісуса', description: 'Зцілення, воскресіння та знамення', icon: '✨', children: [] },
    ],
  };

  map['old-testament'] = otGroup;
  map['new-testament'] = ntGroup;
  cache.set('old-testament', otGroup);
  cache.set('new-testament', ntGroup);

  return map;
}
