#!/usr/bin/env node
/**
 * Generate Kahoot playlist questions via AI (wraps generate-questions-ai.mjs).
 *
 * Usage: node scripts/generate-kahoot-playlist.mjs --topic geography-sub-1-sub-1 --count 10
 */
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const args = process.argv.slice(2);
let topic = null;
let count = 10;

for (let i = 0; i < args.length; i++) {
  if ((args[i] === '--topic' || args[i] === '--node') && args[i + 1]) topic = args[++i];
  if (args[i] === '--count' && args[i + 1]) count = Number(args[++i]);
}

if (!topic) {
  console.error('❌ Вкажи --topic <nodeId> (листова підтема з topics-db)');
  process.exit(1);
}

console.log(`Generating ${count} questions for Kahoot playlist (subtopic: ${topic})…`);

const child = spawn(
  'node',
  ['scripts/generate-questions-ai.mjs', '--topic', topic, '--count', String(count)],
  { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' },
);

child.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Done. Create a playlist in the app and pick questions from the subtopic.');
  }
  process.exit(code ?? 1);
});
