#!/usr/bin/env tsx
/**
 * AI-сортування питань по категоріях/підтемах та верифікація складності.
 *
 * Класифікує кожне питання у вузли ієрархії тем (data/topics-db/*.json):
 *   - Завжди приписує питання до кореня (теми)
 *   - Розширює класифікацію до підтем за збігом назв (heuristic)
 *   - Якщо Ollama доступна та використовується прапорець --ai — використовує AI
 *     для уточнення приналежності питання до найкращого вузла.
 *
 * Запуск:
 *   npm run sort-questions               # heuristic only
 *   npm run sort-questions -- --ai       # додає AI-уточнення (потребує Ollama)
 *   npm run sort-questions -- --ai --limit 100   # обмежити кількість AI-запитів
 *   npm run sort-questions -- --theme paul
 */

import { ALL_QUESTIONS } from '../src/data/questions';
import fs from 'fs';
import path from 'path';
import type { Difficulty, Question, TopicNode } from '../src/types';
import { checkOllama, extractJson, queryOllama } from './lib/ollama.mjs';

const ROOT = path.resolve('.');
const TOPICS_DIR = path.join(ROOT, 'data', 'topics-db');
const DB_DIR = path.resolve('data/question-db');
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'mistral';

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
  limit: number;
  theme: string | null;
  model: string;
}

function parseArgs(): CliOpts {
  const args = process.argv.slice(2);
  const opts: CliOpts = { ai: false, limit: 0, theme: null, model: DEFAULT_MODEL };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--ai') opts.ai = true;
    else if (args[i] === '--limit' && args[i + 1]) opts.limit = parseInt(args[++i], 10) || 0;
    else if (args[i] === '--theme' && args[i + 1]) opts.theme = args[++i];
    else if (args[i] === '--model' && args[i + 1]) opts.model = args[++i];
  }
  return opts;
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

function loadTopicHierarchy(themeId: string): TopicNode | null {
  const p = path.join(TOPICS_DIR, `${themeId}.json`);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function flattenTopicTitles(node: TopicNode, prefix = ''): Array<{ id: string; title: string; fullPath: string; description: string }> {
  const results: Array<{ id: string; title: string; fullPath: string; description: string }> = [];
  const fullPath = prefix ? `${prefix} > ${node.title}` : node.title;
  results.push({ id: node.id, title: node.title, fullPath, description: node.description || '' });
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      results.push(...flattenTopicTitles(child, fullPath));
    }
  }
  return results;
}

function findNodeById(node: TopicNode, id: string): TopicNode | null {
  if (node.id === id) return node;
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      const found = findNodeById(child, id);
      if (found) return found;
    }
  }
  return null;
}

function questionMatchesTopicNode(question: Question, node: TopicNode): boolean {
  const correctAnswer = question.options[question.correctIndex] ?? '';
  const relevantText = (question.text + ' ' + correctAnswer).toLowerCase();

  const nodeTitle = node.title.toLowerCase();
  if (nodeTitle.length > 2 && relevantText.includes(nodeTitle)) {
    return true;
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      const childTitle = child.title.toLowerCase();
      if (childTitle.length > 2 && relevantText.includes(childTitle)) {
        return true;
      }
    }
  }

  return false;
}

function matchTopicIdsForQuestion(question: Question, hierarchy: TopicNode): string[] {
  const matched: string[] = [hierarchy.id];
  const flat = flattenTopicTitles(hierarchy);
  for (const entry of flat) {
    if (entry.id === hierarchy.id) continue;
    const node = findNodeById(hierarchy, entry.id);
    if (node && questionMatchesTopicNode(question, node)) {
      matched.push(entry.id);
    }
  }
  return matched;
}

function mapDifficulty(question: Question): Difficulty {
  const oldDifficulty = DIFFICULTY_MAP[question.difficulty];
  if (oldDifficulty) return oldDifficulty;
  if (VALID_DIFFICULTIES.includes(question.difficulty as Difficulty)) {
    return question.difficulty as Difficulty;
  }
  return 'child';
}

async function aiClassifyQuestion(
  question: Question,
  hierarchy: TopicNode,
  model: string,
): Promise<string[] | null> {
  const flat = flattenTopicTitles(hierarchy);
  // Виключаємо корінь — він і так додається
  const candidates = flat.filter(n => n.id !== hierarchy.id);
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
    const raw = await queryOllama(prompt, model, { temperature: 0.1 });
    const parsed = extractJson(raw);
    if (!Array.isArray(parsed)) return null;
    const validIds = new Set(candidates.map(c => c.id));
    return parsed.map(String).filter(id => validIds.has(id));
  } catch {
    return null;
  }
}

