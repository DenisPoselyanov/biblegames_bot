import type { Difficulty, Question } from '../types';
import { ALL_QUESTIONS, getQuestionsForLevel } from './questions';

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
  difficulty: Difficulty = 'medium',
): Promise<Question[]> {
  const pool: Question[] = [];

  for (const themeId of themeIds) {
    const embedded = ALL_QUESTIONS.filter(
      (q) => q.themeId === themeId && q.difficulty === difficulty,
    );
    const { loadAiQuestionsForTheme } = await import('./questionDbLoader');
    const ai = await loadAiQuestionsForTheme(themeId);
    const aiFiltered = ai.filter((q) => q.difficulty === difficulty);
    pool.push(...embedded, ...aiFiltered);
  }

  if (pool.length === 0) {
    for (const themeId of themeIds) {
      pool.push(...getQuestionsForLevel(themeId, 'easy', 50));
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
  difficulty: Difficulty = 'medium',
): Question[] {
  const pool = ALL_QUESTIONS.filter(
    (q) => themeIds.includes(q.themeId) && q.difficulty === difficulty,
  );

  if (pool.length === 0) {
    for (const themeId of themeIds) {
      pool.push(...getQuestionsForLevel(themeId, 'easy', 30));
    }
  }

  const unique = new Map<string, Question>();
  for (const q of pool) {
    unique.set(`${q.themeId}|${q.text}`, q);
  }

  return shuffle([...unique.values()]).slice(0, Math.min(count, unique.size));
}
