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
import type { Question } from '../src/types';

const DB_DIR = path.resolve('data/question-db');

// Завантаження AI-питань з JSON
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

const AI_QUESTIONS = loadAiQuestions();
const ALL_QUESTIONS = [...QUESTIONS, ...AI_QUESTIONS];

console.log(`🔍 Початок аналізу якості питань... (вбудовані: ${QUESTIONS.length}, AI: ${AI_QUESTIONS.length}, разом: ${ALL_QUESTIONS.length})\n`);

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
    const groupKey = `${pair.question1.themeId}-${pair.question1.difficulty}`;
    
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

// Аналіз якості питань
for (const question of ALL_QUESTIONS) {
  const report = questionQualityValidator.validateQuestion(question, ALL_QUESTIONS);
  reports.push(report);

  // Синхронізуємо поле quarantined на об'єкті питання з менеджером карантину
  question.quarantined = report.status === 'quarantined';
  question.qualityScore = report.qualityScore;
  question.ambiguityScore = report.ambiguityScore;
  question.duplicateIds = report.duplicateIds;

  questionQuarantineManager.saveQualityReport(report);

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
  if (report.status !== 'approved') {
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

// Знаходимо схожі питання
const similarPairs = findSimilarQuestions(ALL_QUESTIONS, 0.75);
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
  summary: {
    total: totalQuestions,
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

fs.writeFileSync(
  'question-quality-report.json',
  JSON.stringify(reportData, null, 2),
  'utf-8'
);

console.log('\n📄 Звіт збережено у файл: question-quality-report.json');
console.log('\n✅ Аналіз якості та схожих питань завершено!');