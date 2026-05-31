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

import { fileURLToPath } from 'url';
import path from 'path';
import { DIFFICULTIES, THEME_IDS, GROUPS, getTheme, getGroup, loadTopicHierarchy, findNodeById, flattenTopicNodes, findTopicNodeGlobally, buildNodePath } from './lib/themes-config.mjs';
import {
  applyAiCliFlags,
  checkLLM,
  defaultAiOpts,
  extractJsonArray,
  isRateLimitError,
  loadProjectEnv,
  parseRateLimitRetryDelayMs,
  providerLabel,
  queryLLM,
  unavailableHint,
} from './lib/llm.mjs';
import {
  appendQuestions,
  loadThemeQuestions,
  normalizeAiQuestion,
  makeQuestionId,
} from './lib/question-db.mjs';

loadProjectEnv();
const { provider: DEFAULT_PROVIDER, model: DEFAULT_MODEL } = defaultAiOpts();
const BATCH_SIZE = 15;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    theme: null,
    group: null,
    topic: null,
    all: false,
    count: 30,
    difficulty: 'all',
    difficulties: null,
    provider: DEFAULT_PROVIDER,
    model: DEFAULT_MODEL,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--theme' && args[i + 1]) opts.theme = args[++i];
    else if (args[i] === '--group' && args[i + 1]) opts.group = args[++i];
    else if (args[i] === '--topic' && args[i + 1]) opts.topic = args[++i];
    else if (args[i] === '--all') opts.all = true;
    else if (args[i] === '--count' && args[i + 1]) opts.count = parseInt(args[++i], 10);
    else if (args[i] === '--difficulties' && args[i + 1]) opts.difficulties = args[++i];
    else if (args[i] === '--difficulty' && args[i + 1]) opts.difficulty = args[++i];
    else if (args[i] === '--provider' && args[i + 1]) opts.provider = args[++i];
    else if (args[i] === '--model' && args[i + 1]) opts.model = args[++i];
  }
  applyAiCliFlags(opts, args);

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

  if (opts.difficulties) {
    const list = opts.difficulties.split(',').map((d) => d.trim()).filter(Boolean);
    const bad = list.filter((d) => !DIFFICULTIES.includes(d));
    if (bad.length) {
      console.error(`❌ Невідомі рівні в --difficulties: ${bad.join(', ')}`);
      console.error('Допустимі:', DIFFICULTIES.join(', '));
      process.exit(1);
    }
    if (list.length === 0) {
      console.error('❌ --difficulties потребує хоча б один рівень');
      process.exit(1);
    }
    opts.difficulties = list;
  } else if (opts.difficulty !== 'all' && !DIFFICULTIES.includes(opts.difficulty)) {
    console.error(`❌ Невідома складність: ${opts.difficulty}`);
    console.error('Допустимі:', ['all', ...DIFFICULTIES].join(', '));
    process.exit(1);
  }

  return opts;
}

/** Список рівнів складності для генерації */
export function resolveDifficultyList(opts) {
  if (opts.difficulties?.length) return opts.difficulties;
  if (opts.difficulty === 'all') return [...DIFFICULTIES];
  return [opts.difficulty];
}

/** Визначити themeId на основі опцій */
export function resolveTargetThemeIds(opts) {
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
    const hit = findTopicNodeGlobally(opts.topic);
    if (hit?.node) {
      if (hit.node.themeId) {
        return [hit.node.themeId];
      }
      if (hit.covenantId) {
        return [hit.covenantId];
      }
      if (hit.node.aggregateThemeIds) {
        return hit.node.aggregateThemeIds.filter((id) => THEME_IDS.includes(id) || GROUPS.some((g) => g.id === id));
      }
      console.error(`  ❌ Topic node "${opts.topic}" не має themeId.`);
      process.exit(1);
    }
    console.error(`  ❌ Topic node "${opts.topic}" не знайдено в topics-db.`);
    process.exit(1);
  }
  return [];
}

/** Отримати контекст для промпту */
export function resolveContext(opts) {
  if (opts.topic) {
    const hit = findTopicNodeGlobally(opts.topic);
    if (hit?.node && hit.root) {
      const path = buildNodePath(hit.root, opts.topic) || [];
      return {
        title: hit.node.title,
        description: hit.node.description || '',
        path,
      };
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
6. Додай "explanationShort" — 1-2 речення, чому правильна відповідь (українською)

Відповідай ТІЛЬКИ JSON-масивом:
[
  {"text":"Питання?","options":["А","Б","В","Г"],"correct":2,"ref":"Бут. 1:1","explanationShort":"..."}
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

  const explShort = String(raw.explanationShort ?? '').trim();
  if (explShort) q.explanationShort = explShort;

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

async function generateBatch(themeId, difficulty, count, model, provider, topicPath, topicNodeId, contextOverride) {
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

  const raw = await queryLLM(prompt, { model, provider });
  const parsed = extractJsonArray(raw);
  return validateBatch(parsed, themeId, difficulty, startIndex, topicPath, topicNodeId);
}

export async function generateForTheme(
  themeId,
  totalCount,
  difficultyFilter,
  model,
  provider = DEFAULT_PROVIDER,
  topicPath,
  topicNodeId,
  contextOverride,
  difficultiesOverride = null,
) {
  const diffs =
    difficultiesOverride?.length
      ? difficultiesOverride
      : difficultyFilter === 'all'
        ? DIFFICULTIES
        : [difficultyFilter];

  const perDiff = Math.max(1, Math.ceil(totalCount / diffs.length));
  let addedTotal = 0;

  for (const diff of diffs) {
    let remaining = perDiff;
    let attempts = 0;

    while (remaining > 0 && attempts < 5) {
      const batchCount = Math.min(remaining, BATCH_SIZE);
      try {
        const batch = await generateBatch(themeId, diff, batchCount, model, provider, topicPath, topicNodeId, contextOverride);
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
        if (isRateLimitError(undefined, e.message)) {
          const waitMs = parseRateLimitRetryDelayMs(e.message);
          console.warn(
            `  ⏳ ${diff}: ліміт Gemini — повтор через ${(waitMs / 1000).toFixed(1)}s…`,
          );
          await sleep(waitMs);
          continue;
        }
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

  console.log('🤖 AI — генератор питань');
  console.log('==========================================');
  console.log(`Провайдер: ${providerLabel(opts.provider)} • модель: ${opts.model}`);
  if (opts.topic) console.log(`Topic node: ${opts.topic}`);
  if (context.path.length > 0) console.log(`Шлях: ${context.path.join(' > ')}`);
  console.log(`Цільові теми: ${themeIds.join(', ')}`);
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

  let grandTotal = 0;

  for (const themeId of themeIds) {
    console.log(`\n📚 ${themeId}`);
    const diffList = resolveDifficultyList(opts);
    const added = await generateForTheme(
      themeId,
      opts.count,
      opts.difficulty,
      opts.model,
      opts.provider,
      context.path,
      opts.topic,
      context,
      diffList,
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

const __filename = fileURLToPath(import.meta.url);

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  main().catch((e) => {
    console.error('Fatal:', e.message);
    process.exit(1);
  });
}
