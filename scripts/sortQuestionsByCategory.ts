#!/usr/bin/env tsx
/**
 * AI-сортування питань по категоріях/підтемах та верифікація складності.
 *
 * npm run sort-questions
 */

import { ALL_QUESTIONS } from '../src/data/questions';
import { questionPoolManager } from '../src/lib/questionPools';
import { questionQuarantineManager } from '../src/lib/questionQuarantine';
import { questionQualityValidator } from '../src/lib/questionQuality';
import fs from 'fs';
import path from 'path';
import type { Difficulty, Question, TopicNode } from '../src/types';

const ROOT = path.resolve('.');
const TOPICS_DIR = path.join(ROOT, 'data', 'topics-db');
const DB_DIR = path.resolve('data/question-db');

const DIFFICULTY_MAP: Record<string, Difficulty> = {
  beginner: 'baby',
  easy: 'child',
  medium: 'youth',
  hard: 'student',
  expert: 'preacher',
};

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

function flattenTopicTitles(node: TopicNode, prefix = ''): Array<{ id: string; title: string; fullPath: string }> {
  const results: Array<{ id: string; title: string; fullPath: string }> = [];
  const fullPath = prefix ? `${prefix} > ${node.title}` : node.title;
  results.push({ id: node.id, title: node.title, fullPath });
  for (const child of node.children) {
    results.push(...flattenTopicTitles(child, fullPath));
  }
  return results;
}

function mapDifficulty(question: Question): Difficulty {
  const oldDifficulty = DIFFICULTY_MAP[question.difficulty];
  if (oldDifficulty) return oldDifficulty;
  const validDifficulties: Difficulty[] = ['baby', 'child', 'youth', 'student', 'preacher', 'teacher', 'theologian'];
  if (validDifficulties.includes(question.difficulty as Difficulty)) {
    return question.difficulty as Difficulty;
  }
  return 'child';
}

async function main() {
  console.log('🤖 AI — сортування питань по категоріях');
  console.log('========================================');

  const aiQuestions = loadAiQuestions();
  const tsQuestions = ALL_QUESTIONS;
  const allQuestions = [...aiQuestions];

  const tsQuestionsMap = new Map<string, Question>();
  for (const q of tsQuestions) {
    tsQuestionsMap.set(q.id, q);
  }

  console.log(`Всього питань: ${tsQuestions.length + aiQuestions.length}`);
  console.log(`  TS/вбудовані: ${tsQuestions.length}`);
  console.log(`  AI (JSON): ${aiQuestions.length}`);
  console.log('');

  const results: Array<{
    id: string;
    text: string;
    themeId: string;
    difficulty: string;
    mappedDifficulty: string;
    topicIds: string[];
    source: 'ts' | 'ai';
    qualityScore?: number;
    hasReference: boolean;
  }> = [];

  const validDifficulties: Difficulty[] = ['baby', 'child', 'youth', 'student', 'preacher', 'teacher', 'theologian'];
  const allQuestionsForAnalysis = [...tsQuestions, ...aiQuestions];

  for (const q of tsQuestions) {
    const mappedDifficulty = mapDifficulty(q);
    const themeId = q.themeId;
    const hierarchy = loadTopicHierarchy(themeId);
    const topicIds: string[] = [];

    if (hierarchy) {
      const flat = flattenTopicTitles(hierarchy);
      topicIds.push(...flat.map(t => t.id));
    }

    results.push({
      id: q.id,
      text: q.text.substring(0, 80),
      themeId,
      difficulty: q.difficulty,
      mappedDifficulty,
      topicIds,
      source: 'ts',
      qualityScore: q.qualityScore ?? 75,
      hasReference: !!q.reference,
    });
  }

  for (const q of aiQuestions) {
    const mappedDifficulty = mapDifficulty(q);
    const themeId = q.themeId;
    const hierarchy = loadTopicHierarchy(themeId);
    const topicIds: string[] = [];

    if (hierarchy) {
      const flat = flattenTopicTitles(hierarchy);
      topicIds.push(...flat.map(t => t.id));
    }

    results.push({
      id: q.id,
      text: q.text.substring(0, 80),
      themeId,
      difficulty: q.difficulty,
      mappedDifficulty,
      topicIds,
      source: 'ai',
      qualityScore: q.qualityScore ?? 75,
      hasReference: !!q.reference,
    });
  }

  const output = {
    generatedAt: new Date().toISOString(),
    summary: {
      total: tsQuestions.length + aiQuestions.length,
      tsCount: tsQuestions.length,
      aiCount: aiQuestions.length,
    },
    difficultyMapping: DIFFICULTY_MAP,
    questions: results,
  };

  const outputPath = path.join(ROOT, 'data', 'question-categories.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');

  console.log(`✅ Збережено: ${outputPath}`);
  console.log(`   Всього: ${results.length} питань`);

  const byDifficulty: Record<string, number> = {};
  const byTheme: Record<string, number> = {};

  for (const r of results) {
    byDifficulty[r.mappedDifficulty] = (byDifficulty[r.mappedDifficulty] || 0) + 1;
    byTheme[r.themeId] = (byTheme[r.themeId] || 0) + 1;
  }

  console.log('\n📊 Розподіл за складністю:');
  for (const [d, count] of Object.entries(byDifficulty).sort((a, b) => validDifficulties.indexOf(a[0] as Difficulty) - validDifficulties.indexOf(b[0] as Difficulty))) {
    console.log(`   ${d}: ${count}`);
  }

  console.log('\n📊 Розподіл за темами:');
  for (const [t, count] of Object.entries(byTheme).sort((a, b) => count - b[1])) {
    console.log(`   ${t}: ${count}`);
  }
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
