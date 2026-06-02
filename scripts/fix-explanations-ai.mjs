#!/usr/bin/env node
/**
 * AI-генерація та правка пояснень (Ollama). Не змінює text/options.
 *
 * npm run fix-explanations-ai -- --coverage missing --theme paul --limit 20
 * npm run fix-explanations-ai -- --ids geo-child-ai-00042 --mode improve
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getTheme } from './lib/themes-config.mjs';
import {
  buildSubtopicPromptBlock,
  loadAllQuestionsMerged,
  resolveSubtopicContextFromQuestion,
} from './lib/topic-context.mjs';
import {
  applyAiCliFlags,
  checkLLM,
  defaultAiOpts,
  extractJsonObject,
  isRateLimitError,
  loadProjectEnv,
  parseRateLimitRetryDelayMs,
  providerLabel,
  queryLLM,
  unavailableHint,
} from './lib/llm.mjs';
import { loadAllDbQuestions, loadThemeQuestions, saveThemeQuestions } from './lib/question-db.mjs';
import { getExplanationCoverage } from './lib/explanationQuality.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'data', 'explanation-quality-report.json');
loadProjectEnv();
const { provider: DEFAULT_PROVIDER, model: DEFAULT_MODEL } = defaultAiOpts();
const API_BASE = process.env.API_BASE || process.env.VITE_API_BASE_URL || 'http://localhost:3001';
const TRANSLATION = process.env.BOLLS_DEFAULT_TRANSLATION || 'UTT';

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    theme: null,
    node: null,
    coverage: 'all',
    issue: null,
    minScore: 0,
    maxScore: 100,
    limit: 0,
    ids: null,
    mode: 'generate',
    dryRun: false,
    provider: DEFAULT_PROVIDER,
    model: DEFAULT_MODEL,
    delayMs: 400,
    useScripture: true,
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--theme' && args[i + 1]) opts.theme = args[++i];
    else if (a === '--node' && args[i + 1]) opts.node = args[++i];
    else if (a === '--topic' && args[i + 1]) opts.node = args[++i];
    else if (a === '--coverage' && args[i + 1]) opts.coverage = args[++i];
    else if (a === '--issue' && args[i + 1]) opts.issue = args[++i];
    else if (a === '--min-score' && args[i + 1]) opts.minScore = Number(args[++i]);
    else if (a === '--max-score' && args[i + 1]) opts.maxScore = Number(args[++i]);
    else if (a === '--limit' && args[i + 1]) opts.limit = parseInt(args[++i], 10);
    else if (a === '--ids' && args[i + 1]) {
      opts.ids = args[++i].split(',').map((s) => s.trim()).filter(Boolean);
    }
    else if (a === '--mode' && args[i + 1]) opts.mode = args[++i];
    else if (a === '--provider' && args[i + 1]) opts.provider = args[++i];
    else if (a === '--model' && args[i + 1]) opts.model = args[++i];
    else if (a === '--delay' && args[i + 1]) opts.delayMs = parseInt(args[++i], 10);
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--no-scripture') opts.useScripture = false;
  }
  applyAiCliFlags(opts, args);

  return opts;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function buildQuestionIndex() {
  const byId = new Map();
  for (const q of loadAllQuestionsMerged()) {
    byId.set(q.id, q);
  }
  return byId;
}

function loadReport() {
  if (!fs.existsSync(REPORT_PATH)) return { reports: [], summary: {} };
  try {
    return JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
  } catch {
    return { reports: [], summary: {} };
  }
}

function filterReports(reports, opts, byId) {
  return reports.filter((r) => {
    if (opts.ids && !opts.ids.includes(r.questionId)) return false;
    if (opts.theme && r.themeId !== opts.theme) return false;
    if (opts.node) {
      const q = byId.get(r.questionId);
      if (q?.topicNodeId !== opts.node) return false;
    }
    if (opts.coverage && opts.coverage !== 'all' && r.coverage !== opts.coverage) return false;
    if (r.heuristicScore < opts.minScore || r.heuristicScore > opts.maxScore) return false;
    if (opts.issue && !r.issues?.some((i) => i.type === opts.issue)) return false;
    const q = byId.get(r.questionId);
    if (!q || q._source !== 'db') return false;
    return true;
  });
}

async function fetchScriptureText(reference) {
  if (!reference) return '';
  const ref = Array.isArray(reference) ? reference[0] : String(reference).split(/[;|]/)[0]?.trim();
  if (!ref) return '';
  try {
    const url = `${API_BASE}/api/scripture?${new URLSearchParams({ ref, translation: TRANSLATION })}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return '';
    const data = await res.json();
    const verses = (data.verses ?? []).map((v) => v.text).filter(Boolean);
    return verses.join(' ').slice(0, 800);
  } catch {
    return '';
  }
}

function resolveMode(question, report, opts) {
  if (opts.mode !== 'generate') return opts.mode;
  const cov = getExplanationCoverage(question);
  if (cov === 'missing') return 'generate';
  if (cov === 'short_only') return 'expand';
  return 'improve';
}

function buildFixPrompt(question, report, scriptureText, mode) {
  const subtopic = resolveSubtopicContextFromQuestion(question);
  const subtopicBlock = subtopic
    ? buildSubtopicPromptBlock(subtopic, question.difficulty)
    : `Тема: ${getTheme(question.themeId)?.title ?? question.themeId}`;
  const correct = question.options?.[question.correctIndex ?? 0] ?? '';
  const issueLines = (report?.issues ?? []).map(
    (i) => `- [${i.severity}] ${i.type}: ${i.message}`,
  );

  const modeHint =
    mode === 'generate'
      ? 'Створи пояснення з нуля.'
      : mode === 'expand'
        ? 'Залиш коротке пояснення, додай або покращ детальне (explanationDeep).'
        : 'Покращ існуючі пояснення, виправ проблеми.';

  return `Ти біблійний експерт. ${modeHint} НЕ змінюй текст питання та варіанти відповіді.

${subtopicBlock}

Питання: ${question.text}
Варіанти: ${JSON.stringify(question.options)}
Правильна відповідь (індекс ${question.correctIndex}): ${correct}
Посилання: ${question.reference ?? 'немає'}

Поточні пояснення:
- explanationShort: ${question.explanationShort ?? '(немає)'}
- explanationDeep: ${question.explanationDeep ?? '(немає)'}

${scriptureText ? `Текст Писання (для точності):\n${scriptureText}\n` : ''}

Проблеми якості:
${issueLines.join('\n') || '- загальне покращення'}

ВИМОГИ:
1. explanationShort: 1-3 речення, чому правильна відповідь; без переліку всіх варіантів
2. explanationDeep: 2-5 речень, історичний/біблійний контекст (для режиму навчання)
3. Українською, без вигаданих фактів
4. Узгоджено з посиланням ${question.reference ?? ''}

Відповідай ТІЛЬКИ JSON:
{"explanationShort":"...","explanationDeep":"..."}`;
}

function applyExplanationFix(original, raw, mode) {
  const short = String(raw.explanationShort ?? '').trim();
  const deep = String(raw.explanationDeep ?? '').trim();

  if (!short && !deep) return null;

  const fixed = { ...original };
  delete fixed._source;

  if (mode === 'expand' && original.explanationShort && !short) {
    fixed.explanationShort = original.explanationShort;
  } else if (short) {
    fixed.explanationShort = short;
  }

  if (deep) fixed.explanationDeep = deep;
  else if (mode !== 'expand' && !short && original.explanationDeep) {
    /* keep */
  }

  fixed.sourceQuality = 'ai-reviewed';
  fixed.lastReviewedAt = new Date().toISOString();
  fixed.topicNodeId = original.topicNodeId;
  fixed.topicPath = original.topicPath;

  return fixed;
}

