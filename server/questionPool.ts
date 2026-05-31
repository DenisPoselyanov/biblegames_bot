import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import type { Question } from '../src/types/index';
import { ALL_QUESTIONS } from '../src/data/questions';
import { setKahootQuestionPool } from '../src/data/kahootQuestions';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_DIR = join(__dirname, '../data/question-db');

let pool: Question[] | null = null;

function normalizeCorrectIndex(value: unknown): number {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 3) {
    return value;
  }
  return 0;
}

export function loadFullQuestionPool(): Question[] {
  if (pool) return pool;

  const byId = new Map<string, Question>();
  for (const q of ALL_QUESTIONS) {
    byId.set(q.id, q);
  }

  if (fs.existsSync(DB_DIR)) {
    for (const file of fs.readdirSync(DB_DIR)) {
      if (!file.endsWith('.json')) continue;
      const themeId = file.replace(/\.json$/, '');
      try {
        const list = JSON.parse(fs.readFileSync(join(DB_DIR, file), 'utf8')) as Question[];
        if (!Array.isArray(list)) continue;
        for (const raw of list) {
          const q: Question = {
            ...raw,
            themeId: raw.themeId || themeId,
            correctIndex: normalizeCorrectIndex(raw.correctIndex),
          };
          byId.set(q.id, q);
        }
      } catch {
        // skip broken file
      }
    }
  }

  pool = [...byId.values()];
  setKahootQuestionPool(pool);
  return pool;
}
