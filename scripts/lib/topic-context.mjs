/**
 * Спільна логіка підтем для AI-скриптів (генерація, аналіз, правка).
 */

import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  DIFFICULTIES,
  findTopicNodeGlobally,
  loadTopicHierarchy,
  buildNodePath,
} from './themes-config.mjs';
import { loadThemeQuestions, loadAllDbQuestions } from './question-db.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const TOPICS_DIR = join(ROOT, 'data/topics-db');
const EMBEDDED_TAGS_FILE = join(ROOT, 'data/question-topic-tags.json');
const EMBEDDED_FILES = [
  join(ROOT, 'src/data/questions.ts'),
  join(ROOT, 'src/data/questions-extra.ts'),
];

/** Тема має власний файл ієрархії (не лише merged topics-db). */
export function themeHasOwnHierarchyFile(themeId) {
  if (!themeId || themeId === 'topics-db') return false;
  return fs.existsSync(join(TOPICS_DIR, `${themeId}.json`));
}

/** Підтема = вузол у дереві, але не корінь теми/групи. */
export function isSpecificSubtopicNodeId(nodeId) {
  if (!String(nodeId ?? '').trim()) return false;
  const hit = findTopicNodeGlobally(nodeId);
  if (!hit?.node || !hit.root) return false;
  if (hit.node.id === hit.root.id) return false;
  return true;
}

/** themeId JSON-файлу для збереження питань вузла. */
export function resolveStorageThemeId(nodeId) {
  const hit = findTopicNodeGlobally(nodeId);
  if (!hit) return null;
  if (hit.source && themeHasOwnHierarchyFile(hit.source)) return hit.source;
  if (hit.node.themeId && themeHasOwnHierarchyFile(hit.node.themeId)) return hit.node.themeId;
  return hit.source ?? null;
}

/** Контекст підтеми для промптів і звітів. */
export function resolveSubtopicContext(nodeId) {
  if (!nodeId) return null;
  const hit = findTopicNodeGlobally(nodeId);
  if (!hit?.node || !hit.root) return null;

  const path = buildNodePath(hit.root, nodeId) ?? [hit.node.title];
  const themeId = resolveStorageThemeId(nodeId) ?? hit.node.themeId ?? hit.source ?? null;

  return {
    nodeId,
    themeId,
    title: hit.node.title,
    description: hit.node.description || '',
    path,
    pathStr: path.join(' > '),
    isSubtopic: isSpecificSubtopicNodeId(nodeId),
  };
}

export function resolveSubtopicContextFromQuestion(question) {
  if (!question?.topicNodeId) return null;
  const ctx = resolveSubtopicContext(question.topicNodeId);
  if (!ctx) return null;
  return {
    ...ctx,
    topicPath: question.topicPath ?? ctx.pathStr,
  };
}

/** Блок промпту: підтема + складність. */
export function buildSubtopicPromptBlock(context, difficulty = null) {
  if (!context) return '';
  const diffLine = difficulty ? `\nСкладність: ${difficulty}` : '';
  return `Підтема: ${context.title}
Шлях: ${context.pathStr}
Контекст підтеми: ${context.description || '(немає опису)'}${diffLine}

ВАЖЛИВО: питання СТРОГО про цю підтему. Не включай факти з інших розділів теми. Уникай дублікатів у межах цієї підтеми та складності.`;
}

function loadEmbeddedTopicTags() {
  if (!fs.existsSync(EMBEDDED_TAGS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(EMBEDDED_TAGS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function loadEmbeddedQuestions() {
  const tags = loadEmbeddedTopicTags();
  const result = [];
  const diffPattern = DIFFICULTIES.join('|');

  for (const filePath of EMBEDDED_FILES) {
    if (!fs.existsSync(filePath)) continue;
    const isExtra = filePath.includes('questions-extra');
    const content = fs.readFileSync(filePath, 'utf8');
    const re = new RegExp(`q\\('([^']+)',\\s*'(${diffPattern})',\\s*(\\d+)`, 'g');
    let match;
    while ((match = re.exec(content))) {
      const themeId = match[1];
      const difficulty = match[2];
      const id = isExtra
        ? `${themeId}-${difficulty}-x${match[3]}`
        : `${themeId}-${difficulty}-${match[3]}`;
      const tag = tags[id];
      result.push({
        id,
        themeId,
        difficulty,
        topicNodeId: tag?.topicNodeId,
        topicPath: tag?.topicPath,
        _source: 'embedded',
      });
    }
  }
  return result;
}

/** Усі питання (embedded + AI) з тегами підтем. */
export function loadAllQuestionsMerged() {
  const byId = new Map();
  for (const q of loadEmbeddedQuestions()) byId.set(q.id, q);
  for (const q of loadAllDbQuestions()) {
    byId.set(q.id, { ...q, _source: 'db' });
  }
  return [...byId.values()];
}

/** Лише питання з валідною підтемою. */
export function loadSubtopicQuestionsOnly() {
  return loadAllQuestionsMerged().filter((q) => isSpecificSubtopicNodeId(q.topicNodeId));
}

export function matchesSubtopicFilter(question, filter = {}) {
  if (!isSpecificSubtopicNodeId(question?.topicNodeId)) {
    return filter.includeUntagged === true;
  }
  if (filter.node && question.topicNodeId !== filter.node) return false;
  if (filter.theme && question.themeId !== filter.theme) return false;
  if (filter.difficulty && question.difficulty !== filter.difficulty) return false;
  return true;
}

export function filterQuestionsBySubtopic(questions, filter = {}) {
  return questions.filter((q) => matchesSubtopicFilter(q, filter));
}

export function parseSubtopicCliArgs(argv) {
  const args = argv ?? process.argv.slice(2);
  const filter = { theme: null, node: null, difficulty: null, includeUntagged: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--theme' && args[i + 1]) filter.theme = args[++i];
    else if (args[i] === '--node' && args[i + 1]) filter.node = args[++i];
    else if (args[i] === '--topic' && args[i + 1]) filter.node = args[++i];
    else if (args[i] === '--difficulty' && args[i + 1]) filter.difficulty = args[++i];
    else if (args[i] === '--include-untagged') filter.includeUntagged = true;
  }
  return filter;
}

export function assertSubtopicNodeId(nodeId, label = 'topicNodeId') {
  if (!isSpecificSubtopicNodeId(nodeId)) {
    throw new Error(
      `${label} має вказувати на конкретну підтему (не корінь теми). Приклад: --topic pentateuch-sub-1-sub-1`,
    );
  }
}
