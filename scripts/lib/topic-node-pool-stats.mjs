/**
 * Pool sizes per topic leaf × difficulty (mirrors src/data/questions.ts node filtering).
 */

import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  DIFFICULTIES,
  THEME_IDS,
  GROUPS,
  loadTopicHierarchy,
  loadCovenantExtensionsFile,
  findNodeById,
  resolveHierarchyForNode,
} from './themes-config.mjs';
import { loadThemeQuestions } from './question-db.mjs';
import { STAGE_COUNT_BY_DIFFICULTY, stagesPossibleFromPool } from './practice-config.mjs';
import {
  practiceGap,
  requiredQuestionsForNode,
  isPracticeReady,
  getPracticeStageCount,
} from './practice-stage-config.mjs';

import { isSpecificSubtopicNodeId, themeHasOwnHierarchyFile } from './topic-context.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const EMBEDDED_FILES = [
  join(ROOT, 'src/data/questions.ts'),
  join(ROOT, 'src/data/questions-extra.ts'),
];
const EMBEDDED_TAGS_FILE = join(ROOT, 'data/question-topic-tags.json');

function loadEmbeddedTopicTags() {
  if (!fs.existsSync(EMBEDDED_TAGS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(EMBEDDED_TAGS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function loadEmbeddedQuestionsForTheme(themeId) {
  const tags = loadEmbeddedTopicTags();
  const result = [];
  const diffPattern = DIFFICULTIES.join('|');

  for (const filePath of EMBEDDED_FILES) {
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, 'utf8');
    const re = new RegExp(`q\\('${themeId}',\\s*'(${diffPattern})',\\s*(\\d+)`, 'g');
    let match;
    while ((match = re.exec(content))) {
      const difficulty = match[1];
      const id = `${themeId}-${difficulty}-${match[2]}`;
      const tag = tags[id];
      result.push({
        id,
        themeId,
        difficulty,
        topicNodeId: tag?.topicNodeId,
      });
    }
  }
  return result;
}

export function loadQuestionsForTheme(themeId) {
  const ai = loadThemeQuestions(themeId);
  const embedded = loadEmbeddedQuestionsForTheme(themeId);
  const byId = new Map();
  for (const q of embedded) byId.set(q.id, q);
  for (const q of ai) byId.set(q.id, q);
  return [...byId.values()];
}

/** Same rules as filterQuestionsByHierarchy(..., includeParentNodes=false, includeChildNodes=false). */
export function filterQuestionsForNode(questions, nodeId, hierarchy) {
  const targetNode = findNodeById(hierarchy, nodeId);
  if (!targetNode) return [];

  const relevantNodeIds = new Set([nodeId]);
  const rootThemeId = targetNode.themeId ?? hierarchy.id;
  const themeUsesNodeTags = questions.some(
    (q) => q.themeId === rootThemeId && q.topicNodeId != null,
  );

  if (themeUsesNodeTags) {
    return questions.filter(
      (q) => q.topicNodeId != null && relevantNodeIds.has(q.topicNodeId),
    );
  }

  const relevantThemeIds = new Set([rootThemeId, hierarchy.id]);
  return questions.filter((q) => relevantThemeIds.has(q.themeId));
}

export function countNodePool(nodeId, hierarchy, themeId, difficulty) {
  const resolved = hierarchy && findNodeById(hierarchy, nodeId)
    ? { hierarchy, themeId }
    : resolveHierarchyForNode(nodeId, themeId);
  if (!resolved.hierarchy) return 0;

  const questions = loadQuestionsForTheme(resolved.themeId);
  const pool = filterQuestionsForNode(questions, nodeId, resolved.hierarchy);
  return pool.filter((q) => q.difficulty === difficulty).length;
}

export function collectLeafNodes(hierarchy, themeId, path = [], out = []) {
  const children = hierarchy.children ?? [];
  if (children.length === 0) {
    if (!hierarchy.aggregateThemeIds?.length) {
      out.push({
        nodeId: hierarchy.id,
        title: hierarchy.title,
        description: hierarchy.description || '',
        themeId,
        path: [...path, hierarchy.title],
      });
    }
    return out;
  }
  for (const child of children) {
    collectLeafNodes(child, themeId, [...path, hierarchy.title], out);
  }
  return out;
}

/** Листові підтеми з data/topics-db/extensions/{covenant}.json */
export function collectExtensionLeafNodes(covenantFilter = null) {
  const covenants = covenantFilter ? [covenantFilter] : GROUPS.map((g) => g.id);
  const leaves = [];

  for (const covenantId of covenants) {
    const ext = loadCovenantExtensionsFile(covenantId);
    for (const branch of ext.branches || []) {
      const storageThemeId = branch.themeId || covenantId;
      collectLeafNodes(branch, storageThemeId, [], leaves);
    }
  }
  return leaves;
}

export function collectAllLeafNodes(themeFilter = null, covenantFilter = null) {
  const leaves = [];
  const seenNodeIds = new Set();

  if (!covenantFilter) {
    const themes = (themeFilter ? [themeFilter] : THEME_IDS).filter(themeHasOwnHierarchyFile);
    for (const themeId of themes) {
      const hierarchy = loadTopicHierarchy(themeId);
      if (!hierarchy) continue;
      for (const leaf of collectLeafNodes(hierarchy, themeId)) {
        if (seenNodeIds.has(leaf.nodeId)) continue;
        seenNodeIds.add(leaf.nodeId);
        leaves.push(leaf);
      }
    }
  }

  for (const leaf of collectExtensionLeafNodes(covenantFilter)) {
    if (themeFilter && leaf.themeId !== themeFilter) continue;
    if (seenNodeIds.has(leaf.nodeId)) continue;
    seenNodeIds.add(leaf.nodeId);
    leaves.push(leaf);
  }

  return leaves;
}

/**
 * @param {{ theme?: string, covenant?: string, node?: string, difficulty?: string, minGap?: number }} filter
 */
export function collectNodePracticeGaps(filter = {}) {
  let leaves = collectAllLeafNodes(
    filter.covenant ? null : (filter.theme ?? null),
    filter.covenant ?? null,
  );
  if (filter.node) leaves = leaves.filter((l) => l.nodeId === filter.node);

  const diffs =
    filter.difficulty && DIFFICULTIES.includes(filter.difficulty)
      ? [filter.difficulty]
      : DIFFICULTIES;
  const minGap = filter.minGap ?? 1;
  const gaps = [];

  for (const leaf of leaves) {
    const { hierarchy, themeId } = resolveHierarchyForNode(leaf.nodeId, leaf.themeId);
    if (!hierarchy) continue;

    for (const difficulty of diffs) {
      const pool = countNodePool(leaf.nodeId, hierarchy, themeId, difficulty);
      if (isPracticeReady(pool, difficulty, leaf.nodeId)) continue;
      const gap = practiceGap(pool, difficulty, leaf.nodeId);
      if (gap < minGap) continue;
      gaps.push({
        themeId,
        nodeId: leaf.nodeId,
        title: leaf.title,
        path: leaf.path,
        difficulty,
        pool,
        required: requiredQuestionsForNode(leaf.nodeId, difficulty),
        stages: getPracticeStageCount(leaf.nodeId, difficulty),
        possible: stagesPossibleFromPool(pool),
        gap,
      });
    }
  }

  return gaps.sort((a, b) => b.gap - a.gap);
}

export function summarizeNodeGaps(gaps) {
  return {
    totalGap: gaps.reduce((s, g) => s + g.gap, 0),
    jobCount: gaps.length,
    leafCount: new Set(gaps.map((g) => g.nodeId)).size,
  };
}
