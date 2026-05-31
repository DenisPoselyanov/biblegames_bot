#!/usr/bin/env tsx
/**
 * AI-сортування питань по категоріях/підтемах та верифікація складності.
 *
 * Класифікує кожне питання у вузли ієрархії тем (data/topics-db/*.json) і
 * застосовує topicNodeId/topicPath:
 *   - AI-питання → data/question-db/<theme>.json
 *   - вбудовані → data/question-topic-tags.json (підхоплює src/data/questions.ts)
 *
 * Запуск:
 *   npm run sort-questions               # heuristic only
 *   npm run sort-questions -- --ai       # AI лише для неоднозначних (heuristic = корінь)
 *   npm run sort-questions -- --ai --ai-all   # AI для кожного питання (повільно!)
 *   npm run sort-questions -- --ai --limit 100
 *   npm run sort-questions -- --ai --limit 50 --resume   # продовжити з question-categories.json
 *   npm run sort-questions -- --theme paul
 *   npm run sort-questions -- --dry-run  # лише звіт, без запису
 */

import { ALL_QUESTIONS } from '../src/data/questions';
import fs from 'fs';
import path from 'path';
import type { Difficulty, Question, TopicNode } from '../src/types';
import {
  applyAiCliFlags,
  checkLLM,
  defaultAiOpts,
  extractJson,
  loadProjectEnv,
  queryLLM,
} from './lib/llm.mjs';
import { loadThemeQuestions, saveThemeQuestions } from './lib/question-db.mjs';
import { loadTopicHierarchy } from './lib/themes-config.mjs';
import {
  buildNodePath,
  deepestMatchedNodeId,
  flattenTopicTitles,
  matchTopicIdsForQuestion,
} from './lib/topic-match.mjs';

const ROOT = path.resolve('.');
const DB_DIR = path.resolve('data/question-db');
const TAGS_PATH = path.join(ROOT, 'data', 'question-topic-tags.json');
const CATEGORIES_PATH = path.join(ROOT, 'data', 'question-categories.json');
loadProjectEnv();
const { provider: DEFAULT_PROVIDER, model: DEFAULT_MODEL } = defaultAiOpts();
const MAX_AI_CANDIDATES = 40;
const AI_CLASSIFY_TIMEOUT_MS = 120_000;

/** Старі ключі складності → нові (legacy migration) */
const DIFFICULTY_MAP: Record<string, Difficulty> = {
  beginner: 'baby',
  easy: 'child',
  medium: 'youth',
  hard: 'student',
  expert: 'preacher',
};

const VALID_DIFFICULTIES: Difficulty[] = ['baby', 'child', 'youth', 'student', 'preacher', 'teacher', 'theologian'];

interface CliOpts {
  ai: boolean;
  aiAll: boolean;
  limit: number;
  theme: string | null;
  provider: string;
  model: string;
  dryRun: boolean;
  resume: boolean;
}

interface SavedQuestionEntry {
  id: string;
  topicNodeId: string;
  topicPath: string;
  topicIds: string[];
  aiTopicIds?: string[];
  aiAttempted?: boolean;
}

interface PreviousReport {
  byId: Map<string, SavedQuestionEntry>;
  options?: { ai?: boolean; aiAll?: boolean; limit?: number };
  summary?: { aiAttempts?: number };
}

interface QuestionAssignment {
  topicNodeId: string;
  topicPath: string;
  topicIds: string[];
  aiTopicIds?: string[];
}

function parseArgs(): CliOpts {
  const args = process.argv.slice(2);
  const opts: CliOpts = {
    ai: false,
    aiAll: false,
    limit: 0,
    theme: null,
    provider: DEFAULT_PROVIDER,
    model: DEFAULT_MODEL,
    dryRun: false,
    resume: false,
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--ai') opts.ai = true;
    else if (args[i] === '--ai-all') opts.aiAll = true;
    else if (args[i] === '--limit' && args[i + 1]) opts.limit = parseInt(args[++i], 10) || 0;
    else if (args[i] === '--theme' && args[i + 1]) opts.theme = args[++i];
    else if (args[i] === '--provider' && args[i + 1]) opts.provider = args[++i];
    else if (args[i] === '--model' && args[i + 1]) opts.model = args[++i];
    else if (args[i] === '--dry-run') opts.dryRun = true;
    else if (args[i] === '--resume') opts.resume = true;
  }
  applyAiCliFlags(opts, args);
  return opts;
}