function upsertQuestion(question) {
  const themeId = question.themeId;
  if (!themeId) return false;
  const list = loadThemeQuestions(themeId);
  const idx = list.findIndex((q) => q.id === question.id);
  if (idx >= 0) list[idx] = question;
  else list.push(question);
  saveThemeQuestions(themeId, list);
  return true;
}

async function main() {
  const opts = parseArgs();
  console.log('🤖 AI: пояснення до питань (Ollama)\n');

  if (!opts.dryRun) {
    console.log(`⏳ Перевірка ${providerLabel(opts.provider)} (${opts.model})...`);
    await checkLLM(opts.model, { provider: opts.provider });
    console.log('✅ Ollama online\n');
  }

  const byId = buildQuestionIndex();
  const report = loadReport();
  let targets = filterReports(report.reports || [], opts, byId);

  if (opts.ids) {
    targets = opts.ids
      .map((id) => {
        const q = byId.get(id);
        if (!q || q._source !== 'db') return null;
        const existing = (report.reports || []).find((r) => r.questionId === id);
        return existing ?? {
          questionId: id,
          themeId: q.themeId,
          coverage: getExplanationCoverage(q),
          heuristicScore: 0,
          issues: [],
        };
      })
      .filter(Boolean);
  }

  if (opts.limit > 0) targets = targets.slice(0, opts.limit);

  if (!targets.length) {
    console.log('Немає цільових питань (db + фільтр). Спочатку: npm run analyze-explanations');
    process.exit(0);
  }

  console.log(`Ціль: ${targets.length} питань, режим: ${opts.mode}\n`);

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < targets.length; i++) {
    const tr = targets[i];
    const question = byId.get(tr.questionId);
    if (!question) {
      fail += 1;
      continue;
    }

    const mode = resolveMode(question, tr, opts);
    const scriptureText =
      opts.useScripture && question.reference
        ? await fetchScriptureText(question.reference)
        : '';

    const prompt = buildFixPrompt(question, tr, scriptureText, mode);

    if (opts.dryRun) {
      console.log(`  [dry-run] ${tr.questionId} (${mode})`);
      ok += 1;
      continue;
    }

    try {
      const raw = await queryLLM(prompt, {
        model: opts.model,
        provider: opts.provider,
        temperature: 0.4,
        format: 'json',
      });
      const parsed = extractJsonObject(raw);
      const fixed = applyExplanationFix(question, parsed, mode);
      if (!fixed) {
        console.warn(`  ⚠ ${tr.questionId}: порожня відповідь AI`);
        fail += 1;
        continue;
      }
      if (upsertQuestion(fixed)) {
        console.log(`  ✅ [${i + 1}/${targets.length}] ${tr.questionId}`);
        ok += 1;
      } else {
        fail += 1;
      }
    } catch (e) {
      if (isRateLimitError(undefined, e.message)) {
        const waitMs = parseRateLimitRetryDelayMs(e.message);
        console.warn(
          `  ⏳ ${tr.questionId}: ліміт Gemini — повтор через ${(waitMs / 1000).toFixed(1)}s…`,
        );
        await sleep(waitMs);
        i -= 1;
        continue;
      }
      console.warn(`  ❌ ${tr.questionId}: ${e.message}`);
      fail += 1;
    }

    if (i < targets.length - 1) await sleep(opts.delayMs);
  }

  console.log(`\nГотово: ${ok} успішно, ${fail} помилок`);
  if (!opts.dryRun && ok > 0) {
    console.log('💡 Оновіть звіт: npm run analyze-explanations');
  }
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