async function main() {
  const opts = parseArgs();

  console.log('🤖 AI — сортування питань по категоріях');
  console.log('========================================');
  if (opts.ai) console.log(`AI-режим увімкнено (модель: ${opts.model})`);
  if (opts.theme) console.log(`Лише тема: ${opts.theme}`);
  if (opts.limit > 0) console.log(`AI ліміт: ${opts.limit} питань`);
  console.log('');

  const aiAvailable = opts.ai
    ? await checkOllama(opts.model).catch(() => false)
    : false;

  if (opts.ai && !aiAvailable) {
    console.warn('⚠️  Ollama недоступна — fallback на heuristic-режим');
  }

  const aiQuestions = loadAiQuestions();
  const tsQuestions = opts.theme
    ? ALL_QUESTIONS.filter(q => q.themeId === opts.theme)
    : ALL_QUESTIONS;
  const aiFiltered = opts.theme
    ? aiQuestions.filter(q => q.themeId === opts.theme)
    : aiQuestions;

  console.log(`Всього питань для обробки: ${tsQuestions.length + aiFiltered.length}`);
  console.log(`  TS/вбудовані: ${tsQuestions.length}`);
  console.log(`  AI (JSON): ${aiFiltered.length}`);
  console.log('');

  const results: Array<{
    id: string;
    text: string;
    themeId: string;
    difficulty: string;
    mappedDifficulty: string;
    topicIds: string[];
    aiTopicIds?: string[];
    source: 'ts' | 'ai';
    qualityScore?: number;
    hasReference: boolean;
  }> = [];

  const all = [
    ...tsQuestions.map(q => ({ q, source: 'ts' as const })),
    ...aiFiltered.map(q => ({ q, source: 'ai' as const })),
  ];

  let aiCalls = 0;
  for (let i = 0; i < all.length; i++) {
    const { q, source } = all[i];
    const mappedDifficulty = mapDifficulty(q);
    const hierarchy = loadTopicHierarchy(q.themeId);
    const heuristicIds: string[] = hierarchy ? matchTopicIdsForQuestion(q, hierarchy) : [];

    let aiIds: string[] | undefined;
    if (aiAvailable && hierarchy && (opts.limit === 0 || aiCalls < opts.limit)) {
      const proposed = await aiClassifyQuestion(q, hierarchy, opts.model);
      if (proposed && proposed.length > 0) {
        aiIds = proposed;
        aiCalls++;
      }
      if (aiCalls % 25 === 0 && aiCalls > 0) {
        console.log(`   …AI оброблено ${aiCalls} питань`);
      }
    }

    const combined = aiIds
      ? Array.from(new Set([...heuristicIds, ...aiIds]))
      : heuristicIds;

    results.push({
      id: q.id,
      text: q.text.substring(0, 80),
      themeId: q.themeId,
      difficulty: q.difficulty,
      mappedDifficulty,
      topicIds: combined,
      aiTopicIds: aiIds,
      source,
      qualityScore: q.qualityScore ?? 75,
      hasReference: !!q.reference,
    });
  }

  const output = {
    generatedAt: new Date().toISOString(),
    options: { ai: aiAvailable, limit: opts.limit, theme: opts.theme, model: opts.model },
    summary: {
      total: results.length,
      tsCount: tsQuestions.length,
      aiCount: aiFiltered.length,
      aiClassifiedCount: results.filter(r => r.aiTopicIds && r.aiTopicIds.length > 0).length,
    },
    difficultyMapping: DIFFICULTY_MAP,
    questions: results,
  };

  const outputPath = path.join(ROOT, 'data', 'question-categories.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');

  console.log(`\n✅ Збережено: ${outputPath}`);
  console.log(`   Всього: ${results.length} питань`);
  console.log(`   AI-класифіковано: ${output.summary.aiClassifiedCount}`);

  const byDifficulty: Record<string, number> = {};
  const byTheme: Record<string, number> = {};

  for (const r of results) {
    byDifficulty[r.mappedDifficulty] = (byDifficulty[r.mappedDifficulty] || 0) + 1;
    byTheme[r.themeId] = (byTheme[r.themeId] || 0) + 1;
  }

  console.log('\n📊 Розподіл за складністю:');
  for (const [d, count] of Object.entries(byDifficulty).sort(
    (a, b) => VALID_DIFFICULTIES.indexOf(a[0] as Difficulty) - VALID_DIFFICULTIES.indexOf(b[0] as Difficulty),
  )) {
    console.log(`   ${d}: ${count}`);
  }

  console.log('\n📊 Розподіл за темами:');
  for (const [t, count] of Object.entries(byTheme).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${t}: ${count}`);
  }
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