function logLine(message: string) {
  process.stdout.write(`${message}\n`);
}

function loadAiQuestions(): Question[] {
  if (!fs.existsSync(DB_DIR)) return [];
  const all: Question[] = [];
  for (const file of fs.readdirSync(DB_DIR).filter(f => f.endsWith('.json'))) {
    try {
      const data: Question[] = JSON.parse(fs.readFileSync(path.join(DB_DIR, file), 'utf-8'));
      all.push(...data);
    } catch { /* skip broken json */ }
  }
  return all;
}

function mapDifficulty(question: Question): Difficulty {
  const oldDifficulty = DIFFICULTY_MAP[question.difficulty];
  if (oldDifficulty) return oldDifficulty;
  if (VALID_DIFFICULTIES.includes(question.difficulty as Difficulty)) {
    return question.difficulty as Difficulty;
  }
  return 'child';
}

function needsAiRefinement(question: Question, hierarchy: TopicNode): boolean {
  const matched = matchTopicIdsForQuestion(question, hierarchy);
  const deepest = deepestMatchedNodeId(matched, hierarchy);
  return !deepest || deepest === hierarchy.id;
}

function pickAiCandidates(
  question: Question,
  hierarchy: TopicNode,
  max = MAX_AI_CANDIDATES,
) {
  const flat = flattenTopicTitles(hierarchy).filter(n => n.id !== hierarchy.id);
  if (flat.length <= max) return flat;

  const preferred = new Set(matchTopicIdsForQuestion(question, hierarchy));
  const head = flat.filter(n => preferred.has(n.id));
  const tail = flat.filter(n => !preferred.has(n.id));
  return [...head, ...tail].slice(0, max);
}

function resolveAssignment(
  question: Question,
  hierarchy: TopicNode,
  aiIds?: string[],
): QuestionAssignment | null {
  const heuristicIds = matchTopicIdsForQuestion(question, hierarchy);
  const combined = aiIds?.length
    ? Array.from(new Set([...heuristicIds, ...aiIds]))
    : heuristicIds;
  const topicNodeId = deepestMatchedNodeId(combined, hierarchy);
  if (!topicNodeId) return null;
  const pathTitles = buildNodePath(hierarchy, topicNodeId) ?? [hierarchy.title];
  return {
    topicNodeId,
    topicPath: pathTitles.join(' > '),
    topicIds: combined,
    aiTopicIds: aiIds,
  };
}

async function aiClassifyQuestion(
  question: Question,
  hierarchy: TopicNode,
  model: string,
  provider: string,
): Promise<string[] | null> {
  const candidates = pickAiCandidates(question, hierarchy);
  if (candidates.length === 0) return null;

  const candidatesText = candidates
    .map(c => `- ${c.id} :: ${c.fullPath}${c.description ? ` — ${c.description}` : ''}`)
    .join('\n');

  const prompt = `Ти експерт-теолог. Класифікуй біблійне вікторинне питання у найдоречніші вузли ієрархії підтем.

Питання: "${question.text}"
Правильна відповідь: "${question.options[question.correctIndex] ?? ''}"
${question.reference ? `Біблійне посилання: ${question.reference}` : ''}

Доступні підтеми (id :: повний шлях):
${candidatesText}

Поверни до 3 НАЙКРАЩИХ id-ів вузлів, де питання логічно належить. Якщо жоден не підходить — повертай порожній масив.

Відповідай ТІЛЬКИ JSON-масивом id-ів:
["id1","id2"]`;

  try {
    const raw = await queryLLM(prompt, {
      model,
      provider,
      temperature: 0.1,
      timeoutMs: AI_CLASSIFY_TIMEOUT_MS,
      format: 'json',
    });
    const parsed = extractJson(raw);
    if (!Array.isArray(parsed)) return null;
    const validIds = new Set(candidates.map(c => c.id));
    return parsed.map(String).filter(id => validIds.has(id));
  } catch {
    return null;
  }
}

