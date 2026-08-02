import type { TopicNode } from '../types';
import { createTopicHierarchyLoader } from './topicDbLoader.core';

export * from './topicDbLoader.shared';

/** Vite replaces import.meta.glob at build time — must not be behind a runtime typeof check. */
const mergedTopics = import.meta.glob('../../data/topics-db/topics-db.json', {
  eager: true,
  import: 'default',
}) as Record<string, TopicNode>;

const perThemeLoaders = import.meta.glob('../../data/topics-db/*.json');

const loader = createTopicHierarchyLoader({
  async loadRoot() {
    return Object.values(mergedTopics)[0] ?? null;
  },
  async loadThemeFile(themeId) {
    const entry = Object.entries(perThemeLoaders).find(([path]) => {
      const normalized = path.replace(/\\/g, '/');
      const match = normalized.match(/\/([^/]+)\.json$/);
      return match?.[1] === themeId && match[1] !== 'topics-db';
    });
    if (!entry) return null;
    const mod = (await entry[1]()) as { default: TopicNode };
    return mod.default ?? (mod as unknown as TopicNode);
  },
});

export const { loadTopicHierarchy, loadAllTopicHierarchies, getCachedTopicHierarchy } = loader;
