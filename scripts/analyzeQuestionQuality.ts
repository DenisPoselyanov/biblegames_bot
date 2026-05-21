#!/usr/bin/env tsx
/**
 * Скрипт для аналізу якості всіх питань у базі
 */
import { QUESTIONS } from '../src/data/questions';
import { questionQualityValidator } from '../src/lib/questionQuality';
import { questionQuarantineManager } from '../src/lib/questionQuarantine';
import type { Question } from '../src/types';

console.log('🔍 Початок аналізу якості питань...\n');

let totalQuestions = QUESTIONS.length;
let approvedCount = 0;
let quarantinedCount = 0;
let pendingCount = 0;
let rejectedCount = 0;

const reports = [];

for (const question of QUESTIONS) {
  const report = questionQualityValidator.validateQuestion(question, QUESTIONS);
  reports.push(report);
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
import fs from 'fs';

const reportData = {
  generatedAt: new Date().toISOString(),
  summary: {
    total: totalQuestions,
    approved: approvedCount,
    quarantined: quarantinedCount,
    pending: pendingCount,
    rejected: rejectedCount,
  },
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
