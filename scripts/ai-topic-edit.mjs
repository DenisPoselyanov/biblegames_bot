#!/usr/bin/env node
/**
 * AI-редактор теми: покращення опису, іконки, генерація підтем, видалення
 *
 * node scripts/ai-topic-edit.mjs --action improve-desc --file nt-group --node gospels
 * node scripts/ai-topic-edit.mjs --action suggest-icon --file nt-group --node gospels
 * node scripts/ai-topic-edit.mjs --action add-children --file nt-group --node gospels --count 3
 * node scripts/ai-topic-edit.mjs --action improve-all --file nt-group --node gospels
 * node scripts/ai-topic-edit.mjs --action delete-node --file nt-group --node gospels-sub-1
 * node scripts/ai-topic-edit.mjs --action organize-children --file gospels --node gospels-sub-2
 */

import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { queryOllama, checkOllama, extractJsonArray, extractJsonObject } from './lib/ollama.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOPICS_DIR = join(__dirname, '..', 'data', 'topics-db');
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'mistral';

function loadTree(fileId) {
  const p = join(TOPICS_DIR, `${fileId}.json`);
  if (!fs.existsSync(p)) { console.error(`❌ Файл не знайдено: ${p}`); process.exit(1); }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function saveTree(fileId, data) {
  fs.writeFileSync(join(TOPICS_DIR, `${fileId}.json`), JSON.stringify(data, null, 2), 'utf8');
}

function findNode(root, targetId) {
  if (root.id === targetId) return { parent: null, node: root, index: -1 };
  function walk(node, parent) {
    if (!node.children) return null;
    for (let i = 0; i < node.children.length; i++) {
      if (node.children[i].id === targetId) return { parent: node, node: node.children[i], index: i };
      const found = walk(node.children[i], node);
      if (found) return found;
    }
    return null;
  }
  return walk(root, null);
}

function buildPath(root, targetId, acc = []) {
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

async function actionImproveDesc(root, node) {
  const pth = buildPath(root, node.id);
  const prompt = `Ти біблійний експерт. Напиши короткий інформативний опис (1-2 речення, 10-20 слів) для теми "${node.title}".

Контекст: ${pth ? pth.join(' > ') : node.title}

Вимоги:
- Опис має бути точним і містити ключові біблійні факти
- Без зайвих слів, тільки суть
- Без лапок навколо тексту
- З великої літери, з крапкою в кінці

Відповідай ТІЛЬКИ текстом опису, без додаткових пояснень.`;
  const raw = (await queryOllama(prompt, DEFAULT_MODEL, { temperature: 0.3 })).trim();
  // Clean up quotes around the response
  const desc = raw.replace(/^["']|["']$/g, '').trim();
  if (desc.length < 5) throw new Error(`Відповідь AI занадто коротка: "${desc}"`);
  node.description = desc;
  console.log(`✅ Опис для "${node.title}" оновлено: ${desc}`);
}

async function actionSuggestIcon(root, node) {
  const pth = buildPath(root, node.id);
  const prompt = `Запропонуй один емодзі-символ для біблійної теми "${node.title}".

Контекст: ${pth ? pth.join(' > ') : node.title}
Поточний опис: ${node.description || 'немає'}

Емодзі має бути тематичним (наприклад: ✝️📖⛪🕊️🔥⚓🌿🌟⭐🌊🏛️🗡️🛡️👑🎺📯📜⚱️🏺🌅🌄🌍).

Відповідай ТІЛЬКИ одним емодзі, без тексту.`;
  const raw = (await queryOllama(prompt, DEFAULT_MODEL, { temperature: 0.4 })).trim();
  const emojiMatch = raw.match(/(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/u);
  if (emojiMatch) {
    node.icon = emojiMatch[0];
    console.log(`✅ Іконка для "${node.title}" оновлена: ${node.icon}`);
  } else {
    console.warn(`⚠️ Не вдалося визначити емодзі з відповіді: "${raw}"`);
  }
}

async function actionAddChildren(root, node, count) {
  const pth = buildPath(root, node.id);
  const c = count || 3;
  const prompt = `Ти біблійний експерт. Створи ${c} унікальних підтем для теми "${node.title}".

Контекст: ${pth ? pth.join(' > ') : node.title}
Опис: ${node.description || 'немає'}

Вимоги:
1. Кожна підтема має бути логічною частиною батьківської теми
2. id формат: "${node.id}-child-1", "${node.id}-child-2" і т.д.
3. Додай опис (1 речення) та емодзі-іконку для кожної підтеми
4. Масив children має бути порожнім

Відповідай ТІЛЬКИ JSON-масивом:
[
  {"id":"${node.id}-child-1","title":"Назва","description":"Опис","icon":"✝️","children":[]}
]`;
  const raw = await queryOllama(prompt, DEFAULT_MODEL, { temperature: 0.5 });
  const newChildren = extractJsonArray(raw);
  if (!Array.isArray(newChildren) || newChildren.length === 0) throw new Error('Порожня відповідь AI');
  // Validate
  const valid = newChildren.map((ch, i) => ({
    id: ch.id || `${node.id}-child-${i + 1}`,
    title: String(ch.title || 'Підтема').trim(),
    description: String(ch.description || '').trim(),
    icon: String(ch.icon || '📖').trim(),
    children: [],
  }));
  if (!node.children) node.children = [];
  const before = node.children.length;
  node.children.push(...valid);
  console.log(`✅ Додано ${valid.length} підтем до "${node.title}" (було ${before}, стало ${node.children.length})`);
  for (const v of valid) {
    console.log(`   ${v.icon} ${v.title} (${v.id})`);
  }
}

async function actionDeleteNode(root, node, parent) {
  if (!parent) {
    console.error(`❌ Не можна видалити кореневий вузол`);
    process.exit(1);
  }
  const idx = parent.children.findIndex(c => c.id === node.id);
  if (idx === -1) { console.error(`❌ Вузол не знайдено в батьківському масиві`); process.exit(1); }
  parent.children.splice(idx, 1);
  console.log(`🗑 Видалено: "${node.title}" (${node.id})`);
}

async function actionOrganizeChildren(root, node) {
  const children = node.children || [];
  if (children.length < 2) {
    console.error(`❌ Для сортування потрібно мінімум 2 підтеми, зараз: ${children.length}`);
    process.exit(1);
  }
  const childrenInfo = children.map((ch, i) =>
    `${i + 1}. id: "${ch.id}" | title: "${ch.title}" | description: "${ch.description || 'немає'}" | icon: ${ch.icon || '📖'}`
  ).join('\n');
  const prompt = `Ти біблійний теолог. Згрупуй наступні підтеми у 2-4 логічні та теологічно правильні групи.

Батьківська тема: "${node.title}"
Опис: ${node.description || 'немає'}

Підтеми:
${childrenInfo}

Вимоги:
1. Згрупуй підтеми за тематикою/хронологією/теологією
2. Кожна група — це новий проміжний вузол з унікальним id
3. Використовуй ТІЛЬКИ наявні id підтем (не створюй нових)
4. id груп формат: "${node.id}-group-1", "${node.id}-group-2" і т.д.
5. Додай емодзі-іконку для кожної групи

Відповідай ТІЛЬКИ JSON-масивом (без пояснень):
[
  {
    "id": "${node.id}-group-1",
    "title": "Назва групи",
    "description": "Короткий опис групи",
    "icon": "📂",
    "childIds": ["${node.id}-sub-1", "${node.id}-sub-2"]
  }
]`;
  const raw = await queryOllama(prompt, DEFAULT_MODEL, { temperature: 0.3 });
  let groups;
  try {
    groups = extractJsonArray(raw);
    if (!Array.isArray(groups)) throw new Error('Не масив');
    if (groups.length < 1) throw new Error('Порожньо');
    for (const g of groups) {
      if (!g.title || !Array.isArray(g.childIds)) throw new Error(`Групі "${g.title}" бракує title або childIds`);
    }
  } catch (e) {
    console.error(`❌ Не вдалося розпарсити відповідь AI: ${e.message}`);
    console.error('Сирий текст:', raw);
    process.exit(1);
  }

  // Перевірити, що всі childIds існують
  const allChildIds = new Set(children.map(c => c.id));
  let assignedIds = new Set();
  for (const g of groups) {
    for (const cid of g.childIds) {
      if (!allChildIds.has(cid)) {
        console.error(`❌ AI повернув неіснуючий id: "${cid}"`);
        process.exit(1);
      }
      assignedIds.add(cid);
    }
  }

  // Перевірити, що всі діти розподілені
  const unassigned = children.filter(c => !assignedIds.has(c.id));
  if (unassigned.length > 0) {
    console.warn(`⚠️ ${unassigned.length} підтем не потрапили в групи, додаю в останню групу`);
    if (groups.length > 0) {
      const last = groups[groups.length - 1];
      for (const c of unassigned) {
        last.childIds.push(c.id);
      }
    }
  }

  // Побудувати нову структуру дітей
  const newChildren = [];
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const groupChildren = g.childIds
      .map(cid => children.find(c => c.id === cid))
      .filter(Boolean);
    newChildren.push({
      id: g.id || `${node.id}-group-${i + 1}`,
      title: g.title.trim(),
      description: (g.description || '').trim(),
      icon: g.icon || '📂',
      children: groupChildren,
    });
  }

  console.log(`🔀 Дітей "${node.title}" переорганізовано в ${newChildren.length} груп:`);
  for (const g of newChildren) {
    console.log(`   📁 ${g.icon} ${g.title} (${g.id}) — ${g.children.length} підтем`);
    for (const ch of g.children) {
      console.log(`      ${ch.icon} ${ch.title}`);
    }
  }

  node.children = newChildren;
}


async function main() {
  const args = process.argv.slice(2);
  let action = 'improve-desc';
  let fileId = null;
  let nodeId = null;
  let count = 3;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--action' && args[i + 1]) action = args[++i];
    else if (args[i] === '--file' && args[i + 1]) fileId = args[++i];
    else if (args[i] === '--node' && args[i + 1]) nodeId = args[++i];
    else if (args[i] === '--count' && args[i + 1]) count = parseInt(args[++i], 10);
  }

  if (!fileId || !nodeId) {
    console.error('❌ Вкажи --file <fileId> та --node <nodeId>');
    console.error('Дії: improve-desc, suggest-icon, add-children, delete-node, improve-all, organize-children');
    process.exit(1);
  }

  console.log(`🤖 AI Topic Editor`);
  console.log(`Дія: ${action} | Файл: ${fileId} | Вузол: ${nodeId}`);
  if (action === 'add-children') console.log(`Кількість: ${count}`);
  console.log('');

  const root = loadTree(fileId);
  const found = findNode(root, nodeId);
  if (!found || !found.node) {
    console.error(`❌ Вузол "${nodeId}" не знайдено у файлі ${fileId}`);
    process.exit(1);
  }

  const { node, parent } = found;

  console.log(`📌 "${node.title}" (${node.id})`);
  if (node.description) console.log(`   Поточний опис: ${node.description}`);
  if (node.icon) console.log(`   Іконка: ${node.icon}`);
  console.log('');

  console.log('🔗 Перевірка Ollama...');
  try {
    const ok = await checkOllama(DEFAULT_MODEL);
    if (!ok) throw new Error('порожня відповідь');
    console.log('✅ Ollama працює\n');
  } catch (e) {
    console.error('❌', e.message);
    console.error('\n💡 Запусти: ollama serve');
    process.exit(1);
  }

  const actions = action === 'improve-all'
    ? ['improve-desc', 'suggest-icon', 'add-children']
    : [action];

  for (const act of actions) {
    try {
      if (act === 'improve-desc') await actionImproveDesc(root, node);
      else if (act === 'suggest-icon') await actionSuggestIcon(root, node);
      else if (act === 'add-children') await actionAddChildren(root, node, count);
      else if (act === 'delete-node') await actionDeleteNode(root, node, parent);
      else if (act === 'organize-children') await actionOrganizeChildren(root, node);
      else console.error(`❌ Невідома дія: ${act}`);
    } catch (e) {
      console.error(`❌ Помилка "${act}": ${e.message}`);
    }
  }

  saveTree(fileId, root);
  console.log(`\n💾 Файл ${fileId}.json збережено`);
  console.log('✅ Готово');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
