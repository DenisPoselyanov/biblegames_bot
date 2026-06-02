#!/usr/bin/env node
/**
 * Статистика питань: вбудована база + AI JSON + готовність до практики (етапи)
 * npm run questions:stats
 */

import { DIFFICULTIES, THEME_IDS } from './lib/themes-config.mjs';
import { DB_DIR, loadThemeQuestions } from './lib/question-db.mjs';
import {
  PRACTICE_QUESTIONS_PER_STAGE,
  STAGE_COUNT_BY_DIFFICULTY,
} from './lib/practice-config.mjs';
import {
  collectNodePracticeGaps,
  summarizeNodeGaps,
  loadQuestionsForTheme,
} from './lib/topic-node-pool-stats.mjs';
import { isSpecificSubtopicNodeId } from './lib/topic-context.mjs';

function main() {
  console.log('📊 Статистика питань (лише з topicNodeId підтем)\n');
  console.log(
    `Практика: ${PRACTICE_QUESTIONS_PER_STAGE} питань/етап · етапи: baby–youth 5, student–preacher 4, teacher–theologian 3\n`,
  );

  const header = ['Тема', ...DIFFICULTIES.map((d) => d.slice(0, 3)), 'AI', 'Поясн.', 'Всього'];
  console.log(header.join(' | '));
  console.log('-'.repeat(70));

  let grandTotal = 0;

  for (const themeId of THEME_IDS) {
    const all = loadQuestionsForTheme(themeId).filter((q) =>
      isSpecificSubtopicNodeId(q.topicNodeId),
    );
    const poolByDiff = Object.fromEntries(
      DIFFICULTIES.map((d) => [d, all.filter((q) => q.difficulty === d).length]),
    );

    const ai = loadThemeQuestions(themeId).filter((q) => isSpecificSubtopicNodeId(q.topicNodeId));
    const aiTotal = ai.length;
    const withExpl = ai.filter(
      (q) => String(q.explanationShort ?? '').trim() || String(q.explanationDeep ?? '').trim(),
    ).length;
    const total = all.length;
    grandTotal += total;

    const row = [
      themeId.padEnd(18),
      ...DIFFICULTIES.map((d) => String(poolByDiff[d]).padStart(3)),
      String(aiTotal).padStart(4),
      String(withExpl).padStart(6),
      String(total).padStart(6),
    ];
    console.log(row.join(' | '));
  }

  console.log('-'.repeat(70));
  console.log(`ВСЬОГО: ${grandTotal} питань`);
  console.log(`\nAI база: ${DB_DIR}\n`);

  const nodeGaps = collectNodePracticeGaps();
  const nodeSummary = summarizeNodeGaps(nodeGaps);

  console.log('📋 Готовність підтем (листові × складність):\n');
  if (nodeGaps.length === 0) {
    console.log('  ✅ Усі підтеми готові до повної практики');
  } else {
    console.log(`  Завдань: ${nodeSummary.jobCount} · ~${nodeSummary.totalGap} питань`);
    const top = nodeGaps.slice(0, 15);
    for (const g of top) {
      console.log(
        `  ${g.title} / ${g.difficulty}: ${g.pool}/${g.required} → +${g.gap}`,
      );
    }
    if (nodeGaps.length > 15) console.log(`  … ще ${nodeGaps.length - 15}`);
  }
  console.log('');

  console.log('💡 Рекомендації:\n');
  if (nodeGaps.length > 0) {
    const first = nodeGaps[0];
    console.log(`  npm run fill-practice-nodes -- --node ${first.nodeId} --difficulty ${first.difficulty}`);
    console.log(`  npm run fill-practice-nodes -- --theme ${first.themeId}`);
  }
  console.log('  npm run fill-practice-nodes -- --dry-run');
  console.log('  npm run generate-ai -- --topic <nodeId> --difficulty baby --count 50');
  console.log('  npm run balance-questions -- --theme geography --scope leaves --practice-ready');
}

main();
