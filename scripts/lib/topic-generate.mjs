/**
 * Спільна логіка генерації підтем для topics-db (конвеєр, ai-topic-edit).
 */

import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getTheme, getGroup } from './themes-config.mjs';
import { defaultAiOpts, extractJson, extractJsonArray, queryLLM } from './llm.mjs';
import {
  findSimilarEntries,
  filterUniqueCandidates,
  formatAvoidList,
  buildUniquenessResult,
  BORDERLINE_LOW,
  DEFAULT_THRESHOLD_TITLE,
} from './topic-similarity.mjs';

const { provider: DEFAULT_PROVIDER, model: DEFAULT_MODEL } = defaultAiOpts();

const __dirname = dirname(fileURLToPath(import.meta.url));
export const TOPICS_DIR = join(__dirname, '..', '..', 'data', 'topics-db');

export function topicsPath(fileId) {
  return join(TOPICS_DIR, `${fileId}.json`);
}

export function loadTree(fileId) {
  const p = topicsPath(fileId);
  if (!fs.existsSync(p)) {
    throw new Error(`Файл не знайдено: ${p}`);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

export function saveTree(fileId, data) {
  fs.writeFileSync(topicsPath(fileId), JSON.stringify(data, null, 2), 'utf8');
}

export function backupTree(fileId) {
  const src = topicsPath(fileId);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dest = `${src}.${stamp}.bak`;
  fs.copyFileSync(src, dest);
  return dest;
}

export function findNode(root, targetId) {
  if (root.id === targetId) return { parent: null, node: root, index: -1 };
  function walk(node, parent) {
    if (!node.children) return null;
    for (let i = 0; i < node.children.length; i++) {
      if (node.children[i].id === targetId) {
        return { parent: node, node: node.children[i], index: i };
      }
      const found = walk(node.children[i], node);
      if (found) return found;
    }
    return null;
  }
  return walk(root, null);
}

export function buildPath(root, targetId, acc = []) {
  const current = [...acc, root.title];
  if (root.id === targetId) return current;
  if (root.children) {
    for (const c of root.children) {
      const r = buildPath(c, targetId, current);
      if (r) return r;
    }
  }
  return null;
}

export function isAggregateNode(node) {
  if (!node) return false;
  if (node.aggregateThemeIds?.length) return true;
  const id = String(node.id || '');
  return id.endsWith('-all') || id.endsWith('-all-questions');
}

/** Зібрати всі id у дереві */
export function collectIds(node, set = new Set()) {
  if (!node) return set;
  if (node.id) set.add(node.id);
  for (const ch of node.children || []) collectIds(ch, set);
  return set;
}

function existingSubIndices(parentId, root) {
  const re = new RegExp(`^${escapeRegExp(parentId)}-sub-(\\d+)`);
  const nums = [];
  for (const id of collectIds(root)) {
    const m = id.match(re);
    if (m) nums.push(parseInt(m[1], 10));
  }
  return nums;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Призначити id: {parentId}-sub-N (узгоджено з judges-sub-1-sub-1) */
export function assignSequentialIds(parentNode, rawNodes, root, themeId) {
  const parentId = parentNode.id;
  const used = new Set(collectIds(root));
  const baseNums = existingSubIndices(parentId === themeId ? themeId : parentId, root);
  let nextNum = baseNums.length ? Math.max(...baseNums) + 1 : 1;

  return rawNodes.map((ch) => {
    const prefix = parentId === themeId ? themeId : parentId;
    let id = `${prefix}-sub-${nextNum}`;
    while (used.has(id)) {
      nextNum++;
      id = `${prefix}-sub-${nextNum}`;
    }
    used.add(id);
    nextNum++;

    return {
      id,
      title: String(ch.title || 'Підтема').trim(),
      description: String(ch.description || '').trim(),
      icon: String(ch.icon || '📖').trim(),
      children: [],
      themeId,
    };
  });
}

export function normalizeNodes(rawNodes, parentNode, root, themeId) {
  if (!Array.isArray(rawNodes) || rawNodes.length === 0) {
    throw new Error('Порожня відповідь AI');
  }
  const mapped = rawNodes.map((ch) => ({
    title: ch.title,
    description: ch.description,
    icon: ch.icon,
    children: [],
  }));
  return assignSequentialIds(parentNode, mapped, root, themeId);
}

const CONTAINER_THEMES = new Set(['old-testament', 'new-testament']);

export function flattenTopicCatalog(node, pathPrefix = '') {
  const path = pathPrefix ? `${pathPrefix} > ${node.title}` : node.title;
  const items = [{
    id: node.id,
    title: node.title,
    description: node.description || '',
    path,
  }];
  for (const ch of node.children || []) {
    items.push(...flattenTopicCatalog(ch, path));
  }
  return items;
}

export function collectCovenantBranchCatalog(covenantId) {
  const catalog = [];
  const group = getGroup(covenantId);
  const ext = loadCovenantExtensions(covenantId);

  for (const branch of ext.branches || []) {
    catalog.push({
      id: branch.id,
      title: branch.title,
      description: branch.description || '',
      path: `${group?.title || covenantId} > 🌿 ${branch.title}`,
    });
    for (const sub of flattenTopicCatalog(branch, `${group?.title || covenantId} > ${branch.title}`)) {
      if (sub.id !== branch.id) catalog.push(sub);
    }
  }

  for (const tid of group?.themeIds || []) {
    if (CONTAINER_THEMES.has(tid)) continue;
    const theme = getTheme(tid);
    if (theme) {
      catalog.push({
        id: tid,
        title: theme.title,
        description: theme.context || '',
        path: group.title,
      });
    }
    try {
      const tree = loadTree(tid);
      for (const ch of tree.children || []) {
        if (!isAggregateNode(ch)) {
          catalog.push({
            id: ch.id,
            title: ch.title,
            description: ch.description || '',
            path: `${theme?.title || tid} > ${ch.title}`,
          });
        }
      }
    } catch {
      // file missing
    }
  }

  return catalog;
}

export function collectSiblingCatalog(parentNode, root, covenantId = null) {
  const catalog = [];
  const found = findNode(root, parentNode.id);
  const parent = found?.parent;
  const siblings = parent?.children || root.children || [];
  for (const sib of siblings) {
    if (sib.id === parentNode.id) continue;
    if (isAggregateNode(sib)) continue;
    catalog.push({
      id: sib.id,
      title: sib.title,
      description: sib.description || '',
      path: buildPath(root, sib.id)?.join(' > ') || sib.title,
    });
  }
  for (const ch of parentNode.children || []) {
    catalog.push({
      id: ch.id,
      title: ch.title,
      description: ch.description || '',
      path: buildPath(root, ch.id)?.join(' > ') || ch.title,
    });
  }
  if (covenantId) {
    const cov = collectCovenantBranchCatalog(covenantId);
    for (const e of cov.slice(0, 15)) catalog.push(e);
  }
  return catalog;
}

function existingBlock(catalog, max = 28) {
  if (!catalog?.length) return '';
  const list = formatAvoidList(catalog.slice(0, max), max);
  return `\nВже існують (НЕ повторюй і не перефразовуй близько):\n${list}\n`;
}

function avoidBlock(avoidTitles) {
  if (!avoidTitles?.length) return '';
  return `\nУникай цих назв (були дублікати): ${avoidTitles.join('; ')}\n`;
}

async function verifyUniqueWithAI(candidate, catalog, model, provider) {
  const sample = catalog.slice(0, 20).map((e) => e.title).join(', ');
  const prompt = `Чи є "${candidate.title}" дублікатом або дуже близькою до будь-якої з тем: ${sample}?
Відповідь JSON: {"duplicate":true|false,"similarTo":"назва або null"}`;
  try {
    const raw = await queryLLM(prompt, {
      model,
      provider,
      temperature: 0.1,
      format: 'json',
      numPredict: 80,
      timeoutMs: 45000,
    });
    const parsed = extractJson(raw);
    if (parsed?.duplicate) {
      return {
        duplicate: true,
        similarTo: { title: parsed.similarTo || '?', score: 50 },
      };
    }
  } catch {
    // ignore
  }
  return { duplicate: false };
}

export async function generateWithUniquenessGuard(generateFn, catalog, options = {}) {
  const {
    model = DEFAULT_MODEL,
    provider = DEFAULT_PROVIDER,
    avoidTitles = [],
    maxRetries = 2,
    verifyBorderline = true,
  } = options;

  let retries = 0;
  let allWarnings = [];
  let lastResult = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const extraAvoid = attempt > 0
      ? allWarnings.map((w) => w.title || w.similarTo?.title).filter(Boolean)
      : [];
    const mergedAvoid = [...avoidTitles, ...extraAvoid];

    lastResult = await generateFn({ avoidTitles: mergedAvoid, attempt });

    if (lastResult?.title && !lastResult?.length) {
      const { similarTo } = findSimilarEntries(lastResult, catalog);
      if (similarTo.length) {
        const top = similarTo[0];
        const score = top.score / 100;
        if (score >= BORDERLINE_LOW && score < DEFAULT_THRESHOLD_TITLE && verifyBorderline) {
          const v = await verifyUniqueWithAI(lastResult, catalog, model, provider);
          if (v.duplicate) {
            allWarnings.push({
              title: lastResult.title,
              similarTo: v.similarTo || top,
            });
            retries++;
            continue;
          }
        }
        if (score >= DEFAULT_THRESHOLD_TITLE) {
          allWarnings.push({ title: lastResult.title, similarTo: top });
          retries++;
          continue;
        }
      }
      return {
        result: lastResult,
        uniqueness: buildUniquenessResult({ warnings: allWarnings, retries }),
      };
    }

    const nodes = Array.isArray(lastResult) ? lastResult : [];
    const { unique, warnings, filteredCount } = filterUniqueCandidates(nodes, catalog);
    allWarnings.push(...warnings);

    if (unique.length > 0) {
      return {
        result: unique,
        uniqueness: buildUniquenessResult({
          warnings: allWarnings,
          filteredCount,
          retries,
        }),
      };
    }

    retries++;
  }

  if (lastResult?.title) {
    return {
      result: lastResult,
      uniqueness: buildUniquenessResult({ warnings: allWarnings, retries }),
    };
  }

  throw new Error(
    'AI повторно запропонувала теми, схожі на наявні. Змініть ідею або вкажіть назву вручну.',
  );
}

function buildGeneratePrompt(parentNode, count, root, themeId, covenantId, catalog = [], avoidTitles = []) {
  const pth = buildPath(root, parentNode.id);
  const theme = getTheme(themeId);
  const group = covenantId ? getGroup(covenantId) : null;
  const pathStr = pth ? pth.join(' > ') : parentNode.title;
  const covenantCtx = group
    ? `Завіт: ${group.title}. ${group.description || ''}`
    : '';
  const themeCtx = theme ? `Тема файлу: ${theme.title}. ${theme.context || ''}` : '';

  const idHint =
    parentNode.id === themeId
      ? `id формат: "${themeId}-sub-1", "${themeId}-sub-2" (унікальні, не повторюй існуючі)`
      : `id формат: "${parentNode.id}-sub-1", "${parentNode.id}-sub-2" (унікальні)`;

  return `Ти біблійний експерт. Створи рівно ${count} унікальних підтем для "${parentNode.title}".

${covenantCtx}
${themeCtx}
Контекст шляху: ${pathStr}
Опис батьківського вузла: ${parentNode.description || 'немає'}

Вимоги:
1. Кожна підтема — логічна частина батьківської теми
2. ${idHint}
3. Опис 1 речення, емодзі-іконка
4. children — порожній масив []
5. Без дублікатів назв
${existingBlock(catalog)}${avoidBlock(avoidTitles)}

Відповідай ТІЛЬКИ JSON-масивом:
[{"title":"Назва","description":"Опис","icon":"✝️","children":[]}]`;
}

export async function generateChildNodes(parentNode, count, options = {}) {
  const {
    root,
    themeId,
    covenantId = null,
    provider = DEFAULT_PROVIDER,
    model = DEFAULT_MODEL,
    temperature = 0.5,
    avoidTitles = [],
    skipUniqueness = false,
  } = options;

  if (!root || !themeId) {
    throw new Error('generateChildNodes: потрібні root та themeId');
  }
  if (!count || count < 1) {
    throw new Error('count має бути >= 1');
  }

  const catalog = collectSiblingCatalog(parentNode, root, covenantId);

  const runGenerate = async ({ avoidTitles: extraAvoid = [] }) => {
    const prompt = buildGeneratePrompt(
      parentNode,
      count,
      root,
      themeId,
      covenantId,
      catalog,
      [...avoidTitles, ...extraAvoid],
    );
    const raw = await queryLLM(prompt, { model, provider, temperature });
    const parsed = extractJsonArray(raw);
    return normalizeNodes(parsed, parentNode, root, themeId);
  };

  if (skipUniqueness) {
    const nodes = await runGenerate({});
    return { nodes, uniqueness: buildUniquenessResult() };
  }

  const { result, uniqueness } = await generateWithUniquenessGuard(runGenerate, catalog, {
    model,
    provider,
    avoidTitles,
  });
  return { nodes: result, uniqueness };
}

export function applyChildren(fileId, parentId, nodes, { backup = true } = {}) {
  if (!nodes?.length) {
    throw new Error('Немає вузлів для застосування');
  }
  const root = loadTree(fileId);
  const found = findNode(root, parentId);
  if (!found?.node) {
    throw new Error(`Вузол "${parentId}" не знайдено у ${fileId}.json`);
  }
  const { node } = found;
  if (isAggregateNode(node)) {
    throw new Error('Не можна додавати дітей до aggregate / *-all вузла');
  }
  if (!node.children) node.children = [];

  const existingIds = collectIds(root);
  for (const n of nodes) {
    if (existingIds.has(n.id)) {
      throw new Error(`Id вже існує: ${n.id}`);
    }
  }

  let backupPath = null;
  if (backup) backupPath = backupTree(fileId);

  node.children.push(...nodes);
  saveTree(fileId, root);

  return { backupPath, added: nodes.length, parentId, fileId };
}

/** Прямі діти кореня теми без aggregate */
export function listL1ParentCandidates(root, themeId) {
  const children = root.children || [];
  return children.filter((c) => !isAggregateNode(c));
}

export function defaultL1ParentId(root, themeId) {
  return themeId;
}

// ── Extensions (гілки завіту) ───────────────────────────────────────────────

export const EXTENSIONS_DIR = join(TOPICS_DIR, 'extensions');

export function extensionsPath(covenantId) {
  return join(EXTENSIONS_DIR, `${covenantId}.json`);
}

export function loadCovenantExtensions(covenantId) {
  const p = extensionsPath(covenantId);
  if (!fs.existsSync(p)) {
    return { covenantId, branches: [] };
  }
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!data.branches) data.branches = [];
    data.covenantId = covenantId;
    return data;
  } catch {
    return { covenantId, branches: [] };
  }
}

