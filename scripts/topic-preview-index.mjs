#!/usr/bin/env node
/**
 * Індекс ієрархії тем + лічильники питань для AI Launcher.
 *
 * npm run topic-preview-index -- --write --json
 */

import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { THEME_IDS } from './lib/themes-config.mjs';
import { loadAllDbQuestions } from './lib/question-db.mjs';
import { isAggregateNode } from './lib/topic-generate.mjs';
import {
  assignQuestionsToNodes,
  buildSubtreeCounts,
  flattenHierarchyNodes,
  isExtensionBranchId,
  loadCategoriesMap,
} from './lib/topic-question-counts.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const MERGED_PATH = join(ROOT, 'data', 'topics-db', 'topics-db.json');
const OUT_PATH = join(ROOT, 'data', 'topic-preview-index.json');

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    write: args.includes('--write'),
    json: args.includes('--json'),
  };
}

async function loadAllQuestions() {
  const byId = new Map();
  try {
    const { ALL_QUESTIONS } = await import('../src/data/questions.ts');
    for (const q of ALL_QUESTIONS) {
      byId.set(q.id, q);
    }
  } catch {
    // embedded unavailable
  }
  for (const q of loadAllDbQuestions()) {
    byId.set(q.id, q);
  }
  return [...byId.values()];
}

function loadMergedRoot() {
  if (!fs.existsSync(MERGED_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(MERGED_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function collectAllNodes(root) {
  return flattenHierarchyNodes(root, 0, [], 'topics-db');
}

function questionsForHierarchy(hierarchy, allQuestions) {
  const themeId =
    hierarchy.themeId && THEME_IDS.includes(hierarchy.themeId)
      ? hierarchy.themeId
      : resolveRootTheme(hierarchy);

  if (themeId) {
    return allQuestions.filter(
      (q) => q.themeId === themeId || q.topicNodeId,
    );
  }
  return allQuestions;
}

function resolveRootTheme(node) {
  if (node.themeId && THEME_IDS.includes(node.themeId)) return node.themeId;
  for (const ch of node.children || []) {
    const t = resolveRootTheme(ch);
    if (t) return t;
  }
  return null;
}

function buildIndex(root, allQuestions) {
  const flat = collectAllNodes(root);
  const scopeIds = new Set(flat.map((f) => f.node.id));
  const categories = loadCategoriesMap();
  const relevant = allQuestions.filter(
    (q) => !q.topicNodeId || scopeIds.has(q.topicNodeId),
  );
  const { directCounts, untagged } = assignQuestionsToNodes(
    relevant,
    root,
    scopeIds,
    categories,
  );
  const subtreeCounts = buildSubtreeCounts(flat, directCounts);

  const nodes = [];
  for (const { node, depth, path } of flat) {
    if (isAggregateNode(node)) continue;
    const direct = directCounts[node.id] || 0;
    const subtree = subtreeCounts[node.id] || 0;
    nodes.push({
      id: node.id,
      title: node.title,
      description: node.description || '',
      icon: node.icon || '📖',
      depth,
      path,
      themeId: node.themeId || null,
      isExtension: isExtensionBranchId(node.id),
      isAggregate: false,
      childCount: (node.children || []).length,
      directCount: direct,
      subtreeCount: subtree,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    source: MERGED_PATH,
    totalNodes: nodes.length,
    totalQuestions: allQuestions.length,
    untaggedCount: untagged,
    nodes,
  };
}

async function main() {
  const opts = parseArgs();
  const root = loadMergedRoot();
  if (!root) {
    const err = {
      ok: false,
      error: 'Не знайдено data/topics-db/topics-db.json — запустіть Merge topics-db',
    };
    if (opts.json) process.stdout.write(`${JSON.stringify(err)}\n`);
    else console.error('❌', err.error);
    process.exit(1);
  }

  const allQuestions = await loadAllQuestions();
  const index = buildIndex(root, allQuestions);
  const payload = { ok: true, ...index };

  if (opts.write) {
    fs.writeFileSync(OUT_PATH, JSON.stringify(index, null, 2), 'utf8');
  }

  if (opts.json) {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
  } else {
    console.log(`✅ Вузлів: ${index.totalNodes}, питань: ${index.totalQuestions}, без тегу: ${index.untaggedCount}`);
    if (opts.write) console.log(`   → ${OUT_PATH}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
