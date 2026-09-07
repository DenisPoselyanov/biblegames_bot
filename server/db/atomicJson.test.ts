import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readJsonFile, withFileMutex, writeJsonFileAtomic } from './atomicJson';

let dir: string;
let file: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'atomicjson-'));
  file = join(dir, 'db.json');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('readJsonFile', () => {
  it('returns the fallback for a missing file', () => {
    expect(readJsonFile(file, { a: 1 })).toEqual({ a: 1 });
  });

  it('returns the fallback for a corrupt file (never throws)', () => {
    writeFileSync(file, '{ not json', 'utf8');
    expect(readJsonFile(file, { ok: true })).toEqual({ ok: true });
  });
});

describe('writeJsonFileAtomic', () => {
  it('round-trips and leaves no temp files behind', () => {
    writeJsonFileAtomic(file, { hello: 'world' });
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ hello: 'world' });
    expect(readdirSync(dir)).toEqual(['db.json']);
  });

  it('overwrites the previous content wholesale', () => {
    writeJsonFileAtomic(file, { v: 1 });
    writeJsonFileAtomic(file, { v: 2 });
    expect(readJsonFile(file, null)).toEqual({ v: 2 });
  });
});

describe('withFileMutex', () => {
  it('serializes concurrent mutations of the same file', async () => {
    writeJsonFileAtomic(file, { n: 0 });
    const bump = () =>
      withFileMutex(file, async () => {
        const db = readJsonFile<{ n: number }>(file, { n: 0 });
        await new Promise((r) => setTimeout(r, 1));
        writeJsonFileAtomic(file, { n: db.n + 1 });
      });

    await Promise.all(Array.from({ length: 20 }, bump));
    expect(readJsonFile<{ n: number }>(file, { n: 0 }).n).toBe(20);
  });
});
