#!/usr/bin/env node
/**
 * Видаляє питання без прив’язки до конкретної підтеми (topicNodeId).
 * npm run prune-untagged -- --dry-run
 */

import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { DB_DIR } from './lib/question-db.mjs';
import { isSpecificSubtopicNodeId } from './lib/topic-context.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const TAGS_FILE = join(ROOT, 'data/question-topic-tags.json');
const EMBEDDED_FILES = [
  join(ROOT, 'src/data/questions.ts'),
  join(ROOT, 'src/data/questions-extra.ts'),
];

function parseArgs() {
  const dryRun = process.argv.includes('--dry-run');
  return { dryRun };
}

function pruneAiJson(dryRun) {
  const stats = { files: 0, before: 0, after: 0, removed: 0 };

  for (const file of fs.readdirSync(DB_DIR).filter((f) => f.endsWith('.json'))) {
    const filePath = join(DB_DIR, file);
    const questions = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!Array.isArray(questions)) continue;

    stats.files++;
    stats.before += questions.length;
    const kept = questions.filter((q) => isSpecificSubtopicNodeId(q.topicNodeId));
    stats.after += kept.length;
    stats.removed += questions.length - kept.length;

    if (!dryRun) {
      fs.writeFileSync(filePath, JSON.stringify(kept, null, 2), 'utf8');
    }
  }

  return stats;
}

function questionIdFromQCall(themeId, difficulty, n, isExtra) {
  return isExtra ? `${themeId}-${difficulty}-x${n}` : `${themeId}-${difficulty}-${n}`;
}

function pruneEmbeddedFile(filePath, tags, dryRun) {
  const isExtra = filePath.includes('questions-extra');
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const out = [];
  let before = 0;
  let after = 0;

  const qRe = /^\s*q\('([^']+)',\s*'([^']+)',\s*(\d+)/;

  for (const line of lines) {
    const m = line.match(qRe);
    if (m) {
      before++;
      const id = questionIdFromQCall(m[1], m[2], m[3], isExtra);
      const tag = tags[id];
      if (tag?.topicNodeId && isSpecificSubtopicNodeId(tag.topicNodeId)) {
        after++;
        out.push(line);
      }
      continue;
    }
    out.push(line);
  }

  if (!dryRun && out.join('\n') !== content) {
    fs.writeFileSync(filePath, out.join('\n'), 'utf8');
  }

  return { before, after, removed: before - after };
}

function pruneTagsFile(tags, dryRun) {
  const kept = {};
  let removed = 0;
  for (const [id, tag] of Object.entries(tags)) {
    if (tag?.topicNodeId && isSpecificSubtopicNodeId(tag.topicNodeId)) {
      kept[id] = tag;
    } else {
      removed++;
    }
  }
  if (!dryRun) {
    fs.writeFileSync(TAGS_FILE, JSON.stringify(kept, null, 2), 'utf8');
  }
  return { before: Object.keys(tags).length, after: Object.keys(kept).length, removed };
}

function main() {
  const { dryRun } = parseArgs();
  console.log(dryRun ? '🔍 Dry-run — без змін на диску\n' : '🧹 Видалення питань без підтем\n');

  const ai = pruneAiJson(dryRun);
  console.log('AI JSON (data/question-db):');
  console.log(`  файлів: ${ai.files} · було: ${ai.before} · лишилось: ${ai.after} · видалено: ${ai.removed}`);

  const tags = JSON.parse(fs.readFileSync(TAGS_FILE, 'utf8'));
  const tagStats = pruneTagsFile(tags, dryRun);
  console.log('\nquestion-topic-tags.json:');
  console.log(`  було: ${tagStats.before} · лишилось: ${tagStats.after} · видалено: ${tagStats.removed}`);

  const keptTags = dryRun
    ? Object.fromEntries(
        Object.entries(tags).filter(([, t]) => t?.topicNodeId && isSpecificSubtopicNodeId(t.topicNodeId)),
      )
    : JSON.parse(fs.readFileSync(TAGS_FILE, 'utf8'));

  let embBefore = 0;
  let embAfter = 0;
  console.log('\nВбудовані (questions.ts / questions-extra.ts):');
  for (const filePath of EMBEDDED_FILES) {
    const s = pruneEmbeddedFile(filePath, keptTags, dryRun);
    embBefore += s.before;
    embAfter += s.after;
    console.log(`  ${filePath.split(/[/\\]/).pop()}: ${s.before} → ${s.after} (−${s.removed})`);
  }

  console.log('\n────────────────────────────────────');
  console.log(
    `Разом видалено: ${ai.removed + tagStats.removed + (embBefore - embAfter)} питань/записів`,
  );
  if (dryRun) {
    console.log('\nЗастосувати: npm run prune-untagged');
  } else {
    console.log('\n✅ Готово. Далі: npm run fill-practice-nodes');
  }
}

main();