export function saveCovenantExtensions(covenantId, data) {
  if (!fs.existsSync(EXTENSIONS_DIR)) {
    fs.mkdirSync(EXTENSIONS_DIR, { recursive: true });
  }
  const payload = { covenantId, branches: data.branches || [] };
  fs.writeFileSync(extensionsPath(covenantId), JSON.stringify(payload, null, 2), 'utf8');
}

export function backupCovenantExtensions(covenantId) {
  const src = extensionsPath(covenantId);
  if (!fs.existsSync(src)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dest = `${src}.${stamp}.bak`;
  fs.copyFileSync(src, dest);
  return dest;
}

export function extensionsVirtualRoot(covenantId, ext) {
  return {
    id: covenantId,
    title: covenantId,
    children: ext.branches || [],
  };
}

export function collectAllExtensionIds(ext) {
  const set = new Set();
  for (const b of ext.branches || []) collectIds(b, set);
  return set;
}

export function findNodeInExtensions(ext, targetId) {
  for (const branch of ext.branches || []) {
    if (branch.id === targetId) return { parent: null, node: branch, branchRoot: branch };
    const found = findNode(branch, targetId);
    if (found?.node) return { ...found, branchRoot: branch };
  }
  return null;
}

const CYRILLIC_MAP = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh', з: 'z',
  и: 'y', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p',
  р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'shch', ь: '', ю: 'iu', я: 'ia',
};

