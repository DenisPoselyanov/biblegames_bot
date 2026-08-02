import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TopicNode } from '../src/types/index';
import { createTopicHierarchyLoader } from '../src/data/topicDbLoader.core';

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

const loader = createTopicHierarchyLoader({
  async loadRoot() {
    return readTopicJsonFile('topics-db.json');
  },
  async loadThemeFile(themeId) {
    return readTopicJsonFile(`${themeId}.json`);
  },
});

export const { loadTopicHierarchy, loadAllTopicHierarchies, getCachedTopicHierarchy } = loader;
