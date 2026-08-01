#!/usr/bin/env node
/**
 * AI assignment of practice stage counts per leaf subtopic (biblical richness, not question pool).
 *
 * npm run assign-practice-stages
 * npm run assign-practice-stages -- --theme acts --max-jobs 5
 * npm run assign-practice-stages -- --group old-testament
 * npm run assign-practice-stages -- --bootstrap-fallback
 * npm run assign-practice-stages -- --dry-run --node acts-sub-6-sub-5
 */

import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { collectAllLeafNodes, collectExtensionLeafNodes } from './lib/topic-node-pool-stats.mjs';
import { resolveSubtopicContext } from './lib/topic-context.mjs';
import { DIFFICULTIES, findTopicNodeGlobally, getGroup } from './lib/themes-config.mjs';
import {
  applyAiCliFlags,
  checkLLM,
  defaultAiOpts,
  loadProjectEnv,
  providerLabel,
  queryLLM,
  unavailableHint,
} from './lib/llm.mjs';
import {
  buildPracticeStagePrompt,
  buildFallbackStages,
  parsePracticeStageResponse,
  DEFAULT_FALLBACK_BASE_STAGES,
} from './lib/practice-stage-prompt.mjs';
import {
  loadPracticeStageConfig,
  savePracticeStageConfig,
  PRACTICE_STAGE_CONFIG_PATH,
} from './lib/practice-stage-config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const REPORT_FILE = join(ROOT, 'data/practice-stages-ai-report.json');

loadProjectEnv();
const { provider: DEFAULT_PROVIDER, model: DEFAULT_MODEL } = defaultAiOpts();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** baby → theologian, напр. stages: 3/3/2/2/2/1/1 */
function formatStagesSlashed(stages) {
  return DIFFICULTIES.map((d) => stages[d] ?? '?').join('/');
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    theme: null,
    group: null,
    node: null,
    dryRun: false,
    resume: true,
    bootstrapFallback: false,
    maxJobs: 0,
    delayMs: 800,
    retries: 2,
    provider: DEFAULT_PROVIDER,
    model: DEFAULT_MODEL,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--theme' && args[i + 1]) opts.theme = args[++i];
    else if (args[i] === '--group' && args[i + 1]) opts.group = args[++i];
    else if (args[i] === '--node' && args[i + 1]) opts.node = args[++i];
    else if (args[i] === '--dry-run') opts.dryRun = true;
    else if (args[i] === '--no-resume') opts.resume = false;
    else if (args[i] === '--bootstrap-fallback') opts.bootstrapFallback = true;
    else if (args[i] === '--max-jobs' && args[i + 1]) opts.maxJobs = parseInt(args[++i], 10);
    else if (args[i] === '--delay-ms' && args[i + 1]) opts.delayMs = parseInt(args[++i], 10);
    else if (args[i] === '--provider' && args[i + 1]) opts.provider = args[++i];
    else if (args[i] === '--model' && args[i + 1]) opts.model = args[++i];
  }
  applyAiCliFlags(opts, args);
  return opts;
}

function hasPracticeStagesOverride(nodeId) {
  const hit = findTopicNodeGlobally(nodeId);
  const ps = hit?.node?.practiceStages;
  return ps && typeof ps === 'object' && Object.keys(ps).length > 0;
}

function collectJobs(opts) {
  if (opts.group) {
    const group = getGroup(opts.group);
    if (!group) throw new Error(`Невідома група: ${opts.group}`);
    const themeIds = [...group.themeIds, ...(group.aggregateExtraThemeIds ?? [])];
    const seen = new Set();
    const leaves = [];
    for (const themeId of themeIds) {
      for (const leaf of collectAllLeafNodes(themeId)) {
        if (seen.has(leaf.nodeId)) continue;
        seen.add(leaf.nodeId);
        leaves.push(leaf);
      }
    }
    for (const leaf of collectExtensionLeafNodes(opts.group)) {
      if (seen.has(leaf.nodeId)) continue;
      seen.add(leaf.nodeId);
      leaves.push(leaf);
    }
    if (opts.node) return leaves.filter((l) => l.nodeId === opts.node);
    return leaves;
  }

  let leaves = collectAllLeafNodes(opts.theme ?? null);
  if (opts.node) leaves = leaves.filter((l) => l.nodeId === opts.node);
  return leaves;
}

