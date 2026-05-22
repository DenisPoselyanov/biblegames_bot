#!/usr/bin/env node
/**
 * AI-генератор ієрархії тем та підтем (Ollama)
 *
 * npm run generate-topics-ai -- --theme geography
 * npm run generate-topics-ai -- --all
 */

import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { THEME_IDS, getTheme } from './lib/themes-config.mjs';
import { checkOllama, extractJsonArray, queryOllama } from './lib/ollama.mjs';

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

function buildPrompt(theme) {
  return `Ти експерт з Біблії. Створи ієрархічну структуру тем для категорії "${theme.title}".

Контекст: ${theme.context}

Правила:
1. Створи 1 кореневий вузол з назвою теми
2. Додай 3-5 підтем першого рівня
3. Кожна підтема може мати 2-4 підпідтеми (другий рівень)
4. Кожен вузол має: "title" (назва), "description" (короткий опис 1 речення), "icon" (емодзі)
5. Глибина: максимум 2-3 рівні

Відповідай ТІЛЬКИ JSON:

{
  "id": "${theme.id}",
  "title": "${theme.title}",
  "description": "Опис всієї теми",
  "icon": "📖",
  "children": [
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

function validateTopicNode(node, parentId) {
  if (!node || typeof node !== 'object') return null;
  const id = node.id || `${parentId || 'root'}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return {
    id,
    title: String(node.title || 'Без назви').trim(),
    description: String(node.description || '').trim(),
    icon: String(node.icon || '📖').trim(),
    children: Array.isArray(node.children)
      ? node.children.map(c => validateTopicNode(c, id)).filter(Boolean)
      : [],
  };
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
  const prompt = buildPrompt(theme);
  const raw = await queryOllama(prompt, model);
  const parsed = extractJsonArray(raw);

  let root;
  if (parsed && parsed.length > 0) {
    root = validateTopicNode(parsed[0], themeId);
  } else {
    try {
      const single = JSON.parse(raw);
      root = validateTopicNode(single, themeId);
    } catch {
      console.error(`  ❌ ${theme.title}: не вдалося розпарсити відповідь`);
      return null;
    }
  }

  if (!root) {
    console.error(`  ❌ ${theme.title}: кореневий вузол не пройшов валідацію`);
    return null;
  }

  saveTopics(themeId, root);
  const count = countNodes(root);
  console.log(`  ✅ ${theme.title}: збережено (${count} вузлів)`);
  return root;
}

function countNodes(node) {
  let count = 1;
  for (const child of node.children) {
    count += countNodes(child);
  }
  return count;
}

function printHierarchy(node, indent = '') {
  console.log(`${indent}${node.icon} ${node.title} (${node.id})`);
  for (const child of node.children) {
    printHierarchy(child, indent + '  ');
  }
}

async function main() {
  const args = process.argv.slice(2);
  const opts = {
    theme: null,
    all: false,
    model: DEFAULT_MODEL,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--theme' && args[i + 1]) opts.theme = args[++i];
    else if (args[i] === '--all') opts.all = true;
    else if (args[i] === '--model' && args[i + 1]) opts.model = args[++i];
  }

  if (!opts.all && !opts.theme) {
    console.error('❌ Вкажи --theme <id> або --all');
    console.error('Теми:', THEME_IDS.join(', '));
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

  const themes = opts.all ? THEME_IDS : [opts.theme];
  let grandTotal = 0;

  for (const themeId of themes) {
    console.log(`\n📚 ${themeId}`);
    const result = await generateForTheme(themeId, opts.model);
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
