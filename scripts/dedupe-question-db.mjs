#!/usr/bin/env node
/**
 * Remove duplicate rows with the same question id from data/question-db/*.json
 */
import fs from 'fs';
import { DB_DIR, dedupeQuestionsById, loadThemeQuestions, saveThemeQuestions } from './lib/question-db.mjs';

const dryRun = process.argv.includes('--dry-run');

let totalBefore = 0;
let totalAfter = 0;

for (const file of fs.readdirSync(DB_DIR).filter((f) => f.endsWith('.json'))) {
  const themeId = file.replace(/\.json$/, '');
  const before = loadThemeQuestions(themeId);
  const after = dedupeQuestionsById(before);
  totalBefore += before.length;
  totalAfter += after.length;
  if (after.length === before.length) continue;

  const removed = before.length - after.length;
  console.log(`${themeId}: ${before.length} → ${after.length} (−${removed})`);
  if (!dryRun) saveThemeQuestions(themeId, after);
}

console.log(
  dryRun
    ? `Dry run: would remove ${totalBefore - totalAfter} duplicate rows (${totalBefore} → ${totalAfter})`
    : `Done: removed ${totalBefore - totalAfter} duplicate rows (${totalBefore} → ${totalAfter})`,
);
