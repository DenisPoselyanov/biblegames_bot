import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import type { Question } from '../src/types/index';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXCLUSIONS_FILE = join(__dirname, '../data/question-exclusions.json');
const OVERRIDES_FILE = join(__dirname, '../data/question-overrides.json');

function readJsonFile<T>(path: string, fallback: T): T {
  try {
    if (!fs.existsSync(path)) return fallback;
    return JSON.parse(fs.readFileSync(path, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function writeJsonFile(path: string, data: unknown): void {
  fs.mkdirSync(dirname(path), { recursive: true });
  fs.writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export function loadExclusionsFromDisk(): string[] {
  return readJsonFile<string[]>(EXCLUSIONS_FILE, []);
}

export function loadOverridesFromDisk(): Record<string, Partial<Question>> {
  return readJsonFile<Record<string, Partial<Question>>>(OVERRIDES_FILE, {});
}

export function saveExclusionsToDisk(ids: string[]): void {
  writeJsonFile(EXCLUSIONS_FILE, [...ids].sort());
}

export function saveOverridesToDisk(overrides: Record<string, Partial<Question>>): void {
  writeJsonFile(OVERRIDES_FILE, overrides);
}

export function applyDiskMutations(questions: Question[]): Question[] {
  const excluded = new Set(loadExclusionsFromDisk());
  const overrides = loadOverridesFromDisk();

  return questions
    .filter((q) => !excluded.has(q.id))
    .map((q) => {
      const patch = overrides[q.id];
      if (!patch) return q;
      return { ...q, ...patch, id: q.id };
    });
}

export function normalizeCorrectIndex(value: unknown): number {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 3) {
    return value;
  }
  return 0;
}

let poolInvalidateHook: (() => void) | null = null;

export function registerQuestionPoolInvalidator(fn: () => void): void {
  poolInvalidateHook = fn;
}

export function notifyQuestionPoolChanged(): void {
  poolInvalidateHook?.();
}
