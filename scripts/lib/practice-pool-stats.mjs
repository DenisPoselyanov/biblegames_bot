/**
 * Pool sizes per theme × difficulty (embedded TS + AI JSON).
 * Used by analyze-questions, fill-practice-pools, analyzeQuestionPools.
 */

import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { DIFFICULTIES, THEME_IDS } from './themes-config.mjs';
import { loadThemeQuestions } from './question-db.mjs';
import {
  practiceGap,
  requiredQuestionsForDifficulty,
  isPracticeReady,
  STAGE_COUNT_BY_DIFFICULTY,
  stagesPossibleFromPool,
} from './practice-config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');

const EMBEDDED_FILES = [
  join(ROOT, 'src/data/questions.ts'),
  join(ROOT, 'src/data/questions-extra.ts'),
];

function countEmbeddedInFile(filePath, pattern) {
  if (!fs.existsSync(filePath)) return 0;
  const content = fs.readFileSync(filePath, 'utf8');
  return (content.match(pattern) || []).length;
}

export function countEmbeddedByThemeAndDifficulty(themeId) {
  const byDiff = Object.fromEntries(DIFFICULTIES.map((d) => [d, 0]));
  for (const f of EMBEDDED_FILES) {
    for (const d of DIFFICULTIES) {
      byDiff[d] += countEmbeddedInFile(f, new RegExp(`q\\('${themeId}',\\s*'${d}'`, 'g'));
    }
  }
  return byDiff;
}

export function getPoolByDifficulty(themeId) {
  const ai = loadThemeQuestions(themeId);
  const aiByDiff = Object.fromEntries(DIFFICULTIES.map((d) => [d, 0]));
  for (const q of ai) {
    if (aiByDiff[q.difficulty] != null) aiByDiff[q.difficulty]++;
  }
  const embeddedByDiff = countEmbeddedByThemeAndDifficulty(themeId);
  return Object.fromEntries(
    DIFFICULTIES.map((d) => [d, (embeddedByDiff[d] || 0) + (aiByDiff[d] || 0)]),
  );
}

/**
 * @param {{ theme?: string, difficulty?: string, minGap?: number }} filter
 */
export function collectPracticeGaps(filter = {}) {
  const themes = filter.theme ? [filter.theme] : THEME_IDS;
  const diffs =
    filter.difficulty && DIFFICULTIES.includes(filter.difficulty)
      ? [filter.difficulty]
      : DIFFICULTIES;
  const minGap = filter.minGap ?? 1;
  const gaps = [];

  for (const themeId of themes) {
    const poolByDiff = getPoolByDifficulty(themeId);
    for (const difficulty of diffs) {
      const pool = poolByDiff[difficulty];
      if (isPracticeReady(pool, difficulty)) continue;
      const gap = practiceGap(pool, difficulty);
      if (gap < minGap) continue;
      gaps.push({
        themeId,
        difficulty,
        pool,
        required: requiredQuestionsForDifficulty(difficulty),
        stages: STAGE_COUNT_BY_DIFFICULTY[difficulty],
        possible: stagesPossibleFromPool(pool),
        gap,
      });
    }
  }

  return gaps.sort((a, b) => b.gap - a.gap);
}

export function summarizeGaps(gaps) {
  const totalGap = gaps.reduce((s, g) => s + g.gap, 0);
  const byTheme = new Map();
  for (const g of gaps) {
    byTheme.set(g.themeId, (byTheme.get(g.themeId) || 0) + g.gap);
  }
  return { totalGap, jobCount: gaps.length, byTheme };
}