export function slugifyTitle(title) {
  let s = String(title || '').trim().toLowerCase();
  let out = '';
  for (const ch of s) {
    if (CYRILLIC_MAP[ch]) out += CYRILLIC_MAP[ch];
    else if (/[a-z0-9]/.test(ch)) out += ch;
    else if (/\s|[-_]/u.test(ch)) out += '-';
  }
  out = out.replace(/-+/g, '-').replace(/^-|-$/g, '');
  return out.slice(0, 48) || 'branch';
}

export function makeUniqueBranchId(covenantId, title, ext) {
  const prefix = covenantId === 'new-testament' ? 'nt-custom' : 'ot-custom';
  const slug = slugifyTitle(title);
  const used = collectAllExtensionIds(ext);
  let id = `${prefix}-${slug}`;
  let n = 2;
  while (used.has(id)) {
    id = `${prefix}-${slug}-${n}`;
    n++;
  }
  return id;
}

export function finalizeBranchNode(covenantId, draft, ext) {
  const title = String(draft.title || 'Нова гілка').trim();
  const id = makeUniqueBranchId(covenantId, title, ext);
  return {
    id,
    title,
    description: String(draft.description || '').trim(),
    icon: String(draft.icon || '📖').trim(),
    themeId: covenantId,
    children: [],
  };
}

