import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Architecture rules (Phase 2 §21, §22).
 *
 * WS1 scope: enforce the `contracts/` purity boundary and the frontend↛server
 * boundary, plus cycle-freedom within the contracts subgraph. Full-repo cycle
 * detection and the `services ↛ express/socket.io` rule are added with the
 * dependency-cruiser tooling pass in WS2 (see docs — phase-2 memo).
 */

const repoRoot = resolve(__dirname, '..', '..');
const contractsDir = resolve(__dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === '.data') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

const IMPORT_RE = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]/g;

function importsOf(file: string): string[] {
  const src = readFileSync(file, 'utf8');
  const specs: string[] = [];
  for (const m of src.matchAll(IMPORT_RE)) specs.push(m[1] ?? m[2]);
  return specs.filter(Boolean);
}

describe('contracts/ purity', () => {
  const files = walk(contractsDir).filter((f) => !f.includes('__tests__'));

  it('imports nothing but zod and sibling contract modules', () => {
    const violations: string[] = [];
    for (const file of files) {
      for (const spec of importsOf(file)) {
        const ok = spec === 'zod' || spec.startsWith('./') || spec.startsWith('../');
        const escapes = spec.startsWith('.') && !resolve(dirname(file), spec).startsWith(contractsDir);
        if (!ok || escapes) {
          violations.push(`${relative(repoRoot, file)} → ${spec}`);
        }
      }
    }
    expect(violations, `forbidden imports in contracts/:\n${violations.join('\n')}`).toEqual([]);
  });

  it('has no import cycles', () => {
    const graph = new Map<string, string[]>();
    for (const file of files) {
      graph.set(
        file,
        importsOf(file)
          .filter((s) => s.startsWith('.'))
          .map((s) => {
            const base = resolve(dirname(file), s);
            for (const cand of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
              if (files.includes(cand)) return cand;
            }
            return base;
          }),
      );
    }
    const state = new Map<string, 0 | 1 | 2>();
    const stack: string[] = [];
    const cycles: string[] = [];
    const visit = (n: string): void => {
      state.set(n, 1);
      stack.push(n);
      for (const dep of graph.get(n) ?? []) {
        if (state.get(dep) === 1) {
          cycles.push([...stack.slice(stack.indexOf(dep)), dep].map((f) => relative(repoRoot, f)).join(' → '));
        } else if (!state.get(dep) && graph.has(dep)) {
          visit(dep);
        }
      }
      stack.pop();
      state.set(n, 2);
    };
    for (const n of graph.keys()) if (!state.get(n)) visit(n);
    expect(cycles, `import cycles:\n${cycles.join('\n')}`).toEqual([]);
  });
});

describe('frontend ↛ server boundary (§21)', () => {
  it('no file under src/ imports from server/', () => {
    const srcDir = join(repoRoot, 'src');
    const violations: string[] = [];
    for (const file of walk(srcDir)) {
      for (const spec of importsOf(file)) {
        if (/(^|\/)server\//.test(spec) || spec.includes('../server/')) {
          violations.push(`${relative(repoRoot, file)} → ${spec}`);
        }
      }
    }
    expect(violations, violations.join('\n')).toEqual([]);
  });
});
