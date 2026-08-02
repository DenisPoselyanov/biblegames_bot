import type { TopicNode, TopicHierarchyMap } from '../types';
import {
  buildFallbackHierarchies,
  findNodeByThemeId,
  propagateThemeId,
  seedFallbackTopicCache,
} from './topicDbLoader.shared';

export interface TopicDbSource {
  loadRoot(): Promise<TopicNode | null>;
  loadThemeFile(themeId: string): Promise<TopicNode | null>;
}

/** Platform-agnostic caching core shared by the Vite (client) and fs (server) topic-hierarchy loaders. */
export function createTopicHierarchyLoader(source: TopicDbSource) {
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
        const root = await source.loadRoot();
        if (root) {
          loadedMap = buildMapFromRoot(root);
          return loadedMap;
        }
        throw new Error('topics-db.json not found');
      } catch (error) {
        console.error('Failed to load topics-db.json, using fallback:', error);
        const fallback = buildFallbackHierarchies();
        seedFallbackTopicCache(fallback, cache);
        loadedMap = fallback;
        return fallback;
      } finally {
        loadPromise = null;
      }
    })();

    return loadPromise;
  }

  async function loadTopicHierarchy(themeId: string): Promise<TopicNode | null> {
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
      const node = await source.loadThemeFile(themeId);
      if (node) {
        propagateThemeId(node, themeId);
        cache.set(themeId, node);
        return node;
      }
    } catch {
      // not found
    }

    cache.set(themeId, null);
    return null;
  }

  async function loadAllTopicHierarchies(): Promise<TopicHierarchyMap> {
    return loadMergedFile();
  }

  function getCachedTopicHierarchy(themeId: string): TopicNode | null {
    return cache.get(themeId) ?? null;
  }

  return { loadTopicHierarchy, loadAllTopicHierarchies, getCachedTopicHierarchy };
}
