#!/usr/bin/env node
/**
 * Локальна AI (Ollama) — генерує питання в data/question-db/{theme}.json
 *
 * npm run generate-ai -- --theme geography --count 50
 * npm run generate-ai -- --theme paul --count 30 --difficulty medium
 * npm run generate-ai -- --all --count 20
 */

import { DIFFICULTIES, THEME_IDS, getTheme } from './lib/themes-config.mjs';
import { checkOllama, extractJsonArray, queryOllama } from './lib/ollama.mjs';
import {
  appendQuestions,
  getGlobalStats,
  loadThemeQuestions,
  normalizeAiQuestion,
  limitQuestions,
} from './lib/question-db.mjs';

const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'mistral';
const BATCH_SIZE = 15;

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    theme: null,
    all: false,
    bulkGenerate: false,
    count: 30,
    difficulty: 'all',
    model: DEFAULT_MODEL,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--theme' && args[i + 1]) opts.theme = args[++i];
    else if (args[i] === '--all') opts.all = true;
    else if (args[i] === '--bulk-generate' && args[i + 1]) {
      opts.bulkGenerate = true;
      opts.count = parseInt(args[++i], 10);
    }
    else if (args[i] === '--count' && args[i + 1]) opts.count = parseInt(args[++i], 10);
    else if (args[i] === '--difficulty' && args[i + 1]) opts.difficulty = args[++i];
    else if (args[i] === '--model' && args[i + 1]) opts.model = args[++i];
  }

  // Валідація: якщо не bulk-generate, потрібна або тема, або --all
  if (!opts.bulkGenerate && !opts.all && (!opts.theme || !getTheme(opts.theme))) {
    console.error('❌ Вкажи --theme <id>, --all або --bulk-generate <count>');
    console.error('Теми:', THEME_IDS.join(', '));
    process.exit(1);
  }

  return opts;
}

function buildPrompt(theme, difficulty, count) {
  return `Ти експерт з Біблії. Створи рівно ${count} УНІКАЛЬНИХ вікторинних питань українською.

Тема: ${theme.title}
Контекст: ${theme.context}
Складність: ${difficulty}
  - beginner: дуже прості факти
  - easy: легкі
  - medium: середні
  - hard: складні
  - expert: експертні, рідкісні факти

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

function validateBatch(items, themeId, difficulty, startIndex, maxCount = Infinity) {
  const valid = [];
  for (let i = 0; i < items.length; i++) {
    if (valid.length >= maxCount) break; // ⛔ Не перевищуй максимум
    const q = normalizeAiQuestion(items[i], themeId, difficulty, startIndex + i);
    if (q) valid.push(q);
  }
  return valid;
}

async function generateBatch(themeId, difficulty, count, model) {
  const theme = getTheme(themeId);
  const existing = loadThemeQuestions(themeId);
  const startIndex = existing.length + 1;

  const batchCount = Math.min(count, BATCH_SIZE);
  const prompt = buildPrompt(theme, difficulty, batchCount);
  console.log(`  ⏳ ${themeId} / ${difficulty}: запит ${batchCount} питань...`);

  const raw = await queryOllama(prompt, model);
  const parsed = extractJsonArray(raw);
  // ⛔ Обмежуємо до запрошеної кількості (AI може генерувати більше)
  return validateBatch(parsed, themeId, difficulty, startIndex, batchCount);
}

async function generateForTheme(themeId, totalCount, difficultyFilter, model) {
  const diffs =
    difficultyFilter === 'all' ? DIFFICULTIES : [difficultyFilter];

  const perDiff = Math.max(1, Math.ceil(totalCount / diffs.length));
  let addedTotal = 0;

  for (const diff of diffs) {
    let remaining = perDiff;
    let attempts = 0;
    let batchAttempts = 0;

    while (remaining > 0 && attempts < 5 && batchAttempts < 10) {
      const batchCount = Math.min(remaining, BATCH_SIZE);
      try {
        const batch = await generateBatch(themeId, diff, batchCount, model);
        if (batch.length === 0) {
          attempts++;
          batchAttempts++;
          continue;
        }
        const result = appendQuestions(themeId, batch);
        addedTotal += result.added;
        remaining -= batch.length;
        batchAttempts++;
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

  console.log('🤖 Локальна AI — генератор питань (Ollama)');
  console.log('==========================================');
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

  let grandTotal = 0;

  // Режим масової генерації: усі теми, усі рівні, одна кількість
  if (opts.bulkGenerate) {
    console.log(`\n🔥 МАСОВА ГЕНЕРАЦІЯ: ${opts.count} питань на тему/рівень`);
    console.log(`📊 Буде згенеровано: ${THEME_IDS.length} тем × ${DIFFICULTIES.length} рівнів`);
    console.log(`💡 Загалом ітерацій: ${THEME_IDS.length * DIFFICULTIES.length}`);
    console.log(`💡 Максимум питань: ${THEME_IDS.length * DIFFICULTIES.length * opts.count}\n`);

    for (const themeId of THEME_IDS) {
      console.log(`\n📚 ${themeId}`);
      for (const difficulty of DIFFICULTIES) {
        try {
          const batch = await generateBatch(themeId, difficulty, opts.count, opts.model);
          if (batch.length > 0) {
            const result = appendQuestions(themeId, batch);
            grandTotal += result.added;
            // ⚠️ Логування дійсної кількості
            if (batch.length !== opts.count) {
              console.log(`  ⚠️  ${difficulty}: запрошено ${opts.count}, але отримано ${batch.length}`);
            }
            console.log(`  ✅ ${difficulty}: +${result.added} (всього в базі: ${result.after})`);
          } else {
            console.log(`  ⚠️  ${difficulty}: не вдалось згенерувати`);
          }
        } catch (e) {
          console.error(`  ❌ ${difficulty}: ${e.message}`);
        }
      }
    }
  } 
  // Стандартні режими
  else {
    const themes = opts.all ? THEME_IDS : [opts.theme];

    for (const themeId of themes) {
      console.log(`\n📚 ${themeId}`);
      const added = await generateForTheme(
        themeId,
        opts.count,
        opts.difficulty,
        opts.model,
      );
      grandTotal += added;
    }
  }

  console.log('\n==========================================');
  console.log(`✅ Додано нових питань: ${grandTotal}`);
  console.log('\nДалі:');
  console.log('  npm run questions:stats   — статистика');
  console.log('  npm run dev               — гра підхопить JSON автоматично');
  console.log('\nАбо через Telegram-бота: /stats, /generate');
}

// Обробляємо сигнали переривання
let isShuttingDown = false;

process.on('SIGINT', () => {
  if (isShuttingDown) {
    console.log('\n❌ Форсове вимкнення...');
    process.exit(130);
  }
  isShuttingDown = true;
  console.log('\n\n⚠️  Отримано сигнал SIGINT. Завершуємо генерацію...');
  console.log('   (Дані вже збережені, питання не будуть втрачені)');
  setTimeout(() => {
    console.log('⛔ Таймаут завершення. Вихід.');
    process.exit(130);
  }, 5000);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  Отримано сигнал SIGTERM. Завершуємо...');
  process.exit(143);
});

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
