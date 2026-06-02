#!/usr/bin/env tsx
/**
 * Скрипт для аналізу якості питань та знаходження схожих питань
 * Аналізує як вбудовані (TS), так і AI-генеровані питання (JSON з data/question-db/)
 */
import { ALL_QUESTIONS as QUESTIONS } from '../src/data/questions';
import { questionQualityValidator } from '../src/lib/questionQuality';
import { questionQuarantineManager } from '../src/lib/questionQuarantine';
import fs from 'fs';
import path from 'path';
import type { Question, QuestionQualityReport } from '../src/types';
import { normalizeQuestionReference } from '../src/lib/bibleReference';

const DB_DIR = path.resolve('data/question-db');
const REPORT_PATH = path.resolve('question-quality-report.json');

function loadPreviousReport(): {
  rejectedIds: Set<string>;
  excludedIds: Set<string>;
  byId: Map<string, QuestionQualityReport>;
} {
  const rejectedIds = new Set<string>();
  const excludedIds = new Set<string>();
  const byId = new Map<string, QuestionQualityReport>();
  if (!fs.existsSync(REPORT_PATH)) {
    return { rejectedIds, excludedIds, byId };
  }
  try {
    const prev = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf-8')) as {
      reports?: QuestionQualityReport[];
      excludedQuestionIds?: string[];
    };
    for (const id of prev.excludedQuestionIds ?? []) {
      excludedIds.add(id);
    }
    for (const report of prev.reports ?? []) {
      byId.set(report.questionId, report);
      if (report.status === 'rejected') {
        rejectedIds.add(report.questionId);
      }
    }
  } catch {
    /* ignore broken report */
  }
  return { rejectedIds, excludedIds, byId };
}

// Завантаження AI-питань з JSON
function loadAiQuestions(): Question[] {
  if (!fs.existsSync(DB_DIR)) return [];
  const all: Question[] = [];
  for (const file of fs.readdirSync(DB_DIR).filter(f => f.endsWith('.json'))) {
    try {
      const data: Question[] = JSON.parse(fs.readFileSync(path.join(DB_DIR, file), 'utf-8'));
      all.push(...data.map((q) => ({
        ...q,
        reference: normalizeQuestionReference((q as Question & { reference?: unknown }).reference),
      })));
    } catch { /* skip broken json */ }
  }
  return all;
}

const AI_QUESTIONS = loadAiQuestions();

function parseCliFilter(): { node?: string; theme?: string } {
  const args = process.argv.slice(2);
  const filter: { node?: string; theme?: string } = {};
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--node' || args[i] === '--topic') && args[i + 1]) filter.node = args[++i];
    else if (args[i] === '--theme' && args[i + 1]) filter.theme = args[++i];
  }
  return filter;
}

const CLI_FILTER = parseCliFilter();
function matchesCliFilter(q: Question): boolean {
  if (CLI_FILTER.node && q.topicNodeId !== CLI_FILTER.node) return false;
  if (CLI_FILTER.theme && q.themeId !== CLI_FILTER.theme) return false;
  return true;
}

const ALL_QUESTIONS = [...QUESTIONS, ...AI_QUESTIONS].filter(matchesCliFilter);
const { rejectedIds, excludedIds, byId: previousReportsById } = loadPreviousReport();
const ACTIVE_QUESTIONS = ALL_QUESTIONS.filter(
  (q) => !rejectedIds.has(q.id) && !excludedIds.has(q.id),
);

console.log(
  `🔍 Початок аналізу якості питань... (вбудовані: ${QUESTIONS.length}, AI: ${AI_QUESTIONS.length}, у фільтрі: ${ALL_QUESTIONS.length}, rejected: ${rejectedIds.size}, excluded: ${excludedIds.size})\n`,
);

const totalQuestions = ALL_QUESTIONS.length;
let approvedCount = 0;
let quarantinedCount = 0;
let pendingCount = 0;
let rejectedCount = 0;

const reports = [];

// Функція для знаходження схожих питань
function findSimilarQuestions(questions: Question[], threshold: number = 0.7) {
  const pairs: Array<{
    question1: Question;
    question2: Question;
    similarity: number;
  }> = [];

  for (let i = 0; i < questions.length; i++) {
    for (let j = i + 1; j < questions.length; j++) {
      const similarity = calculateTextSimilarity(questions[i].text, questions[j].text);
      
      if (similarity > threshold) {
        pairs.push({
          question1: questions[i],
          question2: questions[j],
          similarity,
        });
      }
    }
  }

  return pairs.sort((a, b) => b.similarity - a.similarity);
}

