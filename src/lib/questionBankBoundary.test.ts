import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Phase 3 §18 ("do not bundle/load full question banks for core routes").
 * `src/data/questions.ts` computes `ALL_QUESTIONS` eagerly at module scope, so
 * anything that statically or dynamically imports it — directly or
 * transitively — pulls the full question bank into its chunk. This walks the
 * real import graph from each core route's entry file and fails if that
 * eager module is reachable, instead of relying on a one-off manual grep.
 */

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rootDir = path.resolve(srcDir, '..');
const eagerQuestionBankFile = path.resolve(srcDir, 'data/questions.ts');

const CORE_ROUTE_ENTRIES = [
  path.resolve(srcDir, 'pages/learn/Today.tsx'),
  path.resolve(srcDir, 'pages/learn/LearningHub.tsx'),
  path.resolve(srcDir, 'pages/Home.tsx'),
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

describe('question bank bundle boundary (§18)', () => {
  it.each(CORE_ROUTE_ENTRIES)('%s does not reach the eager ALL_QUESTIONS module', (entry) => {
    expect(fs.existsSync(entry), `expected core route entry to exist: ${entry}`).toBe(true);
    const reachable = collectReachableFiles(entry);
    expect(reachable.has(eagerQuestionBankFile)).toBe(false);
  });
});
