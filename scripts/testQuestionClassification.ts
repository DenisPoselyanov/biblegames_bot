#!/usr/bin/env tsx
/**
 * Тестовий скрипт для аналізу класифікації конкретного питання
 */
import { QUESTIONS } from '../src/data/questions';
import { questionPoolManager, POOL_CONFIGS } from '../src/lib/questionPools';

// Ініціалізація пулів
questionPoolManager.initializePools(QUESTIONS);

// Знайдемо конкретне питання
const targetQuestion = QUESTIONS.find(q => q.id === 'geography-easy-1');

if (!targetQuestion) {
  console.log('❌ Питання не знайдено');
  process.exit(1);
}

console.log('🔍 Аналіз питання:', targetQuestion.id);
console.log('📝 Текст:', targetQuestion.text);
console.log('🏷️  Складність:', targetQuestion.difficulty);
console.log('📖 Посилання:', targetQuestion.reference);
console.log('💡 Пояснення (short):', targetQuestion.explanationShort);
console.log('💡 Пояснення (deep):', targetQuestion.explanationDeep);
console.log('📊 Якість:', targetQuestion.qualityScore);
console.log('🎯 Неоднозначність:', targetQuestion.ambiguityScore);
console.log('🔒 Карантин:', targetQuestion.quarantined);

console.log('\n📋 Критерії для study pool:');
console.log('   minQualityScore:', POOL_CONFIGS.study.minQualityScore);
console.log('   maxAmbiguityScore:', POOL_CONFIGS.study.maxAmbiguityScore);
console.log('   allowedDifficulties:', POOL_CONFIGS.study.allowedDifficulties);
console.log('   requireReference:', POOL_CONFIGS.study.requireReference);
console.log('   requireExplanation:', POOL_CONFIGS.study.requireExplanation);

console.log('\n✅ Перевірка критеріїв:');
const qualityScore = targetQuestion.qualityScore ?? 75;
const ambiguityScore = targetQuestion.ambiguityScore ?? 30;
const hasReference = !!targetQuestion.reference;
const hasExplanation = !!(targetQuestion.explanationShort || targetQuestion.explanationDeep);

console.log(`   Якість ${qualityScore} >= ${POOL_CONFIGS.study.minQualityScore}: ${qualityScore >= POOL_CONFIGS.study.minQualityScore ? '✅' : '❌'}`);
console.log(`   Неоднозначність ${ambiguityScore} <= ${POOL_CONFIGS.study.maxAmbiguityScore}: ${ambiguityScore <= POOL_CONFIGS.study.maxAmbiguityScore ? '✅' : '❌'}`);
console.log(`   Складність ${targetQuestion.difficulty} дозволена: ${POOL_CONFIGS.study.allowedDifficulties.includes(targetQuestion.difficulty) ? '✅' : '❌'}`);
console.log(`   Посилання присутнє: ${hasReference ? '✅' : '❌'}`);
console.log(`   Пояснення присутнє: ${hasExplanation ? '✅' : '❌'}`);
console.log(`   Не в карантині: ${!targetQuestion.quarantined ? '✅' : '❌'}`);

const isEligible = 
  qualityScore >= POOL_CONFIGS.study.minQualityScore &&
  ambiguityScore <= POOL_CONFIGS.study.maxAmbiguityScore &&
  POOL_CONFIGS.study.allowedDifficulties.includes(targetQuestion.difficulty) &&
  (!POOL_CONFIGS.study.requireReference || hasReference) &&
  (!POOL_CONFIGS.study.requireExplanation || hasExplanation) &&
  !targetQuestion.quarantined;

console.log(`\n🎯 Загалом підходить для study pool: ${isEligible ? '✅ ТАК' : '❌ НІ'}`);

// Перевіримо, чи питання дійсно в study pool
const studyQuestions = questionPoolManager.getStudyQuestions();
const inStudyPool = studyQuestions.some(q => q.id === targetQuestion.id);
console.log(`📦 Питання в study pool: ${inStudyPool ? '✅ ТАК' : '❌ НІ'}`);

if (!inStudyPool && isEligible) {
  console.log('\n⚠️  УВАГА: Питання підходить за критеріями, але не в study pool!');
  console.log('   Це може бути помилка в логіці класифікації.');
}