import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes } from 'node:crypto';

/**
 * Atomic JSON file primitives for the dev/local storage adapters
 * (Phase 1 §15 "JSON dev adapter writes atomically", ADR-006).
 *
 * A crash mid-write must never leave a half-written or empty file: we write the
 * full payload to a unique temp file in the same directory, fsync it, then
 * `rename` it over the target — `rename` is atomic on a single volume on both
 * POSIX and Windows.
 */

export function readJsonFile<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

export function writeJsonFileAtomic(path: string, data: unknown): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const tmp = `${path}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  const body = `${JSON.stringify(data, null, 2)}\n`;
  const fd = openSync(tmp, 'w');
  try {
    writeSync(fd, body);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }

  try {
    renameSync(tmp, path);
  } catch {
    // Windows can reject rename-over-existing while another handle holds the
    // target open. `body` is fully materialized, so a single truncating write
    // is still all-or-nothing at the syscall level.
    writeFileSync(path, body, 'utf8');
    try {
      rmSync(tmp, { force: true });
    } catch {
      /* best-effort temp cleanup */
    }
  }
}

const chains = new Map<string, Promise<unknown>>();

/**
 * Serializes async mutations of one file within this process: concurrent
 * `withFileMutex(path, ...)` calls run one after another. Cross-process safety
 * is a Postgres concern, not something the dev JSON adapter needs to solve.
 */
export function withFileMutex<T>(path: string, fn: () => Promise<T>): Promise<T> {
  const prev = chains.get(path) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  chains.set(
    path,
    next.then(
      () => undefined,
      () => undefined,
    ),
  );
  return next;
}
