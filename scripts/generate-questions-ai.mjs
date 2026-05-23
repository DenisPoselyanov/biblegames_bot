#!/usr/bin/env node
/**
 * Локальна AI (Ollama) — генерує питання в data/question-db/{theme}.json
 *
 * npm run generate-ai -- --theme geography --count 50
 * npm run generate-ai -- --theme paul --count 30 --difficulty medium
 * npm run generate-ai -- --all --count 20
 * npm run generate-ai -- --group old-testament --count 100
 * npm run generate-ai -- --topic geography-sub-1 --count 20
 * npm run generate-ai -- --topic gospels-sub-2-sub-1 --count 10 --difficulty student
 */

import { DIFFICULTIES, THEME_IDS, GROUPS, getTheme, getGroup, getTopicContext, loadTopicHierarchy, findNodeById, flattenTopicNodes } from './lib/themes-config.mjs';
import { checkOllama, extractJsonArray, queryOllama } from './lib/ollama.mjs';
import {
  appendQuestions,
  loadThemeQuestions,
  normalizeAiQuestion,
  makeQuestionId,
} from './lib/question-db.mjs';

const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'mistral';
const BATCH_SIZE = 15;

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    theme: null,
    group: null,
    topic: null,
    all: false,
    count: 30,
    difficulty: 'all',
    model: DEFAULT_MODEL,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--theme' && args[i + 1]) opts.theme = args[++i];
    else if (args[i] === '--group' && args[i + 1]) opts.group = args[++i];
    else if (args[i] === '--topic' && args[i + 1]) opts.topic = args[++i];
    else if (args[i] === '--all') opts.all = true;
    else if (args[i] === '--count' && args[i + 1]) opts.count = parseInt(args[++i], 10);
    else if (args[i] === '--difficulty' && args[i + 1]) opts.difficulty = args[++i];
    else if (args[i] === '--model' && args[i + 1]) opts.model = args[++i];
  }

  if (!opts.all && !opts.theme && !opts.group && !opts.topic) {
    console.error('❌ Вкажи один з: --theme <id>, --group <id>, --topic <nodeId> або --all');
    console.error('Теми:', THEME_IDS.join(', '));
    console.error('Групи:', GROUPS.map(g => g.id).join(', '));
    process.exit(1);
  }

  if (opts.topic && opts.theme) {
    console.error('❌ --topic і --theme несумісні. Використовуй один з них.');
    process.exit(1);
  }

  if (!Number.isFinite(opts.count) || opts.count <= 0) {
    console.error('❌ --count має бути додатним числом');
    process.exit(1);
  }

  if (opts.difficulty !== 'all' && !DIFFICULTIES.includes(opts.difficulty)) {
    console.error(`❌ Невідома складність: ${opts.difficulty}`);
    console.error('Допустимі:', ['all', ...DIFFICULTIES].join(', '));
    process.exit(1);
  }

  return opts;
}

/** Визначити themeId на основі опцій */
function resolveTargetThemeIds(opts) {
  if (opts.all) {
    return THEME_IDS;
  }
  if (opts.theme) {
    return [opts.theme];
  }
  if (opts.group) {
    const group = getGroup(opts.group);
    return group ? group.themeIds : [];
  }
  if (opts.topic) {
    // Спробуємо знайти topic Node в усіх файлах
    const allNodes = [];
    for (const file of THEME_IDS) {
      const root = loadTopicHierarchy(file);
      if (root) {
        allNodes.push(...flattenTopicNodes(root));
      }
    }
    // Також шукаємо в об'єднаному файлі
    const mergedRoot = loadTopicHierarchy('topics-db');
    if (mergedRoot) {
      allNodes.push(...flattenTopicNodes(mergedRoot));
    }
    const match = allNodes.find(({ node }) => node.id === opts.topic);
    if (match) {
      // Якщо є themeId — використовуємо його
      if (match.node.themeId) {
        return [match.node.themeId];
      }
      // Якщо це aggregateThemeIds — повертаємо всі
      if (match.node.aggregateThemeIds) {
        return match.node.aggregateThemeIds.filter(id => THEME_IDS.includes(id));
      }
      // Шукаємо в батьках themeId
      console.error(`  ❌ Topic node "${opts.topic}" не має themeId. Вкажи --theme явно.`);
      process.exit(1);
    }
    console.error(`  ❌ Topic node "${opts.topic}" не знайдено в жодному файлі topics-db.`);
    process.exit(1);
  }
  return [];
}