function loadPreviousReport(): PreviousReport {
  const byId = new Map<string, SavedQuestionEntry>();
  if (!fs.existsSync(CATEGORIES_PATH)) return { byId };
  try {
    const data = JSON.parse(fs.readFileSync(CATEGORIES_PATH, 'utf8')) as {
      questions?: SavedQuestionEntry[];
      options?: PreviousReport['options'];
      summary?: PreviousReport['summary'];
    };
    for (const entry of data.questions ?? []) {
      byId.set(entry.id, entry);
    }
    return { byId, options: data.options, summary: data.summary };
  } catch {
    return { byId };
  }
}

/** Старі звіти без aiAttempted — відновлюємо з options.limit + summary.aiAttempts */
function hydrateLegacyAiAttempts(
  previous: PreviousReport,
  all: Array<{ q: Question; source: 'ts' | 'ai' }>,
): number {
  const aiAttempts = previous.summary?.aiAttempts ?? 0;
  if (!previous.options?.ai || aiAttempts <= 0) return 0;

  const limit = previous.options.limit ?? 0;
  const uncertainOnly = previous.options.ai && !previous.options.aiAll && limit === 0;
  let marked = 0;

  for (const { q } of all) {
    if (marked >= aiAttempts) break;
    const entry = previous.byId.get(q.id);
    if (!entry || isAiAlreadyProcessed(entry)) continue;
    const hierarchy = loadTopicHierarchy(q.themeId) as TopicNode | null;
    if (!hierarchy) continue;
    if (!questionNeedsAi(q, hierarchy, {
      ai: true,
      aiAll: !!previous.options.aiAll,
      limit,
      theme: null,
      model: '',
      dryRun: false,
      resume: false,
    }, uncertainOnly)) {
      continue;
    }
    entry.aiAttempted = true;
    marked++;
  }
  return marked;
}

function isAiAlreadyProcessed(prev: SavedQuestionEntry | undefined): boolean {
  if (!prev) return false;
  if (prev.aiTopicIds && prev.aiTopicIds.length > 0) return true;
  return prev.aiAttempted === true;
}

function questionNeedsAi(
  q: Question,
  hierarchy: TopicNode,
  opts: CliOpts,
  uncertainOnly: boolean,
): boolean {
  return opts.aiAll || !uncertainOnly || needsAiRefinement(q, hierarchy);
}

