import type { Difficulty, Question } from '../types';
import { ALL_QUESTIONS, getAllQuestionsAsync, getQuestionsForLevel } from './questions';

let kahootPoolOverride: Question[] | null = null;

/** Викликається сервером при старті для повного пулу (embedded + AI JSON) */
export function setKahootQuestionPool(questions: Question[]): void {
  kahootPoolOverride = questions;
}

function getSyncPool(): Question[] {
  return kahootPoolOverride ?? ALL_QUESTIONS;
}

function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Питання для Kahoot з однієї або кількох тем */
export async function getKahootQuestions(
  themeIds: string[],
  count: number,
  difficulty: Difficulty = 'youth',
): Promise<Question[]> {
  const all = await getAllQuestionsAsync();
  const pool: Question[] = [];

  for (const themeId of themeIds) {
    pool.push(
      ...all.filter((q) => q.themeId === themeId && q.difficulty === difficulty),
    );
  }

  if (pool.length === 0) {
    for (const themeId of themeIds) {
      pool.push(...getQuestionsForLevel(themeId, 'child', 50));
    }
  }

  const unique = new Map<string, Question>();
  for (const q of pool) {
    unique.set(`${q.themeId}|${q.text}`, q);
  }

  return shuffle([...unique.values()]).slice(0, Math.min(count, unique.size));
}

/** Синхронний пул для сервера (без AI JSON) */
export function getKahootQuestionsSync(
  themeIds: string[],
  count: number,
  difficulty: Difficulty = 'youth',
): Question[] {
  const pool = getSyncPool().filter(
    (q) => themeIds.includes(q.themeId) && q.difficulty === difficulty,
  );

  if (pool.length === 0) {
    for (const themeId of themeIds) {
      pool.push(...getQuestionsForLevel(themeId, 'child', 30));
    }
  }

  const unique = new Map<string, Question>();
  for (const q of pool) {
    unique.set(`${q.themeId}|${q.text}`, q);
  }

  return shuffle([...unique.values()]).slice(0, Math.min(count, unique.size));
}

export function getKahootQuestionsByIdsSync(questionIds: string[], count?: number): Question[] {
  const map = new Map<string, Question>();
  for (const q of getSyncPool()) map.set(q.id, q);

  const unique: Question[] = [];
  const picked = new Set<string>();
  for (const id of questionIds) {
    const q = map.get(id);
    if (!q) continue;
    if (picked.has(q.id)) continue;
    picked.add(q.id);
    unique.push(q);
  }

  const limit = Math.min(unique.length, Math.max(1, count ?? unique.length));
  return shuffle(unique).slice(0, limit);
}
