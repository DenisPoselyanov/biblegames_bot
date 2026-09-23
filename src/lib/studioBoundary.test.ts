import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Phase 4 WS8 (spec §10.1: "Студія не входить у користувацький bundle").
 * Content Studio (`src/pages/studio/**`) must ship as its own lazy chunk,
 * never eagerly pulled into a player-facing route's bundle. This walks the
 * real import graph from each core route's entry file — same mechanism as
 * `questionBankBoundary.test.ts` (Phase 3 §18) — and fails if any file under
 * `src/pages/studio` is reachable, statically or dynamically.
 */

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rootDir = path.resolve(srcDir, '..');
const studioDir = path.resolve(srcDir, 'pages/studio');

const CORE_ROUTE_ENTRIES = [
  path.resolve(srcDir, 'pages/learn/Today.tsx'),
  path.resolve(srcDir, 'pages/learn/LearningHub.tsx'),
  path.resolve(srcDir, 'pages/Home.tsx'),
  path.resolve(srcDir, 'pages/AdminPanel.tsx'),
];

const IMPORT_SPECIFIER_RE =
  /\bfrom\s+['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s+['"]([^'"]+)['"]/gm;

function resolveSpecifier(spec: string, fromFile: string): string | null {
  let base: string;
  if (spec.startsWith('.')) {
    base = path.resolve(path.dirname(fromFile), spec);
  } else if (spec === '@contracts') {
    return path.resolve(rootDir, 'contracts/index.ts');
  } else if (spec.startsWith('@core/')) {
    base = path.resolve(srcDir, 'core', spec.slice('@core/'.length));
  } else if (spec.startsWith('@/')) {
    base = path.resolve(srcDir, spec.slice('@/'.length));
  } else {
    return null; // bare package specifier (node_modules) — not our graph to walk
  }
  const candidates = [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')];
  return candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isFile()) ?? null;
}

/** DFS over the local (non-node_modules) import graph reachable from `entry`. */
function collectReachableFiles(entry: string): Set<string> {
  const visited = new Set<string>();
  const stack = [entry];
  while (stack.length > 0) {
    const file = stack.pop()!;
    if (visited.has(file)) continue;
    visited.add(file);
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(IMPORT_SPECIFIER_RE)) {
      const spec = match[1] ?? match[2] ?? match[3];
      if (!spec) continue;
      const resolved = resolveSpecifier(spec, file);
      if (resolved && !visited.has(resolved)) stack.push(resolved);
    }
  }
  return visited;
}

describe('content studio bundle boundary (Phase 4 WS8)', () => {
  it.each(CORE_ROUTE_ENTRIES)('%s does not reach the studio module tree', (entry) => {
    expect(fs.existsSync(entry), `expected core route entry to exist: ${entry}`).toBe(true);
    const reachable = collectReachableFiles(entry);
    const leaked = [...reachable].filter((f) => f.startsWith(studioDir + path.sep));
    expect(leaked).toEqual([]);
  });
});
