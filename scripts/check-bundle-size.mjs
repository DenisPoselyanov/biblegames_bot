/**
 * Bundle-size regression gate for the initial (critical-path) JS/CSS payload
 * (run: npm run check:bundle-size, after `npm run build`).
 *
 * Phase 3 §18 requires keeping initial Today usable on realistic mobile
 * networks. This only measures what `dist/index.html` references eagerly
 * (entry script + entry stylesheet + any modulepreload) — lazy route chunks
 * (React.lazy) and per-theme question-bank chunks are excluded by design,
 * since they don't block first paint.
 */
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(scriptsDir, '..', 'dist');
const indexHtmlPath = path.join(distDir, 'index.html');

// Headroom above the measured baseline (2026-09-17: JS 212 KB, CSS 30 KB gzip)
// so this catches real regressions, not routine minifier/version noise.
const BUDGETS_GZIP_BYTES = {
  js: 260 * 1024,
  css: 40 * 1024,
};

function gzipSize(filePath) {
  return gzipSync(fs.readFileSync(filePath)).length;
}

function extractEagerAssetHrefs(html) {
  const hrefs = [];
  const scriptRe = /<script[^>]+type="module"[^>]+src="([^"]+)"/g;
  const linkRe = /<link[^>]+rel="(?:stylesheet|modulepreload)"[^>]+href="([^"]+)"/g;
  for (const re of [scriptRe, linkRe]) {
    for (const match of html.matchAll(re)) hrefs.push(match[1]);
  }
  return hrefs;
}

async function main() {
  assert.ok(fs.existsSync(indexHtmlPath), `${indexHtmlPath} not found — run "npm run build" first`);
  const html = fs.readFileSync(indexHtmlPath, 'utf8');
  const hrefs = extractEagerAssetHrefs(html);
  assert.ok(hrefs.length > 0, 'no eager <script type="module"> / stylesheet found in dist/index.html');

  let jsGzip = 0;
  let cssGzip = 0;
  const rows = [];
  for (const href of hrefs) {
    const filePath = path.join(distDir, href.replace(/^\//, ''));
    if (!fs.existsSync(filePath)) {
      console.warn(`skip (not on disk): ${href}`);
      continue;
    }
    const size = gzipSize(filePath);
    rows.push({ href, gzip: size });
    if (href.endsWith('.css')) cssGzip += size;
    else jsGzip += size;
  }

  console.table(rows.map((r) => ({ asset: r.href, gzipKB: (r.gzip / 1024).toFixed(1) })));
  console.log(`Entry JS gzip:  ${(jsGzip / 1024).toFixed(1)} KB (budget ${BUDGETS_GZIP_BYTES.js / 1024} KB)`);
  console.log(`Entry CSS gzip: ${(cssGzip / 1024).toFixed(1)} KB (budget ${BUDGETS_GZIP_BYTES.css / 1024} KB)`);

  const failures = [];
  if (jsGzip > BUDGETS_GZIP_BYTES.js) failures.push(`entry JS ${(jsGzip / 1024).toFixed(1)} KB exceeds ${BUDGETS_GZIP_BYTES.js / 1024} KB budget`);
  if (cssGzip > BUDGETS_GZIP_BYTES.css) failures.push(`entry CSS ${(cssGzip / 1024).toFixed(1)} KB exceeds ${BUDGETS_GZIP_BYTES.css / 1024} KB budget`);

  if (failures.length > 0) {
    throw new Error(`Bundle-size budget exceeded:\n  - ${failures.join('\n  - ')}`);
  }
  console.log('check-bundle-size: within budget');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
