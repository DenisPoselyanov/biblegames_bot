#!/usr/bin/env tsx
/**
 * Скрипт для аналізу та ініціалізації пулів питань
 * Аналізує як вбудовані (TS), так і AI-генеровані питання (JSON з data/question-db/)
 */
import { QUESTIONS } from '../src/data/questions';
import { questionPoolManager } from '../src/lib/questionPools';
import { questionQuarantineManager } from '../src/lib/questionQuarantine';
import fs from 'fs';
import path from 'path';
import type { Question } from '../src/types';

const DB_DIR = path.resolve('data/question-db');

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

console.log(`🔍 Початок аналізу пулів питань... (вбудовані: ${QUESTIONS.length}, AI: ${AI_QUESTIONS.length}, разом: ${ALL_QUESTIONS.length})\n`);

// Синхронізуємо карантин з quarantineManager (якщо analyze-quality був запущений)
// та встановлюємо значення за замовчуванням
for (const q of ALL_QUESTIONS) {
  const quarantineInfo = questionQuarantineManager.getQuarantineInfo(q.id);
  if (quarantineInfo) {
    q.quarantined = true;
    q.quarantineReason = quarantineInfo.reason;
  }
}

// Спочатку класифікуємо всі питання
questionPoolManager.initializePools(ALL_QUESTIONS);

// Отримуємо статистику
const stats = questionPoolManager.getPoolStats();

console.log('📊 Статистика пулів питань:');
console.log('\n📚 Study Pool (для навчання):');
console.log(`   Всього питань: ${stats.study.total}`);
console.log('   За складністю:');
Object.entries(stats.study.byDifficulty).forEach(([diff, count]) => {
  console.log(`   - ${diff}: ${count}`);
});
console.log('   За темами:');
Object.entries(stats.study.byTheme).forEach(([theme, count]) => {
  console.log(`   - ${theme}: ${count}`);
});

console.log('\n🎮 Game Pool (для ігор):');
console.log(`   Всього питань: ${stats.game.total}`);
console.log('   За складністю:');
Object.entries(stats.game.byDifficulty).forEach(([diff, count]) => {
  console.log(`   - ${diff}: ${count}`);
});
console.log('   За темами:');
Object.entries(stats.game.byTheme).forEach(([theme, count]) => {
  console.log(`   - ${theme}: ${count}`);
});

console.log(`\n🔄 Перекриття між пулами: ${stats.overlap} питань`);

// Тестування вибірки питань для різних режимів
console.log('\n🎯 Тестування вибірки питань для режимів:');

const modes = ['millionaire', 'survival', 'kahoot', 'exploration'] as const;
for (const mode of modes) {
  const questions = questionPoolManager.getQuestionsForMode(mode, 5);
  console.log(`\n${mode.toUpperCase()}:`);
  console.log(`   Вибрано ${questions.length} питань`);
  if (questions.length > 0) {
    questions.forEach(q => {
      console.log(`   - ${q.id} [${q.difficulty}] ${q.text.substring(0, 40)}...`);
    });
  }
}

// Тестування фільтрації
console.log('\n🔍 Тестування фільтрації:');

const studyMediumQuestions = questionPoolManager.getStudyQuestions({
  difficulty: 'medium',
  minQualityScore: 70,
});
console.log(`\nStudy pool, medium difficulty, quality ≥ 70: ${studyMediumQuestions.length} питань`);

const gameEasyQuestions = questionPoolManager.getGameQuestions({
  difficulty: 'easy',
  maxAmbiguityScore: 30,
});
console.log(`Game pool, easy difficulty, ambiguity ≤ 30: ${gameEasyQuestions.length} питань`);

// Аналіз питань, які не потрапили в study pool
const studyQuestions = questionPoolManager.getStudyQuestions();
const excludedFromStudy = ALL_QUESTIONS.filter(q => 
  !studyQuestions.find(sq => sq.id === q.id)
);

console.log(`\n⚠️  Питання, виключені зі study pool (${excludedFromStudy.length}):`);
excludedFromStudy.slice(0, 10).forEach(q => {
  const reasons = [];
  if (!q.reference) reasons.push('no_reference');
  // explanation більше не є обов'язковим для study pool
  // if (!q.explanationShort && !q.explanationDeep) reasons.push('no_explanation');
  if ((q.qualityScore ?? 75) < 60) reasons.push(`low_quality_${q.qualityScore ?? 75}`);
  if ((q.ambiguityScore ?? 30) > 50) reasons.push(`high_ambiguity_${q.ambiguityScore ?? 30}`);
  if (['expert'].includes(q.difficulty)) reasons.push(`difficulty_not_allowed_${q.difficulty}`);
  if (q.quarantined) reasons.push('quarantined');
  
  if (reasons.length === 0) reasons.push('unknown');
  console.log(`   - ${q.id} [${q.difficulty}]: ${reasons.join(', ')}`);
});

if (excludedFromStudy.length > 10) {
  console.log(`   ... та ще ${excludedFromStudy.length - 10} питань`);
}

// Збереження звіту в файл
  const reportData = {
  generatedAt: new Date().toISOString(),
  summary: {
    totalQuestions: ALL_QUESTIONS.length,
    embeddedCount: QUESTIONS.length,
    aiCount: AI_QUESTIONS.length,
    studyPoolSize: stats.study.total,
    gamePoolSize: stats.game.total,
    overlap: stats.overlap,
  },
  stats,
  excludedFromStudyCount: excludedFromStudy.length,
};

fs.writeFileSync(
  'question-pools-report.json',
  JSON.stringify(reportData, null, 2),
  'utf-8'
);

console.log('\n📄 Звіт збережено у файл: question-pools-report.json');
console.log('\n✅ Аналіз пулів питань завершено!');
