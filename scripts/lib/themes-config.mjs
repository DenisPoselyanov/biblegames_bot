import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOPICS_DIR = join(__dirname, '../../data/topics-db');

/** Єдиний список тем (синхронізовано з src/data/themes.ts) */
export const THEMES = [
  // ---- Старий Завіт ----
  { id: 'old-testament', title: 'Старий Завіт', category: 'old-testament', context: 'Події та постаті ВЗ: Авраам, Мойсей, Давид, пророки, закон.' },
  { id: 'pentateuch', title: 'Пятикнижжя', category: 'old-testament', context: 'П\'ять книг Тори: Буття, Вихід, Левит, Числа, Повторення Закону.' },
  { id: 'patriarchs', title: 'Патріархи', category: 'old-testament', context: 'Патріархи: Авраам, Ісак, Яків, Йосиф.' },
  { id: 'judges', title: 'Судді', category: 'old-testament', context: 'Судді Ізраїля: Гедеон, Самсон, Девора, Єфта; також Йошуа та Рут.' },
  { id: 'kings', title: 'Царі', category: 'old-testament', context: 'Царі Ізраїля та Юдеї: Саул, Давид, Соломон; також Ездра, Неемія, Естер.' },
  { id: 'wisdom-poetry', title: 'Мудрість і поезія', category: 'old-testament', context: 'Job, Псалми, Приповісті, Еклesiаст, Пісня над піснями.' },
  { id: 'prophets', title: 'Пророки', category: 'old-testament', context: 'Пророки ВЗ: великі (Ісая, Єремія, Єзекіїль, Даниїл) та малі (12 книг).' },
  { id: 'mosaic-law', title: 'Закон Мойсея', category: 'old-testament', context: 'Заповіді, скинія, жертви, святі дні, устави Тори.' },
  { id: 'commandments', title: 'Десять заповідень', category: 'old-testament', context: 'Десять заповідь, Закон на Синаї, їх зміст.' },
  { id: 'geography', title: 'Географія Старого Завіту', category: 'old-testament', context: 'Місця, річки, гори та регіони Старого Завіту. Точні біблійні факти.' },
  // ---- Новий Завіт ----
  { id: 'new-testament', title: 'Новий Завіт', category: 'new-testament', context: 'Церква, апостоли, вчення, раннє християнство.' },
  { id: 'gospels', title: 'Євангелія', category: 'new-testament', context: 'Життя, слова, чудеса, смерть і воскресіння Ісуса Христа.' },
  { id: 'acts', title: 'Дії апostолів', category: 'new-testament', context: 'П\'ятдесятниця, Петро, Павло, місії, ранній храм, Рим.' },
  { id: 'paul', title: 'Апостол Павло', category: 'new-testament', context: 'Подорожі, листи, навернення, служіння апостола Павла.' },
  { id: 'general-epistles', title: 'Загальні послання', category: 'new-testament', context: 'Євреї, Яків, 1–2 Петра, 1–3 Івана, Юда.' },
  { id: 'revelation', title: 'Відкриття', category: 'new-testament', context: 'Книга Одкровення, символи, церкви, останні події.' },
  { id: 'parables', title: 'Притчі', category: 'new-testament', context: 'Притчі Ісуса Христа та їх значення.' },
  { id: 'miracles', title: 'Чудеса Ісуса', category: 'new-testament', context: 'Чудеса Ісуса: зцілення, воскресіння, природа.' },
  { id: 'geography-nt', title: 'Географія Нового Завіту', category: 'new-testament', context: 'Місця Ісуса, апостолів, місій та ранньої церкви. Точні біблійні факти.' },
];

/** Групи (агреговані ієрархії) — синхронізовано з src/data/categories.ts */
export const GROUPS = [
  {
    id: 'old-testament',
    title: 'Старий Завіт',
    description: 'Перша частина Біблії, яка описує створення світу, історію ізраїльського народу та Божий закон.',
    icon: '📜',
    themeIds: ['old-testament', 'pentateuch', 'patriarchs', 'judges', 'kings', 'wisdom-poetry', 'prophets', 'mosaic-law', 'commandments', 'geography'],
  },
  {
    id: 'new-testament',
    title: 'Новий Завіт',
    description: 'Друга частина Біблії, яка описує життя Ісуса Христа та народження християнської церкви.',
    icon: '✝️',
    themeIds: ['new-testament', 'gospels', 'acts', 'paul', 'general-epistles', 'revelation', 'geography-nt', 'parables', 'miracles'],
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
let mergedTopicsCache = null;

function loadMergedTopicsRoot() {
  if (mergedTopicsCache) return mergedTopicsCache;
  const mergedPath = join(TOPICS_DIR, 'topics-db.json');
  if (!fs.existsSync(mergedPath)) return null;
  try {
    mergedTopicsCache = JSON.parse(fs.readFileSync(mergedPath, 'utf8'));
    return mergedTopicsCache;
  } catch {
    return null;
  }
}

export function loadTopicHierarchy(themeId) {
  const filePath = join(TOPICS_DIR, `${themeId}.json`);
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      return null;
    }
  }
  const merged = loadMergedTopicsRoot();
  if (!merged) return null;
  return findNodeById(merged, themeId);
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

const EXTENSIONS_DIR = join(TOPICS_DIR, 'extensions');

/** Завантажити кастомні гілки завіту */
export function loadCovenantExtensionsFile(covenantId) {
  const p = join(EXTENSIONS_DIR, `${covenantId}.json`);
  if (!fs.existsSync(p)) return { covenantId, branches: [] };
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    return { covenantId, branches: data.branches || [] };
  } catch {
    return { covenantId, branches: [] };
  }
}

/** Знайти вузол у extensions усіх завітів */
export function findNodeInCovenantExtensions(topicId) {
  for (const gid of GROUPS.map((g) => g.id)) {
    const ext = loadCovenantExtensionsFile(gid);
    for (const branch of ext.branches) {
      const node = findNodeById(branch, topicId);
      if (node) return { node, root: branch, covenantId: gid, source: 'extensions' };
    }
  }
  return null;
}

/** Пошук вузла topic у file / merged / extensions */
export function findTopicNodeGlobally(topicId) {
  const extHit = findNodeInCovenantExtensions(topicId);
  if (extHit) return extHit;

  for (const file of THEME_IDS) {
    const root = loadTopicHierarchy(file);
    if (!root) continue;
    const node = findNodeById(root, topicId);
    if (node) return { node, root, covenantId: null, source: file };
  }

  const mergedRoot = loadTopicHierarchy('topics-db');
  if (mergedRoot) {
    const node = findNodeById(mergedRoot, topicId);
    if (node) return { node, root: mergedRoot, covenantId: null, source: 'topics-db' };
  }

  return null;
}
