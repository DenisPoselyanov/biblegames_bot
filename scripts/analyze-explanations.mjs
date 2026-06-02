#!/usr/bin/env node
/**
 * Аналіз якості пояснень (евристики + опційно Ollama).
 *
 * npm run analyze-explanations
 * npm run analyze-explanations -- --theme geography --coverage missing
 * npm run analyze-explanations -- --ai --ai-only --ai-limit 10 --skip-scored
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadAllQuestionsMerged, resolveSubtopicContextFromQuestion } from './lib/topic-context.mjs';
import { analyzeAllQuestions, summarizeReport } from './lib/explanationQuality.mjs';
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'data', 'explanation-quality-report.json');
loadProjectEnv();
const { provider: DEFAULT_PROVIDER, model: DEFAULT_MODEL } = defaultAiOpts();

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    theme: null,
    node: null,
    coverage: null,
    issue: null,
    minScore: 0,
    maxScore: 100,
    limit: 0,
    ai: false,
    aiOnly: false,
    aiLimit: 0,
    skipScored: false,
    rescore: false,
    provider: DEFAULT_PROVIDER,
    model: DEFAULT_MODEL,
    delayMs: 400,
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
    else if (a === '--ai') opts.ai = true;
    else if (a === '--ai-only') opts.aiOnly = true;
    else if (a === '--ai-limit' && args[i + 1]) opts.aiLimit = parseInt(args[++i], 10);
    else if (a === '--skip-scored') opts.skipScored = true;
    else if (a === '--rescore') opts.rescore = true;
    else if (a === '--provider' && args[i + 1]) opts.provider = args[++i];
    else if (a === '--model' && args[i + 1]) opts.model = args[++i];
    else if (a === '--delay' && args[i + 1]) opts.delayMs = parseInt(args[++i], 10);
  }
  applyAiCliFlags(opts, args);

  if (opts.ai && !opts.rescore) opts.skipScored = true;

  return opts;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadAllQuestions() {
  return loadAllQuestionsMerged();
}

function loadPreviousById() {
  const map = new Map();
  if (!fs.existsSync(REPORT_PATH)) return map;
  try {
    const prev = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
    for (const r of prev.reports ?? []) {
      map.set(r.questionId, r);
    }
  } catch {
    /* ignore */
  }
  return map;
}

function filterReports(reports, opts, byId = null) {
  return reports.filter((r) => {
    if (opts.theme && r.themeId !== opts.theme) return false;
    if (opts.node) {
      const q = byId?.get(r.questionId);
      if (q?.topicNodeId !== opts.node) return false;
    }
    if (opts.coverage && r.coverage !== opts.coverage) return false;
    if (r.heuristicScore < opts.minScore || r.heuristicScore > opts.maxScore) return false;
    if (opts.issue && !r.issues?.some((i) => i.type === opts.issue)) return false;
    return true;
  });
}

function hasAiScore(report) {
  return report.aiScore != null && report.aiScore !== '' && !Number.isNaN(Number(report.aiScore));
}

function buildAiScorePrompt(question, report) {
  const subtopic = resolveSubtopicContextFromQuestion(question);
  const subtopicLine = subtopic ? `Підтема: ${subtopic.pathStr}` : '';
  const correct = question.options?.[question.correctIndex ?? 0] ?? '';
  const issueLines = (report.issues || []).map((i) => `- [${i.severity}] ${i.type}: ${i.message}`);
  return `Ти біблійний експерт. Оціни якість пояснення до вікторинного питання українською.
${subtopicLine ? `\n${subtopicLine}` : ''}

Питання: ${question.text}
Правильна відповідь: ${correct}
Посилання: ${question.reference ?? 'немає'}
Складність: ${question.difficulty}

Коротке пояснення: ${question.explanationShort ?? '(немає)'}
Детальне пояснення: ${question.explanationDeep ?? '(немає)'}

Проблеми евристики:
${issueLines.join('\n') || '- немає'}

Оціни 0-100: accuracy (теологічна точність), clarity (зрозумілість), pedagogicalValue (навчальна цінність), ageAppropriate (відповідність складності).
Дай короткий summary українською (1-2 речення).

Відповідай ТІЛЬКИ JSON:
{"accuracy":80,"clarity":75,"pedagogicalValue":70,"ageAppropriate":85,"summary":"...","overallScore":78}`;
}

