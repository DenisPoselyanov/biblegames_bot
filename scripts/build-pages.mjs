import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...process.env, VITE_BASE_PATH: '/biblegames_bot/' };

function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: root, env, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(process.execPath, ['node_modules/typescript/bin/tsc', '-b']);
run(process.execPath, ['scripts/run-vite.mjs', 'build']);
run(process.execPath, ['scripts/copy-github-pages-404.mjs']);
