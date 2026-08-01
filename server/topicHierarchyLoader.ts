import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TopicNode, TopicHierarchyMap } from '../src/types/index';
import {
  buildFallbackHierarchies,
  findNodeByThemeId,
  propagateThemeId,
  seedFallbackTopicCache,
} from '../src/data/topicDbLoader.shared';

const topicsDbDir = join(dirname(fileURLToPath(import.meta.url)), '../data/topics-db');

function readTopicJsonFile(fileName: string): TopicNode | null {
  const path = join(topicsDbDir, fileName);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as TopicNode;
  } catch {
    return null;
  }
}

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
      const root = readTopicJsonFile('topics-db.json');
      if (root) {
        loadedMap = buildMapFromRoot(root);
        return loadedMap;
      }
      throw new Error('topics-db.json not found on disk');
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
    const node = readTopicJsonFile(`${themeId}.json`);
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

export async function loadAllTopicHierarchies(): Promise<TopicHierarchyMap> {
  return loadMergedFile();
}

export function getCachedTopicHierarchy(themeId: string): TopicNode | null {
  return cache.get(themeId) ?? null;
}