function parseAiScore(raw) {
  try {
    const obj = extractJsonObject(raw);
    const scores = [
      obj.accuracy,
      obj.clarity,
      obj.pedagogicalValue,
      obj.ageAppropriate,
    ].filter((n) => typeof n === 'number');
    const overall =
      typeof obj.overallScore === 'number'
        ? obj.overallScore
        : scores.length
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : null;
    return {
      aiScore: overall,
      aiDetails: {
        accuracy: obj.accuracy,
        clarity: obj.clarity,
        pedagogicalValue: obj.pedagogicalValue,
        ageAppropriate: obj.ageAppropriate,
        summary: obj.summary ?? '',
      },
    };
  } catch {
    return { aiScore: null, aiDetails: null };
  }
}

async function main() {
  const opts = parseArgs();
  const allQuestions = loadAllQuestions();
  const byId = new Map(allQuestions.map((q) => [q.id, q]));
  const previousById = loadPreviousById();

  if (opts.ai && opts.aiOnly) {
    console.log('🤖 AI-оцінка пояснень (лише нові)\n');
  } else {
    console.log('📖 Аналіз якості пояснень\n');
  }

  let allReports = analyzeAllQuestions(allQuestions, previousById);

  if (opts.ai) {
    console.log(`⏳ Перевірка ${providerLabel(opts.provider)} (${opts.model})...`);
    await checkLLM(opts.model, { provider: opts.provider });
    console.log('✅ Ollama online\n');

    let candidates = allReports.filter((r) => r.coverage !== 'missing');
    if (opts.skipScored && !opts.rescore) {
      const before = candidates.length;
      candidates = candidates.filter((r) => !hasAiScore(r));
      console.log(`⏭ Пропущено вже оцінених: ${before - candidates.length}`);
    }

    candidates = filterReports(candidates, opts, byId);

    const aiLimit = opts.aiLimit > 0 ? opts.aiLimit : opts.limit > 0 ? opts.limit : 50;
    const toScore = candidates.slice(0, aiLimit);

    console.log(
      `📋 З поясненням у фільтрі: ${candidates.length}, оцінимо зараз: ${toScore.length} (ліміт ${aiLimit})\n`,
    );

    if (!toScore.length) {
      console.log('Немає питань для AI-оцінки (усі вже оцінені або фільтр порожній).');
    }

    const reportById = new Map(allReports.map((r) => [r.questionId, r]));

    for (let i = 0; i < toScore.length; i++) {
      const report = toScore[i];
      const question = byId.get(report.questionId);
      if (!question) continue;

      const prompt = buildAiScorePrompt(question, report);
      try {
        const raw = await queryLLM(prompt, {
          model: opts.model,
          provider: opts.provider,
          temperature: 0.2,
          format: 'json',
        });
        const { aiScore, aiDetails } = parseAiScore(raw);
        const target = reportById.get(report.questionId);
        if (target) {
          target.aiScore = aiScore;
          target.aiDetails = aiDetails;
        }
        console.log(`  [${i + 1}/${toScore.length}] ${report.questionId}: AI ${aiScore ?? '?'}/100`);
      } catch (e) {
        if (isRateLimitError(undefined, e.message)) {
          const waitMs = parseRateLimitRetryDelayMs(e.message);
          console.warn(
            `  ⏳ ${report.questionId}: ліміт Gemini — повтор через ${(waitMs / 1000).toFixed(1)}s…`,
          );
          await sleep(waitMs);
          i -= 1;
          continue;
        }
        console.warn(`  ⚠ ${report.questionId}: ${e.message}`);
      }
      if (i < toScore.length - 1) await sleep(opts.delayMs);
    }

    allReports = [...reportById.values()];
  } else if (opts.theme || opts.node || opts.coverage || opts.issue || opts.minScore > 0 || opts.maxScore < 100) {
    allReports = filterReports(allReports, opts, byId);
    if (opts.limit > 0) allReports = allReports.slice(0, opts.limit);
  } else if (opts.limit > 0) {
    allReports = allReports.slice(0, opts.limit);
  }

  const output = {
    generatedAt: new Date().toISOString(),
    summary: summarizeReport(allReports),
    reports: allReports,
  };

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(output, null, 2), 'utf8');

  const scored = allReports.filter((r) => hasAiScore(r)).length;
  console.log('\n📊 Підсумок:');
  console.log(`   Всього: ${output.summary.total}`);
  console.log(`   Без пояснення: ${output.summary.missing}`);
  console.log(`   Лише short: ${output.summary.short_only}`);
  console.log(`   Повні (short+deep): ${output.summary.complete}`);
  console.log(`   Середній бал: ${output.summary.avgHeuristicScore}/100`);
  console.log(`   Слабкі (<50): ${output.summary.weak}`);
  if (opts.ai) console.log(`   З AI-оцінкою: ${scored}`);
  console.log(`\n💾 Звіт: ${REPORT_PATH}`);
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
