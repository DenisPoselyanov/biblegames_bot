#!/usr/bin/env node
/**
 * AI-правка питань з карантину / звіту якості (Ollama).
 *
 * npm run fix-questions-ai
 * npm run fix-questions-ai -- --status quarantined --issue duplicate --limit 10
 * npm run fix-questions-ai -- --node pentateuch-sub-1-sub-1 --dry-run
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
import { loadThemeQuestions, saveThemeQuestions } from './lib/question-db.mjs';
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
const REPORT_PATH = path.join(ROOT, 'question-quality-report.json');
loadProjectEnv();
const { provider: DEFAULT_PROVIDER, model: DEFAULT_MODEL } = defaultAiOpts();

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    status: 'quarantined',
    theme: null,
    node: null,
    issue: null,
    minScore: 0,
    maxScore: 100,
    limit: 0,
    ids: null,
    dryRun: false,
    approve: true,
    provider: DEFAULT_PROVIDER,
    model: DEFAULT_MODEL,
    delayMs: 400,
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--status' && args[i + 1]) opts.status = args[++i];
    else if (a === '--theme' && args[i + 1]) opts.theme = args[++i];
    else if (a === '--node' && args[i + 1]) opts.node = args[++i];
    else if (a === '--topic' && args[i + 1]) opts.node = args[++i];
    else if (a === '--issue' && args[i + 1]) opts.issue = args[++i];
    else if (a === '--min-score' && args[i + 1]) opts.minScore = Number(args[++i]);
    else if (a === '--max-score' && args[i + 1]) opts.maxScore = Number(args[++i]);
    else if (a === '--limit' && args[i + 1]) opts.limit = parseInt(args[++i], 10);
    else if (a === '--ids' && args[i + 1]) {
      opts.ids = args[++i].split(',').map((s) => s.trim()).filter(Boolean);
    }
    else if (a === '--provider' && args[i + 1]) opts.provider = args[++i];
    else if (a === '--model' && args[i + 1]) opts.model = args[++i];
    else if (a === '--delay' && args[i + 1]) opts.delayMs = parseInt(args[++i], 10);
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--no-approve') opts.approve = false;
  }
  applyAiCliFlags(opts, args);

  return opts;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadReport() {
  if (!fs.existsSync(REPORT_PATH)) {
    console.error('❌ Немає question-quality-report.json — спочатку npm run analyze-quality');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
}

function buildQuestionIndex() {
  const byId = new Map();
  for (const q of loadAllQuestionsMerged()) {
    byId.set(q.id, q);
  }
  return byId;
}

function filterReports(reports, opts) {
  return reports.filter((r) => {
    if (opts.status !== 'all' && r.status !== opts.status) return false;
    if (r.qualityScore < opts.minScore || r.qualityScore > opts.maxScore) return false;
    if (opts.issue && !r.issues?.some((i) => i.type === opts.issue)) return false;
    return true;
  });
}

function themeForReport(report, byId) {
  const q = byId.get(report.questionId);
  return q?.themeId ?? null;
}

function buildFixPrompt(question, report, byId) {
  const subtopic = resolveSubtopicContextFromQuestion(question);
  const subtopicBlock = subtopic
    ? buildSubtopicPromptBlock(subtopic, question.difficulty)
    : `Тема: ${getTheme(question.themeId)?.title ?? question.themeId}\n⚠️ Питання без topicNodeId — додай прив’язку до підтеми вручну після правки.`;
  const issueLines = (report.issues || []).map(
    (i) => `- [${i.severity}] ${i.type}: ${i.message}`,
  );
  let dupBlock = '';
  if (report.duplicateIds?.length) {
    const lines = report.duplicateIds
      .map((id) => {
        const dq = byId.get(id);
        return dq ? `  • "${dq.text}" (${id})` : `  • ${id}`;
      })
      .join('\n');
    dupBlock = `\nСхожі питання (перефразуй, щоб відрізнялось):\n${lines}\n`;
  }

  const payload = {
    text: question.text,
    options: question.options,
    correct: question.correctIndex,
    ref: question.reference ?? '',
    difficulty: question.difficulty,
  };

  return `Ти біблійний експерт. Виправ або доповни вікторинне питання українською.

${subtopicBlock}

Поточне питання:
${JSON.stringify(payload, null, 2)}

Проблеми якості:
${issueLines.join('\n') || '- загальне покращення формулювання'}
${dupBlock}
ВИМОГИ:
1. Збережи підтему та рівень складності ${question.difficulty}
2. Рівно 4 унікальні варіанти; неправильні — правдоподібні з цієї підтеми
3. "correct" — індекс 0–3
4. Обовʼязково "ref" (біблійне посилання)
5. Якщо duplicate — зміни кут питання в межах цієї підтеми
6. Без вигаданих фактів
7. Блоки по 10 питань (етапи) — унікальне формулювання

Відповідай ТІЛЬКИ JSON-обʼєктом:
{"text":"...","options":["A","B","V","G"],"correct":1,"ref":"Бут. 1:1","explanationShort":"..."}`;
}

function applyFix(original, raw) {
  const text = String(raw.text ?? '').trim();
  if (!text) return null;

  const options = (raw.options || []).map((o) => String(o).trim()).filter(Boolean);
  if (options.length !== 4) return null;
  if (new Set(options.map((o) => o.toLowerCase())).size !== 4) return null;

  let correctIndex = typeof raw.correct === 'number' ? raw.correct : raw.correctIndex;
  if (typeof correctIndex !== 'number' || correctIndex < 0 || correctIndex > 3) correctIndex = 0;

  const ref = String(raw.ref ?? raw.reference ?? '').trim();

  const fixed = {
    ...original,
    text,
    options,
    correctIndex,
    reference: ref || original.reference || undefined,
    topicNodeId: original.topicNodeId,
    topicPath: original.topicPath,
    quarantined: false,
    sourceQuality: 'ai-reviewed',
    lastReviewedAt: new Date().toISOString(),
  };
  delete fixed._source;

  const explS = String(raw.explanationShort ?? '').trim();
  const explD = String(raw.explanationDeep ?? '').trim();
  if (explS) fixed.explanationShort = explS;
  if (explD) fixed.explanationDeep = explD;

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

function recalcSummary(report) {
  const reports = report.reports || [];
  report.summary = {
    ...(report.summary || {}),
    total: reports.length,
    approved: reports.filter((r) => r.status === 'approved').length,
    quarantined: reports.filter((r) => r.status === 'quarantined').length,
    pending: reports.filter((r) => r.status === 'pending').length,
    rejected: reports.filter((r) => r.status === 'rejected').length,
  };
}

async function main() {
  const opts = parseArgs();
  console.log('🤖 AI-правка питань (Ollama)\n');

  if (!opts.dryRun) {
    console.log(`⏳ Перевірка ${providerLabel(opts.provider)} (${opts.model})...`);
    const ok = await checkLLM(opts.model, { provider: opts.provider });
    if (!ok) {
      console.error(`❌ ${providerLabel(opts.provider)} недоступний. ${unavailableHint(opts.provider)}`);
      process.exit(1);
    }
    console.log('✅ Ollama online\n');
  }

  const report = loadReport();
  const byId = buildQuestionIndex();
  let targets = filterReports(report.reports || [], opts);

  if (opts.theme) {
    targets = targets.filter((r) => themeForReport(r, byId) === opts.theme);
  }

  if (opts.node) {
    targets = targets.filter((r) => byId.get(r.questionId)?.topicNodeId === opts.node);
  }

  if (opts.ids?.length) {
    const idSet = new Set(opts.ids);
    targets = targets.filter((r) => idSet.has(r.questionId));
  }

  if (opts.limit > 0) targets = targets.slice(0, opts.limit);

  if (targets.length === 0) {
    console.log('ℹ️  Немає питань за обраними фільтрами.');
    return;
  }

  console.log(`📋 До обробки: ${targets.length} питань`);
  if (opts.dryRun) console.log('   (dry-run — без запису)\n');

  let fixed = 0;
  let failed = 0;
  const now = new Date().toISOString();

  for (let i = 0; i < targets.length; i++) {
    const item = targets[i];
    const qid = item.questionId;
    const original = byId.get(qid);
    if (!original) {
      console.log(`⚠️  [${i + 1}/${targets.length}] ${qid} — не знайдено в базі, пропуск`);
      failed++;
      continue;
    }

    console.log(`\n⏳ [${i + 1}/${targets.length}] ${qid}`);
    console.log(`   ${original.text.slice(0, 72)}${original.text.length > 72 ? '…' : ''}`);

    if (opts.dryRun) {
      console.log('   (dry-run)');
      continue;
    }

    try {
      const prompt = buildFixPrompt(original, item, byId);
      const raw = await queryLLM(prompt, {
        model: opts.model,
        provider: opts.provider,
        temperature: 0.35,
        timeoutMs: 240000,
      });
      const parsed = extractJsonObject(raw);
      const updated = applyFix(original, parsed);
      if (!updated) {
        console.log('   ✘ AI повернув невалідні дані');
        failed++;
        continue;
      }

      if (!upsertQuestion(updated)) {
        console.log('   ✘ Помилка збереження');
        failed++;
        continue;
      }

      if (opts.approve) {
        item.status = 'approved';
        item.reviewedAt = now;
      }

      byId.set(qid, { ...updated, _source: 'db' });
      fixed++;
      console.log(`   ✔ збережено → ${updated.text.slice(0, 60)}…`);
    } catch (err) {
      if (isRateLimitError(undefined, err.message)) {
        const waitMs = parseRateLimitRetryDelayMs(err.message);
        console.log(
          `   ⏳ ${qid}: ліміт Gemini — повтор через ${(waitMs / 1000).toFixed(1)}s…`,
        );
        await sleep(waitMs);
        i -= 1;
        continue;
      }
      console.log(`   ✘ ${err.message}`);
      failed++;
    }

    if (i < targets.length - 1 && opts.delayMs > 0) {
      await sleep(opts.delayMs);
    }
  }

  if (!opts.dryRun && opts.approve && fixed > 0) {
    recalcSummary(report);
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
    console.log('\n📄 Оновлено question-quality-report.json');
  }

  console.log(`\n✅ Готово: виправлено ${fixed}, помилок ${failed}, всього ${targets.length}`);
  if (fixed > 0 && !opts.dryRun) {
    console.log('💡 Запусти npm run analyze-quality для повторної перевірки.');
  }
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
