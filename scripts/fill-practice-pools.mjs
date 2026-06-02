#!/usr/bin/env node
/**
 * Дозаповнення пулів практики: кожна тема × складність до повного шляху етапів.
 *
 * npm run fill-practice -- --dry-run
 * npm run fill-practice -- --theme geography
 * npm run fill-practice -- --difficulty youth --max-jobs 5
 * npm run fill-practice
 */

import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { DIFFICULTIES, getTheme } from './lib/themes-config.mjs';
import {
  applyAiCliFlags,
  checkLLM,
  defaultAiOpts,
  loadProjectEnv,
  providerLabel,
  unavailableHint,
} from './lib/llm.mjs';
import { collectPracticeGaps, summarizeGaps } from './lib/practice-pool-stats.mjs';
import { generateForTheme } from './generate-questions-ai.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const REPORT_FILE = join(ROOT, 'data', 'fill-practice-report.json');

loadProjectEnv();
const { provider: DEFAULT_PROVIDER, model: DEFAULT_MODEL } = defaultAiOpts();

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    theme: null,
    difficulty: null,
    dryRun: false,
    minGap: 1,
    maxJobs: 0,
    maxQuestions: 0,
    batchCap: 50,
    maxRoundsPerJob: 40,
    provider: DEFAULT_PROVIDER,
    model: DEFAULT_MODEL,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--theme' && args[i + 1]) opts.theme = args[++i];
    else if (args[i] === '--difficulty' && args[i + 1]) opts.difficulty = args[++i];
    else if (args[i] === '--min-gap' && args[i + 1]) opts.minGap = parseInt(args[++i], 10);
    else if (args[i] === '--max-jobs' && args[i + 1]) opts.maxJobs = parseInt(args[++i], 10);
    else if (args[i] === '--max-questions' && args[i + 1]) opts.maxQuestions = parseInt(args[++i], 10);
    else if (args[i] === '--batch-cap' && args[i + 1]) opts.batchCap = parseInt(args[++i], 10);
    else if (args[i] === '--provider' && args[i + 1]) opts.provider = args[++i];
    else if (args[i] === '--model' && args[i + 1]) opts.model = args[++i];
    else if (args[i] === '--dry-run') opts.dryRun = true;
  }
  applyAiCliFlags(opts, args);

  if (opts.difficulty && !DIFFICULTIES.includes(opts.difficulty)) {
    console.error(`❌ Невідома складність: ${opts.difficulty}`);
    process.exit(1);
  }

  return opts;
}

function buildContext(themeId) {
  const theme = getTheme(themeId);
  return {
    title: theme?.title || themeId,
    description: theme?.context || '',
    path: [theme?.title || themeId],
  };
}

async function fillJob(job, opts, questionBudget = Infinity) {
  const context = buildContext(job.themeId);
  let totalAdded = 0;
  let rounds = 0;

  while (rounds < opts.maxRoundsPerJob && totalAdded < questionBudget) {
    const [current] = collectPracticeGaps({
      theme: job.themeId,
      difficulty: job.difficulty,
      minGap: 1,
    });
    if (!current) {
      console.log(`  ✅ ${job.themeId} / ${job.difficulty}: пул готовий (${job.required} питань)`);
      break;
    }

    const budgetLeft = questionBudget - totalAdded;
    const batch = Math.min(current.gap, opts.batchCap, budgetLeft);
    if (batch <= 0) break;
    console.log(
      `  📥 ${job.themeId} / ${job.difficulty}: потрібно +${current.gap} (зараз ${current.pool}/${current.required}), запит ${batch}…`,
    );

    const added = await generateForTheme(
      job.themeId,
      batch,
      job.difficulty,
      opts.model,
      opts.provider,
      context.path,
      null,
      context,
      [job.difficulty],
      { maxAttempts: 20 },
    );
    totalAdded += added;
    rounds++;

    if (added === 0) {
      console.warn(`  ⚠️  Немає нових питань (дублікати?) — зупинка для цієї комбінації`);
      break;
    }
  }

  const [left] = collectPracticeGaps({
    theme: job.themeId,
    difficulty: job.difficulty,
    minGap: 1,
  });

  return {
    themeId: job.themeId,
    difficulty: job.difficulty,
    requestedGap: job.gap,
    added: totalAdded,
    remainingGap: left?.gap ?? 0,
    ready: !left,
  };
}

