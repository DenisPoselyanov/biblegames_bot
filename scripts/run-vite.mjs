/**
 * Run Vite from local node_modules when healthy, else npx (fixes corrupted vite bin).
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const localCli = path.join(root, 'node_modules', 'vite', 'dist', 'node', 'cli.js');
const args = process.argv.slice(2);

function localViteLooksHealthy() {
  if (!fs.existsSync(localCli)) return false;
  if (!fs.existsSync(path.join(root, 'node_modules', 'picomatch', 'package.json'))) {
    return false;
  }
  const probe = spawnSync(process.execPath, [localCli, '--version'], {
    cwd: root,
    encoding: 'utf8',
  });
  return probe.status === 0;
}

const useLocal = localViteLooksHealthy();
const cmd = useLocal ? process.execPath : process.platform === 'win32' ? 'npx.cmd' : 'npx';
const cmdArgs = useLocal
  ? [localCli, ...args]
  : ['--yes', '-p', 'vite@8.0.12', 'vite', ...args];

const child = spawn(cmd, cmdArgs, {
  cwd: root,
  stdio: 'inherit',
  shell: !useLocal,
});

child.on('exit', (code) => process.exit(code ?? 1));
