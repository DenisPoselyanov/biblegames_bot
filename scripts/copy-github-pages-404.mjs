/**
 * GitHub Pages has no SPA fallback: reload on /biblegames_bot/profile returns 404.
 * Serving the same shell as 404.html lets React Router handle the path.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(root, 'dist');
const indexPath = path.join(distDir, 'index.html');
const notFoundPath = path.join(distDir, '404.html');

if (!fs.existsSync(indexPath)) {
  console.error('copy-github-pages-404: dist/index.html not found — run npm run build first');
  process.exit(1);
}

fs.copyFileSync(indexPath, notFoundPath);
console.log('copy-github-pages-404: dist/404.html ← index.html');
