/**
 * Question counts per topic node (topicNodeId, categories, heuristic).
 */

import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { THEME_IDS, loadTopicHierarchy } from './themes-config.mjs';
import { loadThemeQuestions, loadAllDbQuestions } from './question-db.mjs';
import {
  matchTopicIdsForQuestion,
  deepestMatchedNodeId,
} from './topic-match.mjs';
import { isAggregateNode } from './topic-generate.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
export const CATEGORIES_FILE = join(ROOT, 'data', 'question-categories.json');

export function loadCategoriesMap() {
  if (!fs.existsSync(CATEGORIES_FILE)) return new Map();
  try {
    const data = JSON.parse(fs.readFileSync(CATEGORIES_FILE, 'utf8'));
    const map = new Map();
    for (const q of data.questions || []) {
      if (q.id && Array.isArray(q.topicIds)) {
        map.set(q.id, q.topicIds);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

export function resolveThemeIdForNode(node) {
  if (node.themeId && THEME_IDS.includes(node.themeId)) return node.themeId;
  if (node.aggregateThemeIds?.length) {
    const hit = node.aggregateThemeIds.find((id) => THEME_IDS.includes(id));
    if (hit) return hit;
  }
  return null;
}

/** Assign each question to deepest matching node id in scope */
export function assignQuestionsToNodes(questions, hierarchy, scopeIds, categories = null) {
  const cats = categories ?? loadCategoriesMap();
  const directCounts = Object.fromEntries([...scopeIds].map((id) => [id, 0]));
  let untagged = 0;

  for (const q of questions) {
    let assigned = null;

    if (q.topicNodeId && scopeIds.has(q.topicNodeId)) {
      assigned = q.topicNodeId;
    } else if (cats.has(q.id)) {
      const ids = cats.get(q.id).filter((id) => scopeIds.has(id));
      assigned = ids.length ? deepestMatchedNodeId(ids, hierarchy) : null;
    } else {
      const matched = matchTopicIdsForQuestion(q, hierarchy).filter((id) => scopeIds.has(id));
      assigned = matched.length ? deepestMatchedNodeId(matched, hierarchy) : null;
    }

    if (assigned && scopeIds.has(assigned)) {
      directCounts[assigned] = (directCounts[assigned] || 0) + 1;
    } else if (!q.topicNodeId) {
      untagged++;
    }
  }

  return { directCounts, untagged };
}

export function collectSubtreeIds(node, set = new Set()) {
  if (!node?.id) return set;
  set.add(node.id);
  for (const ch of node.children || []) collectSubtreeIds(ch, set);
  return set;
}

export function buildSubtreeCounts(flatNodes, directCounts) {
  const byId = new Map(flatNodes.map((n) => [n.node.id, n]));
  const subtreeCounts = {};

  function subtreeSum(id) {
    if (subtreeCounts[id] != null) return subtreeCounts[id];
    let sum = directCounts[id] || 0;
    const entry = byId.get(id);
    if (entry?.node?.children) {
      for (const ch of entry.node.children) {
        sum += subtreeSum(ch.id);
      }
    }
    subtreeCounts[id] = sum;
    return sum;
  }

  for (const { node } of flatNodes) subtreeSum(node.id);
  return subtreeCounts;
}

export function countQuestionsForScope(scopeNodes, hierarchy, themeId, questions = null) {
  const scopeIds = new Set(scopeNodes.map((n) => n.id));
  const qs =
    questions ??
    (themeId ? loadThemeQuestions(themeId) : []);
  const { directCounts, untagged } = assignQuestionsToNodes(qs, hierarchy, scopeIds);
  return {
    counts: directCounts,
    untagged,
    totalQuestions: qs.length,
  };
}

export function flattenHierarchyNodes(root, depth = 0, path = [], fileId = '') {
  const result = [];
  const currentPath = [...path, root.title];
  result.push({
    node: root,
    depth,
    path: currentPath.join(' > '),
    fileId,
  });
  for (const ch of root.children || []) {
    result.push(...flattenHierarchyNodes(ch, depth + 1, currentPath, fileId));
  }
  return result;
}

export function isExtensionBranchId(id) {
  return /^ot-custom-|^nt-custom-/.test(String(id || ''));
}