function loadExistingEmbeddedTags(): Record<string, { topicNodeId: string; topicPath: string }> {
  if (!fs.existsSync(TAGS_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(TAGS_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function applyAssignments(
  assignments: Map<string, QuestionAssignment & { source: 'ts' | 'ai'; themeId: string }>,
  dryRun: boolean,
) {
  const embeddedTags = loadExistingEmbeddedTags();
  let dbUpdated = 0;
  let dbUnchanged = 0;
  let embeddedUpdated = 0;
  let embeddedUnchanged = 0;

  const dbByTheme = new Map<string, Question[]>();
  for (const [qid, item] of assignments) {
    if (item.source !== 'ai') continue;
    if (!dbByTheme.has(item.themeId)) {
      dbByTheme.set(item.themeId, loadThemeQuestions(item.themeId));
    }
    const list = dbByTheme.get(item.themeId)!;
    const q = list.find(x => x.id === qid);
    if (!q) continue;
    if (q.topicNodeId === item.topicNodeId && q.topicPath === item.topicPath) {
      dbUnchanged++;
      continue;
    }
    q.topicNodeId = item.topicNodeId;
    q.topicPath = item.topicPath;
    dbUpdated++;
  }

  for (const [qid, item] of assignments) {
    if (item.source !== 'ts') continue;
    const prev = embeddedTags[qid];
    if (prev?.topicNodeId === item.topicNodeId && prev?.topicPath === item.topicPath) {
      embeddedUnchanged++;
      continue;
    }
    embeddedTags[qid] = { topicNodeId: item.topicNodeId, topicPath: item.topicPath };
    embeddedUpdated++;
  }

  if (!dryRun) {
    for (const [themeId, questions] of dbByTheme) {
      saveThemeQuestions(themeId, questions);
    }
    fs.writeFileSync(TAGS_PATH, JSON.stringify(embeddedTags, null, 2), 'utf8');
  }

  return { dbUpdated, dbUnchanged, embeddedUpdated, embeddedUnchanged };
}

async function main() {
  const opts = parseArgs();

  logLine('🤖 AI — сортування питань по категоріях');
  logLine('========================================');
  if (opts.ai) {
    logLine(`AI-режим увімкнено (модель: ${opts.model})`);
    if (opts.aiAll) {
      logLine('Режим --ai-all: Ollama для КОЖНОГО питання (може тривати годинами)');
    } else if (opts.limit > 0) {
      logLine(`AI ліміт: ${opts.limit} запитів`);
    } else {
      logLine('AI лише для неоднозначних (heuristic = корінь теми). Для всіх: --ai-all');
    }
  } else {
    logLine('Heuristic-режим (без AI). Для Ollama у launcher увімкни «--ai (Ollama)»');
  }
  if (opts.theme) logLine(`Лише тема: ${opts.theme}`);
  if (opts.resume) logLine('Resume — пропуск AI для вже оброблених (question-categories.json)');
  if (opts.dryRun) logLine('Dry-run — файли не змінюються');
  logLine('');

  const previousReport = opts.resume ? loadPreviousReport() : { byId: new Map<string, SavedQuestionEntry>() };
  const previousById = previousReport.byId;
  if (opts.resume) {
    if (previousById.size === 0) {
      logLine('⚠️  Resume: question-categories.json не знайдено або порожній — старт з нуля\n');
    } else {
      logLine(`📂 Resume: завантажено ${previousById.size} записів з попереднього звіту`);
    }
  }

  let aiAvailable = false;
  if (opts.ai) {
    logLine(`🔗 Перевірка AI (${opts.provider})...`);
    try {
      aiAvailable = await checkLLM(opts.model, { provider: opts.provider, quick: true });
      logLine('✅ AI online, модель доступна\n');
    } catch (e) {
      logLine(`⚠️  ${e instanceof Error ? e.message : e}`);
      logLine('Fallback на heuristic-режим\n');
    }
  }

  const aiQuestions = loadAiQuestions();
  const tsQuestions = opts.theme
    ? ALL_QUESTIONS.filter(q => q.themeId === opts.theme)
    : ALL_QUESTIONS;
  const aiFiltered = opts.theme
    ? aiQuestions.filter(q => q.themeId === opts.theme)
    : aiQuestions;

  logLine(`Всього питань для обробки: ${tsQuestions.length + aiFiltered.length}`);
  logLine(`  TS/вбудовані: ${tsQuestions.length}`);
  logLine(`  AI (JSON): ${aiFiltered.length}`);
  logLine('');

  const results: Array<{
    id: string;
    text: string;
    themeId: string;
    difficulty: string;
    mappedDifficulty: string;
    topicNodeId: string;
    topicPath: string;
    topicIds: string[];
    aiTopicIds?: string[];
    aiAttempted?: boolean;
    source: 'ts' | 'ai';
    qualityScore?: number;
    hasReference: boolean;
  }> = [];

  const assignments = new Map<string, QuestionAssignment & { source: 'ts' | 'ai'; themeId: string }>();

  const all = [
    ...tsQuestions.map(q => ({ q, source: 'ts' as const })),
    ...aiFiltered.map(q => ({ q, source: 'ai' as const })),
  ];

  if (opts.resume && previousById.size > 0) {
    const legacy = hydrateLegacyAiAttempts(previousReport, all);
    if (legacy > 0) {
      logLine(`   Resume: відновлено ${legacy} AI-спроб зі старого звіту (без aiAttempted)`);
    }
    logLine('');
  }

  let aiCalls = 0;
  let aiAttempts = 0;
  let aiSkippedHeuristic = 0;
  let aiResumedSkipped = 0;
  let aiQuota = opts.limit > 0 ? opts.limit : Number.POSITIVE_INFINITY;
  const uncertainOnly = opts.ai && !opts.aiAll && opts.limit === 0;
  let skippedNoHierarchy = 0;
  const skippedByTheme: Record<string, number> = {};

  const countPendingAi = () => all.filter(({ q }) => {
    const h = loadTopicHierarchy(q.themeId) as TopicNode | null;
    if (!h) return false;
    if (opts.resume && isAiAlreadyProcessed(previousById.get(q.id))) return false;
    return questionNeedsAi(q, h, opts, uncertainOnly);
  }).length;

  if (aiAvailable) {
    const pendingAi = countPendingAi();
    if (opts.resume && previousById.size > 0) {
      const resumed = all.filter(({ q }) => {
        const h = loadTopicHierarchy(q.themeId) as TopicNode | null;
        return h && opts.resume && isAiAlreadyProcessed(previousById.get(q.id));
      }).length;
      if (resumed > 0) {
        logLine(`   Resume: пропустить ${resumed} вже оброблених AI-запитів`);
      }
    }
    if (uncertainOnly) {
      logLine(`⏳ Класифікація… неоднозначних для AI: ${pendingAi} (≈${Math.ceil(pendingAi * 0.5)}–${pendingAi} хв на 9b)`);
    } else {
      const planned = Number.isFinite(aiQuota) ? Math.min(pendingAi, aiQuota) : pendingAi;
      logLine(`⏳ Класифікація… AI-запитів планується: ${planned}`);
    }
  }

  for (let i = 0; i < all.length; i++) {
    const { q, source } = all[i];
    const mappedDifficulty = mapDifficulty(q);
    const hierarchy = loadTopicHierarchy(q.themeId) as TopicNode | null;

    if (!hierarchy) {
      skippedNoHierarchy++;
      skippedByTheme[q.themeId] = (skippedByTheme[q.themeId] || 0) + 1;
      continue;
    }

    const prev = previousById.get(q.id);
    let aiIds: string[] | undefined = prev?.aiTopicIds?.length ? prev.aiTopicIds : undefined;
    const alreadyProcessed = opts.resume && isAiAlreadyProcessed(prev);
    const needsAi = questionNeedsAi(q, hierarchy, opts, uncertainOnly);
    const shouldTryAi = aiAvailable
      && !alreadyProcessed
      && aiAttempts < aiQuota
      && needsAi;

    let aiAttempted = prev?.aiAttempted === true;

    if (shouldTryAi) {
      aiAttempts++;
      aiAttempted = true;
      logLine(`   [${i + 1}/${all.length}] 🤖 ${q.id} (${q.themeId})…`);
      const proposed = await aiClassifyQuestion(q, hierarchy, opts.model, opts.provider);
      if (proposed && proposed.length > 0) {
        aiIds = proposed;
        aiCalls++;
      }
    } else if (alreadyProcessed) {
      aiResumedSkipped++;
    } else if (aiAvailable && uncertainOnly && !needsAiRefinement(q, hierarchy)) {
      aiSkippedHeuristic++;
    }

    const assignment = resolveAssignment(q, hierarchy, aiIds);
    if (!assignment) continue;

    assignments.set(q.id, { ...assignment, source, themeId: q.themeId });

    results.push({
      id: q.id,
      text: q.text.substring(0, 80),
      themeId: q.themeId,
      difficulty: q.difficulty,
      mappedDifficulty,
      topicNodeId: assignment.topicNodeId,
      topicPath: assignment.topicPath,
      topicIds: assignment.topicIds,
      aiTopicIds: assignment.aiTopicIds,
      aiAttempted: aiAttempted || undefined,
      source,
      qualityScore: q.qualityScore ?? 75,
      hasReference: !!q.reference,
    });
  }

  if (aiAvailable) {
    logLine('');
    logLine(`   AI запитів: ${aiAttempts}, успішно: ${aiCalls}, resume: ${aiResumedSkipped}, heuristic OK: ${aiSkippedHeuristic}`);
  }

  const applyStats = applyAssignments(assignments, opts.dryRun);

  const output = {
    generatedAt: new Date().toISOString(),
    options: {
      ai: aiAvailable,
      aiAll: opts.aiAll,
      limit: opts.limit,
      theme: opts.theme,
      model: opts.model,
      dryRun: opts.dryRun,
      resume: opts.resume,
    },
    summary: {
      total: results.length,
      tsCount: tsQuestions.length,
      aiCount: aiFiltered.length,
      aiAttempts,
      aiClassifiedCount: results.filter(r => r.aiTopicIds && r.aiTopicIds.length > 0).length,
      aiResumedSkipped,
      aiSkippedHeuristic,
      skippedNoHierarchy,
      skippedByTheme,
      dbUpdated: applyStats.dbUpdated,
      dbUnchanged: applyStats.dbUnchanged,
      embeddedUpdated: applyStats.embeddedUpdated,
      embeddedUnchanged: applyStats.embeddedUnchanged,
    },
    difficultyMapping: DIFFICULTY_MAP,
    questions: results,
  };

  if (!opts.dryRun) {
    fs.writeFileSync(CATEGORIES_PATH, JSON.stringify(output, null, 2), 'utf8');
  }

  logLine(`\n✅ Збережено: ${CATEGORIES_PATH}${opts.dryRun ? ' (dry-run — пропущено)' : ''}`);
  logLine(`   Класифіковано: ${results.length} питань`);
  logLine(`   AI-класифіковано: ${output.summary.aiClassifiedCount}`);
  if (opts.ai && !aiAvailable) {
    logLine('   ⚠️  Ollama була недоступна — AI-крок пропущено');
  } else if (opts.ai && output.summary.aiClassifiedCount === 0 && aiAttempts > 0) {
    logLine('   ℹ️  AI не знайшла додаткових підтем (heuristic уже достатньо)');
  }
  if (skippedNoHierarchy > 0) {
    logLine(`   ⚠️  Без ієрархії topics-db: ${skippedNoHierarchy}`);
    for (const [themeId, count] of Object.entries(skippedByTheme).sort((a, b) => b[1] - a[1])) {
      logLine(`      • ${themeId}: ${count}`);
    }
  }
  logLine('\n📥 Застосовано теги:');
  logLine(`   question-db: оновлено ${applyStats.dbUpdated}, без змін ${applyStats.dbUnchanged}`);
  logLine(`   question-topic-tags (TS): оновлено ${applyStats.embeddedUpdated}, без змін ${applyStats.embeddedUnchanged}`);
  if (
    !opts.dryRun
    && applyStats.dbUpdated === 0
    && applyStats.embeddedUpdated === 0
    && (applyStats.dbUnchanged > 0 || applyStats.embeddedUnchanged > 0)
  ) {
    logLine('   ℹ️  Теги вже актуальні — повторний запис не потрібен');
  }
  if (opts.dryRun) {
    logLine('   (dry-run — запис у файли не виконувався)');
  }

  const byDifficulty: Record<string, number> = {};

  for (const r of results) {
    byDifficulty[r.mappedDifficulty] = (byDifficulty[r.mappedDifficulty] || 0) + 1;
  }

  logLine('\n📊 Розподіл за складністю:');
  for (const [d, count] of Object.entries(byDifficulty).sort(
    (a, b) => VALID_DIFFICULTIES.indexOf(a[0] as Difficulty) - VALID_DIFFICULTIES.indexOf(b[0] as Difficulty),
  )) {
    logLine(`   ${d}: ${count}`);
  }

  logLine('\n📊 Розподіл за темами:');
  for (const [t, count] of Object.entries(
    results.reduce<Record<string, number>>((acc, r) => {
      acc[r.themeId] = (acc[r.themeId] || 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1])) {
    logLine(`   ${t}: ${count}`);
  }
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
