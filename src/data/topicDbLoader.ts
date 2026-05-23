import type { TopicNode, TopicHierarchyMap } from '../types';
import { getThemeIdsByCategory } from './categories';

const useFetchFallback = true;

const cache = new Map<string, TopicNode | null>();
let loadedMap: TopicHierarchyMap | null = null;

async function loadMergedFile(): Promise<TopicHierarchyMap> {
  if (loadedMap) return loadedMap;

  const map: TopicHierarchyMap = {};

  try {
    const response = await fetch('/data/topics-db/topics-db.json');
    if (!response.ok) throw new Error(`Failed to load topics-db.json: ${response.status}`);
    const root = await response.json() as TopicNode;
    for (const child of root.children ?? []) {
      map[child.id] = child;
      cache.set(child.id, child);
    }
    loadedMap = map;
    return map;
  } catch (error) {
    console.error('Failed to load topics-db.json, using fallback:', error);
    const fallback = buildFallbackHierarchies();
    loadedMap = fallback;
    return fallback;
  }
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
    if (found) {
      cache.set(themeId, found);
      return found;
    }
  }

  if (useFetchFallback) {
    try {
      const response = await fetch(`/data/topics-db/${themeId}.json`);
      if (response.ok) {
        const node = await response.json() as TopicNode;
        propagateThemeId(node, node.id);
        cache.set(themeId, node);
        return node;
      }
    } catch {
      // not found
    }
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

export function findNodeByThemeId(root: TopicNode, targetThemeId: string): TopicNode | null {
  if (root.themeId === targetThemeId || root.id === targetThemeId) return root;
  for (const child of root.children ?? []) {
    const found = findNodeByThemeId(child, targetThemeId);
    if (found) return found;
  }
  return null;
}

export function findRootByThemeId(hierarchies: TopicHierarchyMap, themeId: string): TopicNode | null {
  if (hierarchies[themeId]) return hierarchies[themeId];
  for (const root of Object.values(hierarchies)) {
    for (const child of root.children ?? []) {
      if (child.id === themeId || child.themeId === themeId) return child;
    }
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
      { id: 'mosaic-law', themeId: 'mosaic-law', title: 'Закон Мойсея', description: 'Заповіді, устави та святині', icon: '⚖️', children: [] },
      { id: 'judges', themeId: 'judges', title: 'Судді', description: 'Гедеон, Самсон, Девора та інші', icon: '⚔️', children: [] },
      { id: 'kings', themeId: 'kings', title: 'Царі', description: 'Давид, Соломон та царства Ізраїля', icon: '👑', children: [] },
      { id: 'prophets', themeId: 'prophets', title: 'Пророки', description: 'Ісая, Єремія, Ілля та інші', icon: '🔥', children: [] },
      { id: 'psalms', themeId: 'psalms', title: 'Псалми', description: 'Псалми Давида та поклоніння', icon: '🎵', children: [] },
      { id: 'patriarchs', themeId: 'patriarchs', title: 'Патріархи', description: 'Авраам, Ісак, Яків та Йосиф', icon: '🏕️', children: [] },
      { id: 'geography', themeId: 'geography', title: 'Географія', description: 'Місця, річки та країни Святого Письма', icon: '🗺️', children: [] },
      { id: 'commandments', themeId: 'commandments', title: 'Десять заповідей', description: 'Божий закон на Синаї', icon: '📋', children: [] },
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
      { id: 'paul', themeId: 'paul', title: 'Апостол Павло', description: 'Подорожі, листи та служіння', icon: '✉️', children: [] },
      { id: 'parables', themeId: 'parables', title: 'Притчі', description: 'Притчі Ісуса Христа', icon: '🌾', children: [] },
      { id: 'miracles', themeId: 'miracles', title: 'Чудеса Ісуса', description: 'Зцілення, воскресіння та знамення', icon: '✨', children: [] },
      { id: 'revelation', themeId: 'revelation', title: 'Відкриття', description: 'Апокаліпсис та останні події', icon: '🌅', children: [] },
    ],
  };

  map['old-testament'] = otGroup;
  map['new-testament'] = ntGroup;
  cache.set('old-testament', otGroup);
  cache.set('new-testament', ntGroup);

  return map;
}
