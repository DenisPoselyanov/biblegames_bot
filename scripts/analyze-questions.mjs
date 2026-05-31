#!/usr/bin/env node
/**
 * Статистика питань: вбудована база + AI JSON
 * npm run questions:stats
 */

import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { DIFFICULTIES, THEME_IDS } from './lib/themes-config.mjs';
import { DB_DIR, loadThemeQuestions } from './lib/question-db.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function countEmbeddedInFile(filePath, pattern) {
  if (!fs.existsSync(filePath)) return 0;
  const content = fs.readFileSync(filePath, 'utf8');
  return (content.match(pattern) || []).length;
}

function countEmbeddedByTheme(themeId) {
  const files = [
    join(ROOT, 'src/data/questions.ts'),
    join(ROOT, 'src/data/questions-extra.ts'),
  ];
  let total = 0;
  for (const f of files) {
    total += countEmbeddedInFile(f, new RegExp(`themeId:\\s*'${themeId}'`, 'g'));
    total += countEmbeddedInFile(f, new RegExp(`q\\('${themeId}'`, 'g'));
  }
  return total;
}

function main() {
  console.log('📊 Статистика питань — Біблійна гра');
  console.log('=====================================\n');

  const header = ['Тема', ...DIFFICULTIES.map((d) => d.slice(0, 3)), 'AI', 'Поясн.', 'Всього'];
  console.log(header.join(' | '));
  console.log('-'.repeat(70));

  let grandTotal = 0;
  const recommendations = [];

  for (const themeId of THEME_IDS) {
    const ai = loadThemeQuestions(themeId);
    const aiByDiff = Object.fromEntries(DIFFICULTIES.map((d) => [d, 0]));
    for (const q of ai) {
      if (aiByDiff[q.difficulty] != null) aiByDiff[q.difficulty]++;
    }

    const embedded = countEmbeddedByTheme(themeId);
    const aiTotal = ai.length;
    const withExpl = ai.filter(
      (q) => String(q.explanationShort ?? '').trim() || String(q.explanationDeep ?? '').trim(),
    ).length;
    const total = embedded + aiTotal;
    grandTotal += total;

    const row = [
      themeId.padEnd(18),
      ...DIFFICULTIES.map((d) => String(aiByDiff[d]).padStart(3)),
      String(aiTotal).padStart(4),
      String(withExpl).padStart(6),
      String(total).padStart(6),
    ];
    console.log(row.join(' | '));

    if (total < 100) {
      recommendations.push(
        `  ⚠️  ${themeId}: ${total} питань → npm run generate-ai -- --theme ${themeId} --count 100`,
      );
    } else if (total < 500) {
      recommendations.push(`  ✓  ${themeId}: ${total} (добре, можна додати ще)`);
    } else {
      recommendations.push(`  ✅ ${themeId}: ${total} (відмінно)`);
    }
  }

  console.log('-'.repeat(70));
  console.log(`ВСЬОГО: ${grandTotal} питань`);
  console.log(`\nAI база: ${DB_DIR}\n`);

  console.log('💡 Рекомендації:\n');
  recommendations.forEach((r) => console.log(r));

  console.log('\n📈 Для тисяч питань на тему:');
  console.log('  npm run generate-ai -- --theme geography --count 200');
  console.log('  npm run generate-ai -- --all --count 50   (по всіх темах, довго!)');
  console.log('  npm run bot                               (Telegram-бот)');
}

main();
