#!/usr/bin/env node
/**
 * AI-сортування підгруп по групах на різних рівнях ієрархії тем (Ollama).
 *
 * Що робить:
 *   1. Завантажує ієрархію з data/topics-db/{theme}.json
 *   2. Для кожного не-листового вузла (групи) з ≥2 дітьми (підгрупами):
 *      a) Просить AI відсортувати дітей у теологічно та логічно правильному порядку
 *         (хронологія Біблії → важливість → природний порядок викладу)
 *      b) Якщо --reparent, AI також може запропонувати перенести підгрупу
 *         до іншої групи (під іншу батьківську вузол того ж дерева),
 *         якщо логічно вона належить туди
 *   3. Записує оновлене дерево назад у JSON (зі створенням .bak якщо --backup)
 *
 * Запуск:
 *   npm run sort-topics-ai -- --theme paul
 *   npm run sort-topics-ai -- --all
 *   npm run sort-topics-ai -- --all --reparent      # дозволити переміщення між гілками
 *   npm run sort-topics-ai -- --all --dry-run       # лише показати зміни
 *   npm run sort-topics-ai -- --theme gospels --model llama3.2
 */

import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { THEME_IDS, getTheme } from './lib/themes-config.mjs';
import {
  applyAiCliFlags,
  checkLLM,
  defaultAiOpts,
  extractJson,
  loadProjectEnv,
  providerLabel,
  queryLLM,
  unavailableHint,
} from './lib/llm.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOPICS_DIR = join(__dirname, '..', 'data', 'topics-db');
loadProjectEnv();
const { provider: DEFAULT_PROVIDER, model: DEFAULT_MODEL } = defaultAiOpts();

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    theme: null,
    all: false,
    provider: DEFAULT_PROVIDER,
    model: DEFAULT_MODEL,
    dryRun: false,
    backup: false,
    reparent: false,
    reorderOnly: false,
    maxDepth: 5,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--theme' && args[i + 1]) opts.theme = args[++i];
    else if (args[i] === '--all') opts.all = true;
    else if (args[i] === '--provider' && args[i + 1]) opts.provider = args[++i];
    else if (args[i] === '--model' && args[i + 1]) opts.model = args[++i];
    else if (args[i] === '--dry-run') opts.dryRun = true;
    else if (args[i] === '--backup') opts.backup = true;
    else if (args[i] === '--reparent') opts.reparent = true;
    else if (args[i] === '--reorder-only') opts.reorderOnly = true;
    else if (args[i] === '--max-depth' && args[i + 1]) opts.maxDepth = parseInt(args[++i], 10) || 5;
  }

  if (!opts.all && !opts.theme) {
    console.error('❌ Вкажи --theme <id> або --all');
    console.error('Теми:', THEME_IDS.join(', '));
    process.exit(1);
  }

  applyAiCliFlags(opts, args);
  return opts;
}

function topicsPath(themeId) {
  return join(TOPICS_DIR, `${themeId}.json`);
}

