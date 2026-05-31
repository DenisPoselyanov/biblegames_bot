#!/usr/bin/env node
/**
 * Import Kahoot-style TSV into a playlist JSON file.
 * Format: question \t option1 \t option2 \t option3 \t option4 \t correctIndex(0-3) \t [reference]
 *
 * Usage: node scripts/import-kahoot-tsv.mjs path/to/quiz.tsv [--out playlists/imported.json]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const args = process.argv.slice(2);
const inputPath = args[0];
const outIdx = args.indexOf('--out');
const outPath = outIdx >= 0 ? args[outIdx + 1] : 'data/kahoot-imports/imported-playlist.json';

if (!inputPath) {
  console.error('Usage: node scripts/import-kahoot-tsv.mjs <file.tsv> [--out path.json]');
  process.exit(1);
}

const raw = readFileSync(inputPath, 'utf8');
const lines = raw.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#'));

const questions = lines.map((line, i) => {
  const cols = line.split('\t');
  if (cols.length < 6) {
    throw new Error(`Line ${i + 1}: need at least 6 tab-separated columns`);
  }
  const [text, o1, o2, o3, o4, correctStr, reference] = cols;
  const correctIndex = Number(correctStr);
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) {
    throw new Error(`Line ${i + 1}: correctIndex must be 0-3`);
  }
  return {
    id: `import-${Date.now()}-${i}`,
    themeId: 'imported',
    difficulty: 'youth',
    text: text.trim(),
    options: [o1, o2, o3, o4].map((s) => s.trim()),
    correctIndex,
    reference: reference?.trim() || undefined,
  };
});

const playlist = {
  id: `pl_import_${Date.now()}`,
  name: `Import ${new Date().toISOString().slice(0, 10)}`,
  description: `Imported from ${inputPath} (${questions.length} questions)`,
  questions: questions.map((q) => q.id),
  questionData: questions,
  themes: ['imported'],
  isPublic: false,
  createdAt: new Date().toISOString(),
};

const absOut = resolve(outPath);
const dir = dirname(absOut);
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
writeFileSync(absOut, JSON.stringify(playlist, null, 2), 'utf8');
console.log(`✅ Imported ${questions.length} questions → ${absOut}`);
console.log('Add question IDs to your playlist via AdminPanel or merge into question-db.');
