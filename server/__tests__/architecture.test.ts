import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../config/env';
import { createHttpServer } from '../app/createHttpServer';
import { createMemoryStore } from './helpers/memoryStore';

/**
 * Server-side architecture rules (Phase 2 §4, §11, §21).
 * The contracts-purity + frontend↛server rules live in
 * `contracts/__tests__/architecture.test.ts`.
 */

const serverDir = resolve(__dirname, '..');
const repoRoot = resolve(serverDir, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (['node_modules', 'dist', '.data', '__tests__'].includes(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.ts$/.test(full)) out.push(full);
  }
  return out;
}

function importsOf(file: string): string[] {
  const re = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]/g;
  return [...readFileSync(file, 'utf8').matchAll(re)].map((m) => m[1]);
}

const rel = (f: string) => relative(repoRoot, f).split(sep).join('/');

describe('server/domains boundary (§11)', () => {
  it('no domain module imports express, socket.io, react or a route/page', () => {
    const domainsDir = join(serverDir, 'domains');
    let files: string[];
    try {
      files = walk(domainsDir);
    } catch {
      return; // domains skeleton not populated yet
    }
    const forbidden = /^(express|socket\.io|react|react-dom)$|\/routes\/|\/pages\//;
    const violations = files.flatMap((f) =>
      importsOf(f)
        .filter((s) => forbidden.test(s))
        .map((s) => `${rel(f)} → ${s}`),
    );
    expect(violations, violations.join('\n')).toEqual([]);
  });
});

describe('composition root (acc. #10/#11)', () => {
  it('builds the full HTTP + realtime stack without binding a port', async () => {
    const { config } = loadConfig({ NODE_ENV: 'test', AUTH_MODE: 'development' });
    const bundle = createHttpServer({ config, dbStore: createMemoryStore() });
    expect(bundle.httpServer.listening).toBe(false);
    expect(typeof bundle.io.emit).toBe('function');
    expect(bundle.rooms).toBeDefined();
    await bundle.close();
  });

  it('server/index.ts is the only file that calls listen(', () => {
    const offenders = walk(serverDir)
      .filter((f) => /\.listen\(/.test(readFileSync(f, 'utf8')))
      .map(rel);
    expect(offenders).toEqual(['server/index.ts']);
  });
});
