/**
 * Heuristic matching of questions to topic hierarchy nodes.
 */

export function flattenTopicTitles(node, prefix = '') {
  const results = [];
  const fullPath = prefix ? `${prefix} > ${node.title}` : node.title;
  results.push({
    id: node.id,
    title: node.title,
    fullPath,
    description: node.description || '',
  });
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      results.push(...flattenTopicTitles(child, fullPath));
    }
  }
  return results;
}

export function findNodeById(node, id) {
  if (!node) return null;
  if (node.id === id) return node;
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      const found = findNodeById(child, id);
      if (found) return found;
    }
  }
  return null;
}

export function questionMatchesTopicNode(question, node) {
  const correctAnswer = question.options?.[question.correctIndex] ?? '';
  const relevantText = `${question.text || ''} ${correctAnswer}`.toLowerCase();

  const nodeTitle = (node.title || '').toLowerCase();
  if (nodeTitle.length > 2 && relevantText.includes(nodeTitle)) {
    return true;
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      const childTitle = (child.title || '').toLowerCase();
      if (childTitle.length > 2 && relevantText.includes(childTitle)) {
        return true;
      }
    }
  }

  return false;
}

/** Returns matched node ids (includes hierarchy root id). */
export function matchTopicIdsForQuestion(question, hierarchy) {
  const matched = [hierarchy.id];
  const flat = flattenTopicTitles(hierarchy);
  for (const entry of flat) {
    if (entry.id === hierarchy.id) continue;
    const node = findNodeById(hierarchy, entry.id);
    if (node && questionMatchesTopicNode(question, node)) {
      matched.push(entry.id);
    }
  }
  return matched;
}

/** Pick deepest matched node id (for single assignment). */
export function deepestMatchedNodeId(ids, hierarchy) {
  if (!ids?.length) return null;
  let best = ids[0];
  let bestDepth = -1;
  for (const id of ids) {
    const depth = nodeDepthInTree(hierarchy, id);
    if (depth > bestDepth) {
      bestDepth = depth;
      best = id;
    }
  }
  return best;
}

/** Title path from hierarchy root to target node. */
export function buildNodePath(root, targetId, path = []) {
  const current = [...path, root.title];
  if (root.id === targetId) return current;
  for (const child of root.children || []) {
    const result = buildNodePath(child, targetId, current);
    if (result) return result;
  }
  return null;
}

export function nodeDepthInTree(root, targetId, depth = 0) {
  if (!root) return -1;
  if (root.id === targetId) return depth;
  for (const child of root.children || []) {
    const d = nodeDepthInTree(child, targetId, depth + 1);
    if (d >= 0) return d;
  }
  return -1;
}