export async function generateBranchRoot(
  titleHint,
  covenantId,
  model = DEFAULT_MODEL,
  provider = DEFAULT_PROVIDER,
  options = {},
) {
  const group = getGroup(covenantId);
  const hint = String(titleHint || '').trim();
  const catalog = collectCovenantBranchCatalog(covenantId);
  const { avoidTitles = [], skipUniqueness = false } = options;

  if (hint) {
    const draft = {
      title: hint,
      description: `Тематична гілка «${hint}» у ${group?.title || covenantId}.`,
      icon: '📖',
    };
    const { similarTo } = findSimilarEntries(draft, catalog);
    const uniqueness = buildUniquenessResult({
      warnings: similarTo.length
        ? [{ title: draft.title, similarTo: similarTo[0] }]
        : [],
    });
    return { draft, uniqueness };
  }

  const runGenerate = async ({ avoidTitles: extraAvoid = [] }) => {
    const prompt = `Запропонуй одну нову тематичну гілку для "${group?.title || covenantId}".
${group ? `Контекст: ${group.description}` : ''}
${existingBlock(catalog)}${avoidBlock([...avoidTitles, ...extraAvoid])}

JSON українською: title (2-5 слів), description (1 речення), icon (1 емодзі).`;

    const raw = await queryLLM(prompt, {
      model,
      provider,
      temperature: 0.4,
      format: 'json',
      numCtx: 2048,
      numPredict: 180,
      timeoutMs: 90000,
    });
    if (!String(raw || '').trim()) {
      throw new Error('Порожня відповідь AI — спробуйте іншу модель або вкажіть назву вручну');
    }
    const extracted = extractJson(raw);
    const parsed = Array.isArray(extracted) ? extracted[0] : extracted;
    if (!parsed?.title) throw new Error('AI не повернула назву гілки');
    return {
      title: String(parsed.title).trim(),
      description: String(parsed.description || '').trim(),
      icon: String(parsed.icon || '📖').trim(),
    };
  };

  if (skipUniqueness) {
    const draft = await runGenerate({});
    return { draft, uniqueness: buildUniquenessResult() };
  }

  const { result, uniqueness } = await generateWithUniquenessGuard(runGenerate, catalog, {
    model,
    provider,
    avoidTitles,
  });
  return { draft: result, uniqueness };
}