// Функція для групування схожих питань
function groupSimilarQuestions(pairs: Array<{
  question1: Question;
  question2: Question;
  similarity: number;
}>) {
  const groups = new Map<string, Array<{
    question: Question;
    similarity: number;
  }>>();

  for (const pair of pairs) {
    const groupKey = `${pair.question1.topicNodeId ?? pair.question1.themeId}-${pair.question1.difficulty}`;
    
    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }

    groups.get(groupKey)?.push({
      question: pair.question1,
      similarity: pair.similarity,
    });

    groups.get(groupKey)?.push({
      question: pair.question2,
      similarity: pair.similarity,
    });
  }

  return groups;
}

// Функція для розрахунку схожості текстів
function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = normalizeText(text1);
  const words2 = normalizeText(text2);

  if (words1.length === 0 || words2.length === 0) return 0;

  const intersection = words1.filter(word => words2.includes(word));
  const union = [...new Set([...words1, ...words2])];

  return intersection.length / union.length;
}

// Функція для нормалізації тексту
function normalizeText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\sа-яґєії]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2);
}

function stripDuplicateIssues(report: QuestionQualityReport): QuestionQualityReport {
  return {
    ...report,
    duplicateIds: [],
    issues: report.issues.filter((issue) => issue.type !== 'duplicate'),
  };
}

// Аналіз якості питань
for (const question of ALL_QUESTIONS) {
  if (excludedIds.has(question.id)) {
    continue;
  }

  let report: QuestionQualityReport;

  if (rejectedIds.has(question.id)) {
    const previous = previousReportsById.get(question.id);
    report = stripDuplicateIssues({
      ...(previous ?? {
        questionId: question.id,
        ambiguityScore: 0,
        qualityScore: 0,
        issues: [],
        duplicateIds: [],
      }),
      status: 'rejected',
      reviewedAt: new Date().toISOString(),
    });
    question.quarantined = true;
  } else {
    report = questionQualityValidator.validateQuestion(question, ACTIVE_QUESTIONS);
    question.quarantined = report.status === 'quarantined';
    question.qualityScore = report.qualityScore;
    question.ambiguityScore = report.ambiguityScore;
    question.duplicateIds = report.duplicateIds;
    questionQuarantineManager.saveQualityReport(report);
  }

  reports.push({
    ...report,
    topicNodeId: question.topicNodeId ?? null,
    topicPath: question.topicPath ?? null,
  } as QuestionQualityReport & { topicNodeId?: string | null; topicPath?: string | null });

  switch (report.status) {
    case 'approved':
      approvedCount++;
      break;
    case 'quarantined':
      quarantinedCount++;
      break;
    case 'pending':
      pendingCount++;
      break;
    case 'rejected':
      rejectedCount++;
      break;
  }

  // Виводимо інформацію про проблемні питання
  if (report.status !== 'approved' && report.status !== 'rejected') {
    console.log(`⚠️  Питання ${question.id}:`);
    console.log(`   Статус: ${report.status}`);
    console.log(`   Оцінка якості: ${report.qualityScore}/100`);
    console.log(`   Неоднозначність: ${report.ambiguityScore}/100`);
    
    if (report.issues.length > 0) {
      console.log(`   Проблеми:`);
      report.issues.forEach(issue => {
        console.log(`   - [${issue.severity}] ${issue.type}: ${issue.message}`);
      });
    }
    
    if (report.duplicateIds.length > 0) {
      console.log(`   Дублікати: ${report.duplicateIds.join(', ')}`);
    }
    console.log('');
  }
}

// Знаходимо схожі питання (без rejected — вони вже зняті з пулу)
const similarPairs = findSimilarQuestions(ACTIVE_QUESTIONS, 0.75);
const similarGroups = groupSimilarQuestions(similarPairs);

// Виводимо статистику схожих питань
console.log('\n🔍 Аналіз схожих питань:');
console.log(`Виявлено ${similarPairs.length} пар схожих питань`);
console.log('Схожість > 75%\n');

