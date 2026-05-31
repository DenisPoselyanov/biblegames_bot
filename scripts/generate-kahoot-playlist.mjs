#!/usr/bin/env node
/**
 * Generate Kahoot playlist questions via Ollama (wraps generate-questions-ai.mjs).
 *
 * Usage: node scripts/generate-kahoot-playlist.mjs --theme geography --count 10
 */
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const args = process.argv.slice(2);
let theme = 'geography';
let count = 10;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--theme' && args[i + 1]) theme = args[++i];
  if (args[i] === '--count' && args[i + 1]) count = Number(args[++i]);
}

console.log(`Generating ${count} questions for Kahoot playlist (theme: ${theme})…`);

const child = spawn(
  'node',
  ['scripts/generate-questions-ai.mjs', '--theme', theme, '--count', String(count)],
  { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' },
);

child.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Done. Create a playlist in the app and pick questions from the theme.');
  }
  process.exit(code ?? 1);
});
