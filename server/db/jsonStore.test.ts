import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { jsonStore } from './jsonStore';

let cwd: string;
let dir: string;

beforeEach(() => {
  cwd = process.cwd();
  dir = mkdtempSync(join(tmpdir(), 'jsonstore-'));
  process.chdir(dir);
});

afterEach(() => {
  process.chdir(cwd);
  rmSync(dir, { recursive: true, force: true });
});

describe('jsonStore (atomic, no debounce)', () => {
  it('persists a profile durably the moment setProfile resolves', async () => {
    await jsonStore.setProfile('u1', { userId: 'u1', coins: 5 });

    const file = join(dir, '.data', 'db.json');
    expect(existsSync(file)).toBe(true);
    expect(JSON.parse(readFileSync(file, 'utf8')).profiles.u1).toEqual({ userId: 'u1', coins: 5 });
    expect(await jsonStore.getProfile('u1')).toEqual({ userId: 'u1', coins: 5 });
  });

  it('serializes concurrent writes without losing any', async () => {
    await Promise.all(
      Array.from({ length: 15 }, (_, i) => jsonStore.setStats(`u${i}`, { userId: `u${i}`, i })),
    );
    for (let i = 0; i < 15; i += 1) {
      expect(await jsonStore.getStats(`u${i}`)).toMatchObject({ i });
    }
  });
});
