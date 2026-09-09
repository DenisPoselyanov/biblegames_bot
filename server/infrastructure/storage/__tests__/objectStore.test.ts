import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe } from 'vitest';
import { runObjectStoreContract } from '../../../domains/storage/__tests__/objectStoreContract';
import { createFilesystemObjectStore } from '../filesystemObjectStore';
import { createMemoryObjectStore } from '../memoryObjectStore';

describe('memoryObjectStore', () => {
  runObjectStoreContract(async () => createMemoryObjectStore());
});

describe('filesystemObjectStore', () => {
  const dirs: string[] = [];
  afterAll(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });
  runObjectStoreContract(async () => {
    const dir = mkdtempSync(join(tmpdir(), 'objstore-'));
    dirs.push(dir);
    return createFilesystemObjectStore(dir);
  });
});