export function applyBranch(covenantId, draft, { backup = true } = {}) {
  const ext = loadCovenantExtensions(covenantId);
  const node = finalizeBranchNode(covenantId, draft, ext);
  let backupPath = null;
  if (backup) backupPath = backupCovenantExtensions(covenantId);
  ext.branches.push(node);
  saveCovenantExtensions(covenantId, ext);
  return { backupPath, branch: node, covenantId };
}

export async function generateChildNodesInExtensions(parentId, count, covenantId, options = {}) {
  const ext = loadCovenantExtensions(covenantId);
  const found = findNodeInExtensions(ext, parentId);
  if (!found?.node) {
    throw new Error(`Вузол "${parentId}" не знайдено в extensions/${covenantId}.json`);
  }
  if (isAggregateNode(found.node)) {
    throw new Error('Не можна додавати дітей до aggregate / *-all');
  }
  const vroot = extensionsVirtualRoot(covenantId, ext);
  const { nodes, uniqueness } = await generateChildNodes(found.node, count, {
    ...options,
    root: vroot,
    themeId: covenantId,
    covenantId,
  });
  return { nodes, uniqueness };
}

export function applyChildrenToExtensions(covenantId, parentId, nodes, { backup = true } = {}) {
  if (!nodes?.length) throw new Error('Немає вузлів для застосування');
  const ext = loadCovenantExtensions(covenantId);
  const found = findNodeInExtensions(ext, parentId);
  if (!found?.node) {
    throw new Error(`Вузол "${parentId}" не знайдено в extensions/${covenantId}.json`);
  }
  if (isAggregateNode(found.node)) {
    throw new Error('Не можна додавати дітей до aggregate / *-all');
  }
  const used = collectAllExtensionIds(ext);
  for (const n of nodes) {
    if (used.has(n.id)) throw new Error(`Id вже існує: ${n.id}`);
  }
  if (!found.node.children) found.node.children = [];
  let backupPath = null;
  if (backup) backupPath = backupCovenantExtensions(covenantId);
  found.node.children.push(...nodes);
  saveCovenantExtensions(covenantId, ext);
  return { backupPath, added: nodes.length, parentId, covenantId, target: 'extensions' };
}

export function applyChildrenTarget(target, fileOrCovenant, parentId, nodes, opts = {}) {
  if (target === 'extensions') {
    return applyChildrenToExtensions(fileOrCovenant, parentId, nodes, opts);
  }
  return applyChildren(fileOrCovenant, parentId, nodes, opts);
}

export async function previewChildrenTarget(target, fileOrCovenant, parentId, count, options = {}) {
  if (target === 'extensions') {
    const { nodes, uniqueness } = await generateChildNodesInExtensions(
      parentId,
      count,
      fileOrCovenant,
      options,
    );
    return { nodes, uniqueness };
  }
  const root = loadTree(fileOrCovenant);
  const found = findNode(root, parentId);
  if (!found?.node) throw new Error(`Вузол "${parentId}" не знайдено`);
  if (isAggregateNode(found.node)) throw new Error('Неможна генерувати під aggregate / *-all');
  const { nodes, uniqueness } = await generateChildNodes(found.node, count, {
    ...options,
    root,
    themeId: options.themeId || fileOrCovenant,
    covenantId: options.covenantId || null,
  });
  return { nodes, uniqueness };
}