// Виводимо групи схожих питань
let groupCount = 0;
for (const [groupKey, questions] of similarGroups) {
  if (questions.length < 2) continue;
  
  groupCount++;
  console.log(`📁 Група ${groupCount}: ${groupKey}`);
  
  // Виводимо унікальні питання з високою схожістю
  const uniqueQuestions = questions
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5); // Обмежуємо до 5 питань на групу

  for (let i = 0; i < uniqueQuestions.length; i++) {
    if (i === 0) {
      console.log(`   [${uniqueQuestions[i].similarity.toFixed(1)}]`);
    } else {
      console.log(`   [${uniqueQuestions[i].similarity.toFixed(1)}] — схоже на попереднє`);
    }
    
    console.log(`   📝 ${uniqueQuestions[i].question.id} [${uniqueQuestions[i].question.difficulty}]`);
    console.log(`      "${uniqueQuestions[i].question.text.substring(0, 80)}..."`);
    console.log('');
  }
  
  console.log('');
}

// Виводимо найбільш схожі пари
console.log('🔥 Найбільш схожі пари:');
similarPairs.slice(0, 10).forEach((pair, index) => {
  console.log(`${index + 1}. Схожість: ${pair.similarity.toFixed(1)}`);
  console.log(`   📝 ${pair.question1.id} [${pair.question1.difficulty}]`);
  console.log(`      "${pair.question1.text.substring(0, 80)}..."`);
  console.log(`   📝 ${pair.question2.id} [${pair.question2.difficulty}]`);
  console.log(`      "${pair.question2.text.substring(0, 80)}..."`);
  console.log('');
});

// Виводимо загальну статистику
console.log('\n📊 Загальна статистика:');
console.log(`Всього питань: ${totalQuestions}`);
console.log(`✅ Схвалено: ${approvedCount} (${((approvedCount / totalQuestions) * 100).toFixed(1)}%)`);
console.log(`⛔ В карантині: ${quarantinedCount} (${((quarantinedCount / totalQuestions) * 100).toFixed(1)}%)`);
console.log(`⏳ Очікують розгляду: ${pendingCount} (${((pendingCount / totalQuestions) * 100).toFixed(1)}%)`);
console.log(`❌ Відхилено: ${rejectedCount} (${((rejectedCount / totalQuestions) * 100).toFixed(1)}%)`);

// Статистика карантину
const quarantineStats = questionQuarantineManager.getQuarantineStats();
console.log('\n🔒 Статистика карантину:');
console.log(`Всього в карантині: ${quarantineStats.total}`);
console.log(`Очікують розгляду: ${quarantineStats.pending_review}`);
console.log(`Схвалені виправлення: ${quarantineStats.approved_fix}`);
console.log(`Відхилені: ${quarantineStats.rejected}`);

// Аналіз проблем за типами
const issueTypes = new Map<string, number>();
reports.forEach(report => {
  report.issues.forEach(issue => {
    const count = issueTypes.get(issue.type) || 0;
    issueTypes.set(issue.type, count + 1);
  });
});

console.log('\n🔧 Проблеми за типами:');
issueTypes.forEach((count, type) => {
  console.log(`${type}: ${count}`);
});

// Збереження звіту в файл
const reportData = {
  generatedAt: new Date().toISOString(),
  excludedQuestionIds: [...excludedIds].sort(),
  summary: {
    total: reports.length,
    poolTotal: totalQuestions,
    excludedCount: excludedIds.size,
    embeddedCount: QUESTIONS.length,
    aiCount: AI_QUESTIONS.length,
    approved: approvedCount,
    quarantined: quarantinedCount,
    pending: pendingCount,
    rejected: rejectedCount,
    similarPairsCount: similarPairs.length,
    similarGroupsCount: groupCount,
  },
  topSimilarPairs: similarPairs.slice(0, 50).map(p => ({
    q1: p.question1.id,
    q2: p.question2.id,
    similarity: p.similarity,
  })),
  quarantineStats,
  issueTypes: Object.fromEntries(issueTypes),
  reports,
};

fs.writeFileSync(REPORT_PATH, JSON.stringify(reportData, null, 2), 'utf-8');

console.log('\n📄 Звіт збережено у файл: question-quality-report.json');
console.log('\n✅ Аналіз якості та схожих питань завершено!');