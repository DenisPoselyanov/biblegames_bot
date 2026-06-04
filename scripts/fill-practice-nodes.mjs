#!/usr/bin/env node
/**
 * Заповнення пулів практики для кожної листової підтеми × складність (з topicNodeId).
 *
 * npm run fill-practice-nodes -- --dry-run
 * npm run fill-practice-nodes -- --theme pentateuch
 * npm run fill-practice-nodes -- --node pentateuch-sub-1-sub-1 --difficulty baby
 */

import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { DIFFICULTIES, getGroup, resolveHierarchyForNode } from './lib/themes-config.mjs';
import {
  applyAiCliFlags,
  checkLLM,
  defaultAiOpts,
  loadProjectEnv,
  providerLabel,
  unavailableHint,
} from './lib/llm.mjs';
import {
  collectNodePracticeGaps,
  summarizeNodeGaps,
  countNodePool,
} from './lib/topic-node-pool-stats.mjs';
import { generateForTheme } from './generate-questions-ai.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const REPORT_FILE = join(ROOT, 'data', 'fill-practice-nodes-report.json');

loadProjectEnv();
const { provider: DEFAULT_PROVIDER, model: DEFAULT_MODEL } = defaultAiOpts();

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    theme: null,
    group: null,
    covenant: null,
    node: null,
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
    else if (args[i] === '--group' && args[i + 1]) opts.group = args[++i];
    else if ((args[i] === '--covenant' || args[i] === '--extensions') && args[i + 1]) {
      opts.covenant = args[++i];
    }
    else if (args[i] === '--node' && args[i + 1]) opts.node = args[++i];
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

  if (opts.theme && opts.group) {
    console.error('❌ --theme і --group несумісні');
    process.exit(1);
  }
  if (opts.covenant && (opts.theme || opts.group)) {
    console.error('❌ --covenant несумісний з --theme та --group');
    process.exit(1);
  }
  if (opts.covenant && !getGroup(opts.covenant)) {
    console.error(`❌ Невідомий завіт: ${opts.covenant} (old-testament | new-testament)`);
    process.exit(1);
  }
  if (opts.group && !getGroup(opts.group)) {
    console.error(`❌ Невідома група: ${opts.group}`);
    process.exit(1);
  }

  return opts;
}

function collectGapsForOpts(opts) {
  if (opts.covenant) {
    return collectNodePracticeGaps({
      covenant: opts.covenant,
      node: opts.node ?? undefined,
      difficulty: opts.difficulty ?? undefined,
      minGap: opts.minGap,
    });
  }
  if (opts.group) {
    const group = getGroup(opts.group);
    const merged = [];
    for (const themeId of group.themeIds) {
      merged.push(
        ...collectNodePracticeGaps({
          theme: themeId,
          node: opts.node ?? undefined,
          difficulty: opts.difficulty ?? undefined,
          minGap: opts.minGap,
        }),
      );
    }
    return merged.sort((a, b) => b.gap - a.gap);
  }
  return collectNodePracticeGaps({
    theme: opts.theme ?? undefined,
    node: opts.node ?? undefined,
    difficulty: opts.difficulty ?? undefined,
    minGap: opts.minGap,
  });
}

async function fillJob(job, opts, questionBudget = Infinity) {
  const { hierarchy, themeId: storageThemeId } = resolveHierarchyForNode(job.nodeId, job.themeId);
  const context = {
    title: job.title,
    description: '',
    path: job.path,
  };
  let totalAdded = 0;
  let rounds = 0;

  while (rounds < opts.maxRoundsPerJob && totalAdded < questionBudget) {
    const pool = hierarchy
      ? countNodePool(job.nodeId, hierarchy, storageThemeId, job.difficulty)
      : 0;
    const gap = Math.max(0, job.required - pool);
    if (gap <= 0) {
      console.log(`  ✅ ${job.title} / ${job.difficulty}: пул готовий (${job.required})`);
      break;
    }

    const budgetLeft = questionBudget - totalAdded;
    const batch = Math.min(gap, opts.batchCap, budgetLeft);
    if (batch <= 0) break;

    console.log(
      `  📥 ${job.title} / ${job.difficulty}: +${gap} (зараз ${pool}/${job.required}), запит ${batch}…`,
    );

    const added = await generateForTheme(
      storageThemeId,
      batch,
      job.difficulty,
      opts.model,
      opts.provider,
      job.path,
      job.nodeId,
      context,
      [job.difficulty],
      { maxAttempts: 20 },
    );
    totalAdded += added;
    rounds++;

    if (added === 0) {
      console.warn(`  ⚠️  Немає нових питань — пропуск`);
      break;
    }
  }

  const { hierarchy: hierarchyAfter, themeId: themeAfter } = resolveHierarchyForNode(
    job.nodeId,
    job.themeId,
  );
  const poolAfter = hierarchyAfter
    ? countNodePool(job.nodeId, hierarchyAfter, themeAfter, job.difficulty)
    : 0;

  return {
    ...job,
    added: totalAdded,
    poolAfter,
    ready: poolAfter >= job.required,
  };
}

