import type { TopicNode } from '../types';
import { createTopicHierarchyLoader } from './topicDbLoader.core';

export * from './topicDbLoader.shared';

/**
 * Not `eager: true` — `topicDbLoader.ts` is reached via a static import chain
 * from `App.tsx` (`TopicHierarchyContext.tsx`), so an eager glob would inline
 * this 242KB file into the main entry chunk for every route. Deferred to a
 * real async chunk instead, fetched only when `loadRoot()` actually runs
 * (i.e. when `TopicHierarchyProvider` mounts on the Themes route).
 */
const mergedTopicsLoaders = import.meta.glob('../../data/topics-db/topics-db.json');

const perThemeLoaders = import.meta.glob('../../data/topics-db/*.json');

const loader = createTopicHierarchyLoader({
  async loadRoot() {
    const [loadFile] = Object.values(mergedTopicsLoaders);
    if (!loadFile) return null;
    const mod = (await loadFile()) as { default: TopicNode };
    return mod.default ?? (mod as unknown as TopicNode);
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