function loadTopicTree(themeId) {
  const p = topicsPath(themeId);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function saveTopicTree(themeId, tree, backup) {
  const p = topicsPath(themeId);
  if (backup && fs.existsSync(p)) {
    fs.copyFileSync(p, `${p}.bak`);
  }
  fs.writeFileSync(p, JSON.stringify(tree, null, 2), 'utf8');
}

function normalizeChildren(node) {
  if (!Array.isArray(node.children)) node.children = [];
}

function countNodes(node) {
  normalizeChildren(node);
  let count = 1;
  for (const c of node.children) count += countNodes(c);
  return count;
}

function* walkNodes(node, depth = 0, parent = null) {
  yield { node, depth, parent };
  normalizeChildren(node);
  for (const child of node.children) {
    yield* walkNodes(child, depth + 1, node);
  }
}

function findNode(tree, predicate) {
  for (const { node, parent } of walkNodes(tree)) {
    if (predicate(node)) return { node, parent };
  }
  return null;
}

function removeChild(parent, childId) {
  normalizeChildren(parent);
  const idx = parent.children.findIndex(c => c.id === childId);
  if (idx === -1) return null;
  const [child] = parent.children.splice(idx, 1);
  return child;
}

function nodePath(tree, targetId) {
  const stack = [{ node: tree, path: [tree.title] }];
  while (stack.length) {
    const { node, path } = stack.pop();
    if (node.id === targetId) return path.join(' > ');
    normalizeChildren(node);
    for (const child of node.children) {
      stack.push({ node: child, path: [...path, child.title] });
    }
  }
  return targetId;
}

/** Просить AI впорядкувати дітей вузла в теологічно та логічно правильному порядку. */
async function aiReorderChildren(parent, model, provider = DEFAULT_PROVIDER) {
  normalizeChildren(parent);
  if (parent.children.length < 2) return parent.children.map(c => c.id);

  const childrenList = parent.children
    .map((c, idx) => {
      const desc = c.description ? ` — ${c.description}` : '';
      return `${idx + 1}. id=${c.id} :: ${c.title}${desc}`;
    })
    .join('\n');

  const prompt = `Ти експерт-теолог. Маємо групу "${parent.title}" (${parent.description || 'без опису'}).
Відсортуй її підгрупи у НАЙБІЛЬШ логічному та теологічно правильному порядку:
  1) хронологічний порядок біблійних подій (де доречно)
  2) природний порядок викладу (загальне → конкретне, причина → наслідок)
  3) канонічна послідовність книг Біблії (якщо це книги/розділи)
  4) важливість для розуміння теми

Підгрупи (id та назва):
${childrenList}

Поверни ВСІ id у новому порядку (нічого не пропусти, нічого не додай).
Відповідай ТІЛЬКИ JSON-масивом id:
["id1","id2","id3"]`;

  const raw = await queryLLM(prompt, { model, provider, temperature: 0.1 });
  const parsed = extractJson(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('AI повернула не масив');
  }

  const currentIds = new Set(parent.children.map(c => c.id));
  const ordered = parsed.map(String).filter(id => currentIds.has(id));

  // Перевіряємо повноту: всі id мають бути присутні
  if (ordered.length !== parent.children.length || new Set(ordered).size !== parent.children.length) {
    // Доповнюємо тими, що AI пропустила (у початковому порядку)
    const seen = new Set(ordered);
    for (const c of parent.children) {
      if (!seen.has(c.id)) ordered.push(c.id);
    }
  }

  return ordered;
}

/**
 * Просить AI переглянути все дерево та запропонувати переміщення дітей
 * до правильніших батьківських вузлів (reparenting). Працює на рівні
 * одного дерева теми.
 *
 * AI повертає масив { childId, targetParentId, reason }.
 * Корінь не може бути переміщений; цикли не дозволені.
 */
async function aiReparentingMoves(tree, model, provider = DEFAULT_PROVIDER) {
  // Збираємо плоский список усіх вузлів з шляхами
  const flat = [];
  for (const { node, depth, parent } of walkNodes(tree)) {
    flat.push({
      id: node.id,
      title: node.title,
      description: node.description || '',
      depth,
      parentId: parent ? parent.id : null,
      fullPath: nodePath(tree, node.id),
    });
  }

  if (flat.length < 4) return [];

  // Готуємо список для AI
  const desc = flat
    .map(n => `- ${n.id} :: ${n.fullPath}${n.description ? ` — ${n.description}` : ''}`)
    .join('\n');

  const prompt = `Ти експерт-теолог. Маємо ієрархію підтем у дереві категорії.

Перевір, чи кожна підтема знаходиться у правильному батьківському вузлі.
Якщо підтема ЯВНО належить до іншої батьківської групи у цьому ж дереві —
запропонуй перенести. НЕ пропонуй сумнівні переміщення. Не торкайся кореня.

Вузли (id :: повний шлях):
${desc}

Поверни ТІЛЬКИ JSON-масив об'єктів виду:
[{"childId":"...","targetParentId":"...","reason":"..."}]

Якщо все на місці — поверни порожній масив [].`;

  const raw = await queryLLM(prompt, { model, provider, temperature: 0.1 });
  let parsed;
  try {
    parsed = extractJson(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const validIds = new Set(flat.map(n => n.id));
  const rootId = tree.id;

  // Фільтруємо: childId та targetParentId мають існувати, не дорівнювати один одному,
  // childId не може бути коренем
  const moves = [];
  for (const m of parsed) {
    if (!m || typeof m !== 'object') continue;
    const childId = String(m.childId || '');
    const targetParentId = String(m.targetParentId || '');
    if (!validIds.has(childId) || !validIds.has(targetParentId)) continue;
    if (childId === targetParentId) continue;
    if (childId === rootId) continue;
    moves.push({ childId, targetParentId, reason: String(m.reason || '') });
  }
  return moves;
}

/** Перевіряє чи переміщення не створить цикл (targetParent не нащадок child). */
function isDescendant(ancestor, possibleDescendantId) {
  if (ancestor.id === possibleDescendantId) return true;
  normalizeChildren(ancestor);
  for (const c of ancestor.children) {
    if (isDescendant(c, possibleDescendantId)) return true;
  }
  return false;
}

function applyReparentMove(tree, move, dryRun) {
  const targetEntry = findNode(tree, n => n.id === move.targetParentId);
  if (!targetEntry) return { ok: false, error: 'target_parent_not_found' };
  const childEntry = findNode(tree, n => n.id === move.childId);
  if (!childEntry || !childEntry.parent) return { ok: false, error: 'child_or_current_parent_not_found' };
  if (childEntry.parent.id === move.targetParentId) return { ok: false, error: 'already_at_target' };
  // Цикл: цільовий батько не може бути нащадком дитини
  if (isDescendant(childEntry.node, move.targetParentId)) {
    return { ok: false, error: 'cycle' };
  }

  if (dryRun) return { ok: true, dryRun: true };

  const removed = removeChild(childEntry.parent, move.childId);
  if (!removed) return { ok: false, error: 'remove_failed' };
  normalizeChildren(targetEntry.node);
  targetEntry.node.children.push(removed);
  return { ok: true };
}

async function processTheme(themeId, opts) {
  const theme = getTheme(themeId);
  if (!theme) {
    console.error(`❌ Тему не знайдено: ${themeId}`);
    return null;
  }
  const tree = loadTopicTree(themeId);
  if (!tree) {
    console.error(`❌ ${theme.title}: файл ієрархії відсутній або зламаний`);
    return null;
  }

  console.log(`\n📚 ${theme.title} (${themeId})`);
  const originalCount = countNodes(tree);

  // 1) Reparenting (опційно)
  let reparentApplied = 0;
  let reparentSkipped = 0;
  if (opts.reparent && !opts.reorderOnly) {
    console.log('   🔀 Аналіз переміщень (reparent)...');
    try {
      const moves = await aiReparentingMoves(tree, opts.model, opts.provider);
      if (moves.length === 0) {
        console.log('   ✓ AI не запропонувала переміщень');
      } else {
        console.log(`   AI запропонувала ${moves.length} переміщень:`);
        for (const m of moves) {
          const fromPath = nodePath(tree, m.childId);
          const toPath = nodePath(tree, m.targetParentId);
          const res = applyReparentMove(tree, m, opts.dryRun);
          if (res.ok) {
            reparentApplied++;
            console.log(`     ${opts.dryRun ? '[DRY]' : '✓'} ${fromPath}  →  під "${toPath}"${m.reason ? `  // ${m.reason}` : ''}`);
          } else {
            reparentSkipped++;
            console.log(`     ✗ ${fromPath}  →  ${toPath}  (skip: ${res.error})`);
          }
        }
      }
    } catch (e) {
      console.error(`   ❌ Reparent: ${e.message}`);
    }
  }

  // 2) Reorder кожної непустої групи (по всій глибині)
  console.log('   🔢 Сортування підгруп у кожній групі...');
  let reorderCount = 0;
  for (const { node, depth } of walkNodes(tree)) {
    if (depth > opts.maxDepth) continue;
    normalizeChildren(node);
    if (node.children.length < 2) continue;
    try {
      const ordered = await aiReorderChildren(node, opts.model, opts.provider);
      const oldOrder = node.children.map(c => c.id);
      const sameOrder = ordered.every((id, i) => id === oldOrder[i]);
      if (sameOrder) continue;

      if (!opts.dryRun) {
        const byId = new Map(node.children.map(c => [c.id, c]));
        node.children = ordered.map(id => byId.get(id)).filter(Boolean);
      }
      reorderCount++;
      const indent = '  '.repeat(depth);
      console.log(`     ${opts.dryRun ? '[DRY]' : '✓'} ${indent}${node.icon || '◈'} ${node.title}: оновлено порядок (${node.children.length} підгруп)`);
    } catch (e) {
      console.error(`     ⚠ ${node.title}: ${e.message}`);
    }
  }

  // 3) Зберігаємо
  if (!opts.dryRun) {
    saveTopicTree(themeId, tree, opts.backup);
  }

  const finalCount = countNodes(tree);
  console.log(`   📦 Вузлів: ${finalCount} (було ${originalCount})`);
  console.log(`   ✅ Reparent: ${reparentApplied} (skip ${reparentSkipped}), Reorder: ${reorderCount}`);
  return { reparentApplied, reparentSkipped, reorderCount };
}

async function main() {
  const opts = parseArgs();

  console.log('🤖 AI — сортування підгруп у дереві тем');
  console.log('===============================================');
  console.log(`Провайдер: ${providerLabel(opts.provider)} • модель: ${opts.model}`);
  if (opts.dryRun) console.log('Режим: DRY-RUN (нічого не зберігається)');
  if (opts.backup) console.log('Створюватиму .bak перед збереженням');
  if (opts.reparent) console.log('Дозволено переміщення між групами (reparent)');
  if (opts.reorderOnly) console.log('Лише сортування (без reparent)');
  console.log('');

  console.log(`🔗 Перевірка ${providerLabel(opts.provider)}...`);
  try {
    const ok = await checkLLM(opts.model, { provider: opts.provider });
    if (!ok) throw new Error('порожня відповідь');
    console.log(`✅ ${providerLabel(opts.provider)} працює\n`);
  } catch (e) {
    console.error('❌', e.message);
    console.error(`\n💡 ${unavailableHint(opts.provider)}`);
    process.exit(1);
  }

  const themes = opts.all ? THEME_IDS : [opts.theme];
  const totals = { reparentApplied: 0, reparentSkipped: 0, reorderCount: 0 };

  for (const themeId of themes) {
    const result = await processTheme(themeId, opts);
    if (result) {
      totals.reparentApplied += result.reparentApplied;
      totals.reparentSkipped += result.reparentSkipped;
      totals.reorderCount += result.reorderCount;
    }
  }

  console.log('\n===============================================');
  console.log(`✅ Всього reparent: ${totals.reparentApplied}, skip: ${totals.reparentSkipped}, reorder: ${totals.reorderCount}`);
  if (opts.dryRun) {
    console.log('\nDRY-RUN — нічого не змінено. Запусти без --dry-run, щоб зберегти.');
  } else {
    console.log(`\nФайли оновлено в: ${TOPICS_DIR}`);
  }
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