async function main() {
  const opts = parseArgs();
  let gaps = collectGapsForOpts(opts);

  if (opts.maxJobs > 0) gaps = gaps.slice(0, opts.maxJobs);
  const summary = summarizeNodeGaps(gaps);

  console.log('🌿 Заповнення підтем (кожна листова × кожна складність)');
  console.log('======================================================');
  console.log(`Провайдер: ${providerLabel(opts.provider)} • модель: ${opts.model}`);
  console.log(`Завдань: ${summary.jobCount} · підтем: ${summary.leafCount} · ~${summary.totalGap} питань`);
  if (opts.theme) console.log(`Фільтр теми: ${opts.theme}`);
  if (opts.group) console.log(`Фільтр групи: ${opts.group}`);
  if (opts.covenant) console.log(`Фільтр гілок завіту: ${opts.covenant}`);
  if (opts.node) console.log(`Фільтр вузла: ${opts.node}`);
  console.log('');

  if (gaps.length === 0) {
    console.log('✅ Усі обрані підтеми готові до повної практики.');
    return;
  }

  console.log('Підтема'.padEnd(28), 'Складн.'.padEnd(10), 'Зараз'.padStart(5), 'Ціль'.padStart(5), '+'.padStart(5));
  console.log('-'.repeat(58));
  for (const g of gaps.slice(0, 30)) {
    console.log(
      g.title.slice(0, 26).padEnd(28),
      g.difficulty.padEnd(10),
      String(g.pool).padStart(5),
      String(g.required).padStart(5),
      String(g.gap).padStart(5),
    );
  }
  if (gaps.length > 30) console.log(`  … ще ${gaps.length - 30} комбінацій`);
  console.log('');

  if (opts.dryRun) {
    fs.writeFileSync(
      REPORT_FILE,
      JSON.stringify({ generatedAt: new Date().toISOString(), dryRun: true, summary, jobs: gaps }, null, 2),
      'utf8',
    );
    console.log(`📄 План: ${REPORT_FILE}`);
    console.log('✅ Dry-run');
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
    const budgetLeft =
      opts.maxQuestions > 0 ? opts.maxQuestions - questionsGenerated : Infinity;
    if (budgetLeft <= 0) {
      console.log(`\n⏹️  Ліміт --max-questions ${opts.maxQuestions}`);
      break;
    }

    console.log(`\n[${i + 1}/${gaps.length}] ${job.path.join(' > ')} / ${job.difficulty}`);
    const result = await fillJob(job, opts, budgetLeft);
    report.results.push(result);
    questionsGenerated += result.added;
  }

  const remaining = collectGapsForOpts(opts);
  report.summary.after = summarizeNodeGaps(remaining);
  report.totalAdded = report.results.reduce((s, r) => s + r.added, 0);
  report.readyCount = report.results.filter((r) => r.ready).length;
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf8');

  console.log('\n======================================================');
  console.log(`✅ Додано: ${report.totalAdded} · готово комбінацій: ${report.readyCount}/${report.results.length}`);
  if (remaining.length > 0) {
    console.log(`⚠️  Залишилось: ${remaining.length} (~${remaining.reduce((s, g) => s + g.gap, 0)} питань)`);
    console.log('   npm run fill-practice-nodes');
  } else {
    console.log('🎉 Усі підтеми готові!');
  }
  console.log(`📄 ${REPORT_FILE}`);
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