async function main() {
  console.warn('⚠️  fill-practice (рівень теми) застаріло.');
  console.warn('   Використовуй: npm run fill-practice-nodes\n');
  const opts = parseArgs();
  let gaps = collectPracticeGaps({
    theme: opts.theme ?? undefined,
    difficulty: opts.difficulty ?? undefined,
    minGap: opts.minGap,
  });

  if (opts.maxJobs > 0) gaps = gaps.slice(0, opts.maxJobs);

  const summary = summarizeGaps(gaps);

  console.log('🎯 Заповнення пулів практики (100% по темах і складності)');
  console.log('============================================================');
  console.log(`Провайдер: ${providerLabel(opts.provider)} • модель: ${opts.model}`);
  console.log(`Завдань: ${summary.jobCount} · питань до цілі: ~${summary.totalGap}`);
  if (opts.theme) console.log(`Фільтр теми: ${opts.theme}`);
  if (opts.difficulty) console.log(`Фільтр складності: ${opts.difficulty}`);
  console.log('');

  if (gaps.length === 0) {
    console.log('✅ Усі обрані комбінації вже готові до повної практики.');
    return;
  }

  console.log('Тема'.padEnd(20), 'Складн.'.padEnd(10), 'Зараз'.padStart(6), 'Ціль'.padStart(6), '+'.padStart(6));
  console.log('-'.repeat(54));
  for (const g of gaps.slice(0, 40)) {
    console.log(
      g.themeId.padEnd(20),
      g.difficulty.padEnd(10),
      String(g.pool).padStart(6),
      String(g.required).padStart(6),
      String(g.gap).padStart(6),
    );
  }
  if (gaps.length > 40) {
    console.log(`  … ще ${gaps.length - 40} комбінацій`);
  }
  console.log('');

  if (opts.dryRun) {
    const preview = {
      generatedAt: new Date().toISOString(),
      dryRun: true,
      summary,
      jobs: gaps,
    };
    fs.writeFileSync(REPORT_FILE, JSON.stringify(preview, null, 2), 'utf8');
    console.log(`📄 План збережено: ${REPORT_FILE}`);
    console.log('✅ Dry-run — генерація не запускалась');
    console.log('\nЗапуск: npm run fill-practice');
    return;
  }

  console.log(`🔗 Перевірка ${providerLabel(opts.provider)}...`);
  try {
    const ok = await checkLLM(opts.model, { provider: opts.provider });
    if (!ok) throw new Error('порожня відповідь');
    console.log(`✅ ${providerLabel(opts.provider)} працює\n`);
  } catch (e) {
    console.error('❌', e.message);
    console.error(`💡 ${unavailableHint(opts.provider)}`);
    process.exit(1);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    provider: opts.provider,
    model: opts.model,
    summary: { ...summary, plannedQuestions: summary.totalGap },
    results: [],
  };

  let questionsGenerated = 0;

  for (let i = 0; i < gaps.length; i++) {
    const job = gaps[i];
    if (opts.maxQuestions > 0 && questionsGenerated >= opts.maxQuestions) {
      console.log(`\n⏹️  Ліміт --max-questions ${opts.maxQuestions} досягнуто`);
      break;
    }

    const budgetLeft =
      opts.maxQuestions > 0 ? opts.maxQuestions - questionsGenerated : Infinity;
    if (budgetLeft <= 0) {
      console.log(`\n⏹️  Ліміт --max-questions ${opts.maxQuestions} досягнуто`);
      break;
    }

    console.log(`\n[${i + 1}/${gaps.length}] ${job.themeId} / ${job.difficulty}`);
    const result = await fillJob(job, opts, budgetLeft);
    report.results.push(result);
    questionsGenerated += result.added;

    if (opts.maxQuestions > 0 && questionsGenerated >= opts.maxQuestions) {
      console.log(`\n⏹️  Ліміт --max-questions ${opts.maxQuestions}`);
      break;
    }
  }

  const remaining = collectPracticeGaps({
    theme: opts.theme ?? undefined,
    difficulty: opts.difficulty ?? undefined,
    minGap: opts.minGap,
  });
  report.summary.after = summarizeGaps(remaining);
  report.totalAdded = report.results.reduce((s, r) => s + r.added, 0);
  report.readyCount = report.results.filter((r) => r.ready).length;

  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf8');

  console.log('\n============================================================');
  console.log(`✅ Додано питань: ${report.totalAdded}`);
  console.log(`✅ Повністю заповнено комбінацій: ${report.readyCount}/${report.results.length}`);
  if (remaining.length > 0) {
    console.log(`⚠️  Залишилось прогалин: ${remaining.length} (~${remaining.reduce((s, g) => s + g.gap, 0)} питань)`);
    console.log('   Повторіть: npm run fill-practice');
  } else {
    console.log('🎉 Усі обрані теми та рівні готові до повної практики!');
  }
  console.log(`📄 Звіт: ${REPORT_FILE}`);
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
