import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOPICS_DIR = join(__dirname, '../../data/topics-db');

/** Єдиний список тем (синхронізовано з src/data/themes.ts) */
export const THEMES = [
  // ---- Старий Завіт ----
  { id: 'old-testament', title: 'Старий Завіт', category: 'old-testament', context: 'Події та постаті ВЗ: Авраам, Мойсей, Давид, пророки, закон.' },
  { id: 'mosaic-law', title: 'Закон Мойсея', category: 'old-testament', context: 'Заповіді, скинія, жертви, святі дні, устави Тори.' },
  { id: 'judges', title: 'Судді', category: 'old-testament', context: 'Судді Ізраїля: Гедеон, Самсон, Девора, Єфта та ін.' },
  { id: 'kings', title: 'Царі', category: 'old-testament', context: 'Царі Ізраїля та Юдеї: Саул, Давид, Соломон, розкол царств.' },
  { id: 'prophets', title: 'Пророки', category: 'old-testament', context: 'Пророки ВЗ і їх пророцтва: Ісая, Єремія, Ілля, Даниїл.' },
  { id: 'psalms', title: 'Псалми', category: 'old-testament', context: 'Псалми, поклоніння, Давид, храмова поезія.' },
  { id: 'patriarchs', title: 'Патріархи', category: 'old-testament', context: 'Патріархи: Авраам, Ісак, Яків, Йосиф.' },
  { id: 'geography', title: 'Географія', category: 'old-testament', context: 'Місця, річки, гори, міста, країни Святого Письма. Точні біблійні факти.' },
  { id: 'commandments', title: 'Десять заповідень', category: 'old-testament', context: 'Десять заповідь, Закон на Синаї, їх зміст.' },
  // ---- Новий Завіт ----
  { id: 'new-testament', title: 'Новий Завіт', category: 'new-testament', context: 'Церква, апостоли, вчення, раннє християнство.' },
  { id: 'gospels', title: 'Євангелія', category: 'new-testament', context: 'Життя, слова, чудеса, смерть і воскресіння Ісуса Христа.' },
  { id: 'paul', title: 'Апостол Павло', category: 'new-testament', context: 'Подорожі, листи, навернення, служіння апостола Павла.' },
  { id: 'parables', title: 'Притчі', category: 'new-testament', context: 'Притчі Ісуса Христа та їх значення.' },
  { id: 'miracles', title: 'Чудеса Ісуса', category: 'new-testament', context: 'Чудеса Ісуса: зцілення, воскресіння, природа.' },
  { id: 'revelation', title: 'Відкриття', category: 'new-testament', context: 'Книга Одкровення, символи, церкви, останні події.' },
];

/** Групи (агреговані ієрархії) — синхронізовано з src/data/categories.ts */
export const GROUPS = [
  {
    id: 'old-testament',
    title: 'Старий Завіт',
    description: 'Перша частина Біблії, яка описує створення світу, історію ізраїльського народу та Божий закон.',
    icon: '📜',
    themeIds: ['old-testament', 'mosaic-law', 'judges', 'kings', 'prophets', 'psalms', 'patriarchs', 'geography', 'commandments'],
  },
  {
    id: 'new-testament',
    title: 'Новий Завіт',
    description: 'Друга частина Біблії, яка описує життя Ісуса Христа та народження християнської церкви.',
    icon: '✝️',
    themeIds: ['new-testament', 'gospels', 'paul', 'parables', 'miracles', 'revelation'],
  },
];

export const DIFFICULTIES = ['baby', 'child', 'youth', 'student', 'preacher', 'teacher', 'theologian'];

export const THEME_IDS = THEMES.map((t) => t.id);

export function getTheme(id) {
  return THEMES.find((t) => t.id === id);
}

export function getGroup(id) {
  return GROUPS.find((g) => g.id === id);
}

/** Завантажити ієрархію тем з topics-db */
export function loadTopicHierarchy(themeId) {
  const path = join(TOPICS_DIR, `${themeId}.json`);
  if (!fs.existsSync(path)) return null;
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/** Спростити дерево в плоский список { node, depth } */
export function flattenTopicNodes(node, depth = 0) {
  if (!node) return [];
  const result = [{ node, depth }];
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      result.push(...flattenTopicNodes(child, depth + 1));
    }
  }
  return result;
}

/** Знайти вузол у дереві за id (будь-якої глибини) */
export function findNodeById(node, targetId) {
  if (!node) return null;
  if (node.id === targetId) return node;
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      const found = findNodeById(child, targetId);
      if (found) return found;
    }
  }
  return null;
}

/** Побудувати шлях до вузла: ["Завіт", "Тема", "Підтема", ...] */
export function buildNodePath(node, targetId, path = []) {
  if (!node) return null;
  const current = [...path, node.title];
  if (node.id === targetId) return current;
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      const result = buildNodePath(child, targetId, current);
      if (result) return result;
    }
  }
  return null;
}

/** Отримати повний контекст вузла для промпту */
export function getTopicContext(groupId, themeId, topicNodeId) {
  const group = getGroup(groupId);
  const theme = getTheme(themeId);

  // Спершу пробуємо завантажити груповий файл, потім — індивідуальний
  let root = loadTopicHierarchy(groupId);
  let topicNode = null;

  if (root && topicNodeId) {
    topicNode = findNodeById(root, topicNodeId);
  }

  if (!topicNode && themeId) {
    root = loadTopicHierarchy(themeId);
    if (root && topicNodeId) {
      topicNode = findNodeById(root, topicNodeId);
    }
  }

  if (!topicNode && root) {
    topicNode = root;
  }

  const path = topicNode && root ? buildNodePath(root, topicNode.id) : [];

  return {
    group,
    theme,
    node: topicNode,
    path: path || [],
    title: topicNode?.title || theme?.title || '',
    description: topicNode?.description || theme?.context || '',
  };
}

/** Зібрати всі доступні topic node id з усіх файлів */
export function getAllTopicNodes() {
  const nodes = [];
  const files = fs.existsSync(TOPICS_DIR)
    ? fs.readdirSync(TOPICS_DIR).filter((f) => f.endsWith('.json'))
    : [];

  for (const file of files) {
    const fileId = file.replace('.json', '');
    const root = loadTopicHierarchy(fileId);
    if (root) {
      nodes.push(...flattenTopicNodes(root));
    }
  }

  return nodes;
}