async function assessWithAi(context, opts) {
  const prompt = buildPracticeStagePrompt(context);
  if (opts.dryRun) {
    console.log('\n--- PROMPT ---\n');
    console.log(prompt.slice(0, 1200));
    console.log('\n--- (dry-run, без запиту) ---\n');
    return {
      biblicalRichness: 2,
      recommendedBaseStages: 2,
      stages: buildFallbackStages(2),
      reasoning: '(dry-run)',
    };
  }

  let lastErr;
  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    try {
      const raw = await queryLLM(prompt, { model: opts.model, provider: opts.provider });
      return parsePracticeStageResponse(raw);
    } catch (e) {
      lastErr = e;
      if (attempt < opts.retries) await sleep(1500 * (attempt + 1));
    }
  }
  throw lastErr;
}

function bootstrapEntry() {
  const stages = buildFallbackStages(DEFAULT_FALLBACK_BASE_STAGES);
  return {
    biblicalRichness: DEFAULT_FALLBACK_BASE_STAGES,
    recommendedBaseStages: DEFAULT_FALLBACK_BASE_STAGES,
    reasoning: 'Bootstrap fallback (без AI)',
    stages,
    source: 'bootstrap',
  };
}

async function main() {
  const opts = parseArgs();
  const jobs = collectJobs(opts);
  const config = loadPracticeStageConfig(true);
  const report = {
    generatedAt: new Date().toISOString(),
    provider: opts.provider,
    model: opts.model,
    bootstrapFallback: opts.bootstrapFallback,
    results: [],
    errors: [],
  };

  console.log(`Підтем (листи): ${jobs.length}`);
  console.log(`Manifest: ${PRACTICE_STAGE_CONFIG_PATH}`);

  if (!opts.dryRun && !opts.bootstrapFallback) {
    console.log(`Провайдер: ${providerLabel(opts.provider)} • модель: ${opts.model}`);
    try {
      const ok = await checkLLM(opts.model, { provider: opts.provider });
      if (!ok) throw new Error('LLM недоступний');
      console.log(`✅ ${providerLabel(opts.provider)} працює\n`);
    } catch (e) {
      console.error(`❌ ${e.message}`);
      console.error(`💡 ${unavailableHint(opts.provider)}`);
      process.exit(1);
    }
  }

  let processed = 0;
  for (const leaf of jobs) {
    if (opts.maxJobs > 0 && processed >= opts.maxJobs) break;

    const nodeId = leaf.nodeId;
    if (opts.resume && config.nodes[nodeId] && !opts.bootstrapFallback) {
      if (!opts.dryRun) continue;
    }
    if (hasPracticeStagesOverride(nodeId)) {
      report.results.push({ nodeId, title: leaf.title, skipped: 'practiceStages override in topics-db' });
      continue;
    }

    const context = resolveSubtopicContext(nodeId);
    if (!context) {
      report.errors.push({ nodeId, error: 'no context' });
      continue;
    }

    try {
      let entry;
      if (opts.bootstrapFallback) {
        entry = bootstrapEntry();
      } else {
        entry = await assessWithAi(context, opts);
        entry.source = 'ai';
      }

      if (!opts.dryRun) {
        config.nodes[nodeId] = {
          biblicalRichness: entry.biblicalRichness,
          recommendedBaseStages: entry.recommendedBaseStages,
          reasoning: entry.reasoning,
          stages: entry.stages,
        };
        savePracticeStageConfig({
          ...config,
          version: 1,
          generatedAt: new Date().toISOString(),
          provider: opts.bootstrapFallback ? 'bootstrap' : opts.provider,
          model: opts.bootstrapFallback ? 'fallback' : opts.model,
        });
      }

      report.results.push({
        nodeId,
        title: leaf.title,
        path: leaf.path,
        ...entry,
      });
      processed++;
      console.log(
        `  ✓ ${leaf.title}: richness=${entry.biblicalRichness} stages: ${formatStagesSlashed(entry.stages)}`,
      );

      if (!opts.dryRun && !opts.bootstrapFallback && opts.delayMs > 0) {
        await sleep(opts.delayMs);
      }
    } catch (e) {
      const fallback = bootstrapEntry();
      fallback.reasoning = `AI помилка: ${e.message}. Fallback.`;
      fallback.source = 'error-fallback';
      if (!opts.dryRun) {
        config.nodes[nodeId] = {
          biblicalRichness: fallback.biblicalRichness,
          recommendedBaseStages: fallback.recommendedBaseStages,
          reasoning: fallback.reasoning,
          stages: fallback.stages,
        };
        savePracticeStageConfig(config);
      }
      report.errors.push({ nodeId, title: leaf.title, error: String(e.message) });
      console.warn(`  ⚠ ${leaf.title}: ${e.message} → fallback 2`);
      processed++;
    }
  }

  if (!opts.dryRun) {
    fs.writeFileSync(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`\nЗвіт: ${REPORT_FILE}`);
    console.log(`У manifest: ${Object.keys(config.nodes).length} вузлів`);
  } else {
    console.log(`\nDry-run: оброблено ${report.results.length} (без запису)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