/** Отримати контекст для промпту */
function resolveContext(opts) {
  if (opts.topic) {
    // Шукаємо вузол у всіх файлах
    for (const file of [...THEME_IDS, 'topics-db']) {
      const root = loadTopicHierarchy(file);
      if (!root) continue;
      const node = findNodeById(root, opts.topic);
      if (node) {
        // Будуємо шлях
        const path = buildNodePath(root, opts.topic, []);
        return {
          title: node.title,
          description: node.description || '',
          path: path || [],
        };
      }
    }
  }
  if (opts.theme) {
    const theme = getTheme(opts.theme);
    if (theme) {
      return {
        title: theme.title,
        description: theme.context,
        path: [theme.title],
      };
    }
  }
  if (opts.group) {
    const group = getGroup(opts.group);
    if (group) {
      return {
        title: group.title,
        description: group.description,
        path: [group.title],
      };
    }
  }
  return { title: '', description: '', path: [] };
}

function buildNodePath(node, targetId, path) {
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

function buildPrompt(context, difficulty, count) {
  const pathStr = context.path.length > 1
    ? `Шлях: ${context.path.join(' > ')}`
    : `Тема: ${context.title}`;

  return `Ти експерт з Біблії. Створи рівно ${count} УНІКАЛЬНИХ вікторинних питань українською.

${pathStr}
Контекст: ${context.description}
Складність: ${difficulty}
  - baby (👶 Немовля): дуже прості, базові факти, які знає кожен
  - child (🧒 Дитина): легкі питання, основи віри
  - youth (🧑 Юнак): середні, потребують розуміння
  - student (🎓 Учень): складні, детальні знання
  - preacher (📖 Проповідник): експертні, глибокі знання Писання
  - teacher (👨‍🏫 Учитель): дуже складні, рідкісні факти, аналіз
  - theologian (⛪ Богослов): найскладніші, богословські нюанси

ПРАВИЛА:
1. Кожне питання — 4 варіанти відповіді
2. Поле "correct" — індекс правильної відповіді (0, 1, 2 або 3), НЕ завжди 0
3. Неправильні варіанти мають бути правдоподібними
4. Додай "ref" з біблійним посиланням (наприклад "Ін. 3:16")
5. Без повторів, без вигаданих імен

Відповідай ТІЛЬКИ JSON-масивом:
[
  {"text":"Питання?","options":["А","Б","В","Г"],"correct":2,"ref":"Бут. 1:1"}
]`;
}

function normalizeAiQuestionExtended(raw, themeId, difficulty, index, topicPath, topicNodeId) {
  const options = raw.options.map((o) => String(o).trim()).filter(Boolean);
  if (options.length !== 4) return null;

  let correctIndex = typeof raw.correct === 'number' ? raw.correct : raw.correctIndex;
  if (correctIndex == null || correctIndex < 0 || correctIndex > 3) correctIndex = 0;

  const q = {
    id: makeQuestionId(themeId, difficulty, index),
    themeId,
    difficulty,
    text: String(raw.text).trim(),
    options,
    correctIndex,
    reference: raw.ref || raw.reference || undefined,
    source: 'ai',
    createdAt: new Date().toISOString(),
  };

  if (topicPath && topicPath.length > 0) {
    q.topicPath = topicPath.join(' > ');
  }
  if (topicNodeId) {
    q.topicNodeId = topicNodeId;
  }

  return q;
}

function validateBatch(items, themeId, difficulty, startIndex, topicPath, topicNodeId) {
  const valid = [];
  for (let i = 0; i < items.length; i++) {
    const q = normalizeAiQuestionExtended(items[i], themeId, difficulty, startIndex + i, topicPath, topicNodeId);
    if (q) valid.push(q);
  }
  return valid;
}

async function generateBatch(themeId, difficulty, count, model, topicPath, topicNodeId, contextOverride) {
  const existing = loadThemeQuestions(themeId);
  const startIndex = existing.length + 1;

  const context = contextOverride || (() => {
    const theme = getTheme(themeId);
    return {
      title: theme?.title || themeId,
      description: theme?.context || '',
      path: [theme?.title || themeId],
    };
  })();

  const prompt = buildPrompt(context, difficulty, Math.min(count, BATCH_SIZE));
  console.log(`  ⏳ ${themeId} / ${difficulty}: запит ${Math.min(count, BATCH_SIZE)} питань...`);

  const raw = await queryOllama(prompt, model);
  const parsed = extractJsonArray(raw);
  return validateBatch(parsed, themeId, difficulty, startIndex, topicPath, topicNodeId);
}

async function generateForTheme(themeId, totalCount, difficultyFilter, model, topicPath, topicNodeId, contextOverride) {
  const diffs =
    difficultyFilter === 'all' ? DIFFICULTIES : [difficultyFilter];

  const perDiff = Math.max(1, Math.ceil(totalCount / diffs.length));
  let addedTotal = 0;

  for (const diff of diffs) {
    let remaining = perDiff;
    let attempts = 0;

    while (remaining > 0 && attempts < 5) {
      const batchCount = Math.min(remaining, BATCH_SIZE);
      try {
        const batch = await generateBatch(themeId, diff, batchCount, model, topicPath, topicNodeId, contextOverride);
        if (batch.length === 0) {
          attempts++;
          continue;
        }
        const result = appendQuestions(themeId, batch);
        addedTotal += result.added;
        // лічимо лише унікальні (не дублікати), щоб не зупинитись передчасно
        remaining -= Math.max(result.added, 1);
        if (result.added === 0) attempts++;
        console.log(`  ✅ ${diff}: +${result.added} (в базі: ${result.after})`);
      } catch (e) {
        console.error(`  ❌ ${diff}: ${e.message}`);
        attempts++;
      }
    }
  }

  return addedTotal;
}

async function main() {
  const opts = parseArgs();
  const themeIds = resolveTargetThemeIds(opts);
  const context = resolveContext(opts);

  if (themeIds.length === 0) {
    console.error('❌ Не вдалося визначити themeId для генерації.');
    process.exit(1);
  }

  console.log('🤖 Локальна AI — генератор питань (Ollama)');
  console.log('==========================================');
  console.log(`Модель: ${opts.model}`);
  if (opts.topic) console.log(`Topic node: ${opts.topic}`);
  if (context.path.length > 0) console.log(`Шлях: ${context.path.join(' > ')}`);
  console.log(`Цільові теми: ${themeIds.join(', ')}`);
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

  let grandTotal = 0;

  for (const themeId of themeIds) {
    console.log(`\n📚 ${themeId}`);
    const added = await generateForTheme(
      themeId,
      opts.count,
      opts.difficulty,
      opts.model,
      context.path,
      opts.topic,
      context,
    );
    grandTotal += added;
  }

  console.log('\n==========================================');
  console.log(`✅ Додано нових питань: ${grandTotal}`);
  console.log('\nДалі:');
  console.log('  npm run questions:stats   — статистика');
  console.log('  npm run dev               — гра підхопить JSON автоматично');
  console.log('\nАбо через Telegram-бота: /stats, /generate');
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
