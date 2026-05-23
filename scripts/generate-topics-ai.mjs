#!/usr/bin/env node
/**
 * AI-генератор ієрархії тем та підтем (Ollama)
 *
 * npm run generate-topics -- --theme geography
 * npm run generate-topics -- --all
 * npm run generate-topics -- --group old-testament
 * npm run generate-topics -- --group new-testament
 */

import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { THEMES, THEME_IDS, getTheme, GROUPS, getGroup, flattenTopicNodes } from './lib/themes-config.mjs';
import { checkOllama, extractJsonObject, queryOllama } from './lib/ollama.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOPICS_DIR = join(__dirname, '..', 'data', 'topics-db');
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'mistral';

function ensureDir() {
  if (!fs.existsSync(TOPICS_DIR)) {
    fs.mkdirSync(TOPICS_DIR, { recursive: true });
  }
}

function topicsPath(themeId) {
  return join(TOPICS_DIR, `${themeId}.json`);
}

function loadExistingTopics(themeId) {
  const path = topicsPath(themeId);
  if (!fs.existsSync(path)) return null;
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function saveTopics(themeId, data) {
  ensureDir();
  fs.writeFileSync(topicsPath(themeId), JSON.stringify(data, null, 2), 'utf8');
}

function buildSinglePrompt(theme) {
  return `Ти експерт з Біблії. Створи ієрархічну структуру підтем для категорії "${theme.title}".

Контекст: ${theme.context}

Правила:
1. Створи 1 кореневий вузол з назвою теми та id "${theme.id}"
2. Додай 1 вузол-обгортку "Усі питання з цієї теми" (aggregateThemeIds: ["${theme.id}"])
3. Додай 3-5 підтем першого рівня
4. Кожна підтема може мати 1-3 підпідтеми (другий рівень)
5. Кожен вузол має: "id", "title", "description", "icon" (емодзі), "children"
6. Вузли, що відповідають існуючим темам, мають поле "themeId" (наприклад "${theme.id}")
7. Максимум 3 рівні глибини
8. id повинні бути унікальними, формат: "${theme.id}-all", "${theme.id}-sub-1", "${theme.id}-sub-1-sub-1", "${theme.id}-sub-2" і т.д.

Відповідай ТІЛЬКИ JSON:

{
  "id": "${theme.id}",
  "title": "${theme.title}",
  "description": "Опис всієї теми",
  "icon": "📖",
  "children": [
    {
      "id": "${theme.id}-all",
      "title": "Усі питання з цієї теми",
      "description": "Всі питання з ${theme.title}",
      "icon": "📚",
      "themeId": "${theme.id}",
      "aggregateThemeIds": ["${theme.id}"],
      "children": []
    },
    {
      "id": "${theme.id}-sub-1",
      "title": "Назва підтеми 1",
      "description": "Опис підтеми 1",
      "icon": "✝️",
      "children": [
        {
          "id": "${theme.id}-sub-1-sub-1",
          "title": "Назва підпідтеми 1",
          "description": "Опис",
          "icon": "📜",
          "children": []
        }
      ]
    }
  ]
}`;
}

function buildGroupPrompt(group) {
  const themeContexts = group.themeIds
    .map((tid) => {
      const t = getTheme(tid);
      return t ? `  - "${tid}": ${t.title} — ${t.context}` : `  - "${tid}"`;
    })
    .join('\n');

  return `Ти експерт з Біблії. Створи групову ієрархію для "${group.title}".

Опис: ${group.description}

Теми, які входять до цієї групи:
${themeContexts}

Правила:
1. Створи 1 кореневий вузол з назвою "${group.title}" та id "${group.id}"
2. Додай 1 вузол-обгортку "Усі питання з цієї теми" з aggregateThemeIds: ${JSON.stringify(group.themeIds)}
3. Для кожної теми зі списку створи дочірній вузол з:
   - id: як id теми (наприклад "gospels", "geography")
   - title: назва теми
   - description: короткий опис (1 речення)
   - icon: емодзі
   - themeId: id теми (наприклад "gospels")
   - children: порожній масив або 2-4 підтеми
4. Кожен вузол, що маппиться на існуючу тему, повинен мати поле "themeId"
5. Максимум 2 рівні глибини після кореня

Відповідай ТІЛЬКИ JSON:

{
  "id": "${group.id}",
  "title": "${group.title}",
  "description": "Опис групи",
  "icon": "${group.icon}",
  "children": [
    {
      "id": "${group.id}-all",
      "title": "Усі питання з цієї теми",
      "description": "Всі питання з ${group.title}",
      "icon": "📚",
      "themeId": "${group.themeIds[0]}",
      "aggregateThemeIds": ${JSON.stringify(group.themeIds)},
      "children": []
    },
    {
      "id": "${group.themeIds[1]}",
      "title": "Назва теми",
      "description": "Опис теми",
      "icon": "✝️",
      "themeId": "${group.themeIds[1]}",
      "children": [
        {
          "id": "${group.themeIds[1]}-all",
          "title": "Усі питання з цієї теми",
          "description": "Всі питання про тему",
          "icon": "📖",
          "themeId": "${group.themeIds[1]}",
          "aggregateThemeIds": ["${group.themeIds[1]}"],
          "children": []
        },
        {
          "id": "${group.themeIds[1]}-sub-1",
          "title": "Підтема 1",
          "description": "Опис",
          "icon": "📜",
          "children": []
        }
      ]
    }
  ]
}`;
}

function validateTopicNode(node, parentId) {
  if (!node || typeof node !== 'object') return null;
  const id = node.id || `${parentId || 'root'}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const validated = {
    id,
    title: String(node.title || 'Без назви').trim(),
    description: String(node.description || '').trim(),
    icon: String(node.icon || '📖').trim(),
    children: Array.isArray(node.children)
      ? node.children.map(c => validateTopicNode(c, id)).filter(Boolean)
      : [],
  };
  if (node.themeId) validated.themeId = node.themeId;
  if (node.aggregateThemeIds) validated.aggregateThemeIds = node.aggregateThemeIds;
  return validated;
}

async function generateForTheme(themeId, model) {
  const theme = getTheme(themeId);
  if (!theme) {
    console.error(`  ❌ Тему не знайдено: ${themeId}`);
    return null;
  }

  const existing = loadExistingTopics(themeId);
  if (existing) {
    console.log(`  ⏩ ${theme.title}: вже існує, пропускаю`);
    return existing;
  }

  console.log(`  ⏳ ${theme.title}: генерую ієрархію...`);
  const prompt = buildSinglePrompt(theme);
  const raw = await queryOllama(prompt, model);
  let parsed;
  try {
    parsed = extractJsonObject(raw);
  } catch {
    console.error(`  ❌ ${theme.title}: не вдалося розпарсити відповідь`);
    return null;
  }

  let root = validateTopicNode(parsed, themeId);

  if (!root) {
    console.error(`  ❌ ${theme.title}: кореневий вузол не пройшов валідацію`);
    return null;
  }

  saveTopics(themeId, root);
  const count = countNodes(root);
  console.log(`  ✅ ${theme.title}: збережено (${count} вузлів)`);
  return root;
}

async function generateForGroup(groupId, model) {
  const group = getGroup(groupId);
  if (!group) {
    console.error(`  ❌ Групу не знайдено: ${groupId}`);
    return null;
  }

  const existing = loadExistingTopics(groupId);
  if (existing) {
    console.log(`  ⏩ ${group.title}: вже існує, пропускаю`);
    return existing;
  }

  console.log(`  ⏳ ${group.title}: генерую групову ієрархію...`);
  const prompt = buildGroupPrompt(group);
  const raw = await queryOllama(prompt, model);
  let parsed;
  try {
    parsed = extractJsonObject(raw);
  } catch {
    console.error(`  ❌ ${group.title}: не вдалося розпарсити відповідь`);
    return null;
  }

  let root = validateTopicNode(parsed, groupId);

  if (!root) {
    console.error(`  ❌ ${group.title}: кореневий вузол не пройшов валідацію`);
    return null;
  }

  saveTopics(groupId, root);
  const count = countNodes(root);
  console.log(`  ✅ ${group.title}: збережено (${count} вузлів)`);
  return root;
}

function countNodes(node) {
  if (!node || !node.children) return 1;
  let count = 1;
  for (const child of node.children) {
    count += countNodes(child);
  }
  return count;
}

function printHierarchy(node, indent = '') {
  if (!node) return;
  const tags = [];
  if (node.themeId) tags.push(`theme:${node.themeId}`);
  if (node.aggregateThemeIds) tags.push(`aggregate:${node.aggregateThemeIds.length}ids`);
  const meta = tags.length ? ` [${tags.join(', ')}]` : '';
  console.log(`${indent}${node.icon} ${node.title} (${node.id})${meta}`);
  if (node.children) {
    for (const child of node.children) {
      printHierarchy(child, indent + '  ');
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const opts = {
    theme: null,
    group: null,
    all: false,
    model: DEFAULT_MODEL,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--theme' && args[i + 1]) opts.theme = args[++i];
    else if (args[i] === '--group' && args[i + 1]) opts.group = args[++i];
    else if (args[i] === '--all') opts.all = true;
    else if (args[i] === '--model' && args[i + 1]) opts.model = args[++i];
  }

  if (!opts.all && !opts.theme && !opts.group) {
    console.error('❌ Вкажи --theme <id>, --group <id> або --all');
    console.error('Теми:', THEME_IDS.join(', '));
    console.error('Групи:', GROUPS.map(g => g.id).join(', '));
    process.exit(1);
  }

  console.log('🤖 AI — генератор ієрархії тем (Ollama)');
  console.log('========================================');
  console.log(`Модель: ${opts.model}`);
  console.log('');

  console.log('🔗 Перевірка Ollama...');
  try {
    const ok = await checkOllama(opts.model);
    if (!ok) throw new Error('порожня відповідь');
    console.log('✅ Ollama працює\n');
  } catch (e) {
    console.error('❌', e.message);
    console.error('\n💡 Запусти: ollama serve');
    console.error(`💡 Завантаж модель: ollama pull ${opts.model}`);
    process.exit(1);
  }

  let targets = [];
  if (opts.all) {
    targets = [
      ...GROUPS.map(g => ({ type: 'group', id: g.id })),
      ...THEME_IDS.map(t => ({ type: 'theme', id: t })),
    ];
  } else if (opts.group) {
    targets = [{ type: 'group', id: opts.group }];
  } else if (opts.theme) {
    targets = [{ type: 'theme', id: opts.theme }];
  }

  let grandTotal = 0;

  for (const target of targets) {
    console.log(`\n📚 ${target.id} (${target.type})`);
    let result;
    if (target.type === 'group') {
      result = await generateForGroup(target.id, opts.model);
    } else {
      result = await generateForTheme(target.id, opts.model);
    }
    if (result) {
      console.log('\n   Структура:');
      printHierarchy(result, '   ');
      grandTotal++;
    }
  }

  console.log(`\n✅ Згенеровано ієрархій: ${grandTotal}`);
  console.log(`\nФайли: ${TOPICS_DIR}`);
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
