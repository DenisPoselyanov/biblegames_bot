/// <reference types="node" />
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Question } from '../src/types/index';
import { normalizeQuestion, themeIdFromPath } from '../src/data/questionDbLoader.shared';

const questionDbDir = join(dirname(fileURLToPath(import.meta.url)), '../data/question-db');

const cache = new Map<string, Question[]>();
const loadPromises = new Map<string, Promise<Question[]>>();

function readThemeQuestions(themeId: string): Question[] {
  const path = join(questionDbDir, `${themeId}.json`);
  if (!existsSync(path)) return [];
  try {
    const list = JSON.parse(readFileSync(path, 'utf8')) as Question[];
    if (!Array.isArray(list)) return [];
    return list.map((q) => normalizeQuestion(q, themeId));
  } catch {
    return [];
  }
}

export async function loadAiQuestionsForTheme(themeId: string): Promise<Question[]> {
  if (cache.has(themeId)) return cache.get(themeId)!;

  if (!loadPromises.has(themeId)) {
    const promise = Promise.resolve(readThemeQuestions(themeId)).then((normalized) => {
      cache.set(themeId, normalized);
      return normalized;
    });
    loadPromises.set(themeId, promise);
  }

  return loadPromises.get(themeId)!;
}

export function preloadThemeQuestions(themeId: string): void {
  void loadAiQuestionsForTheme(themeId);
}

export function clearQuestionDbCache(): void {
  cache.clear();
  loadPromises.clear();
}

export async function loadAllAiQuestions(): Promise<Question[]> {
  if (!existsSync(questionDbDir)) return [];
  const files = readdirSync(questionDbDir).filter((name: string) => name.endsWith('.json'));
  const all: Question[] = [];
  for (const file of files) {
    const themeId = themeIdFromPath(`/${file}`);
    if (!themeId) continue;
    const questions = await loadAiQuestionsForTheme(themeId);
    all.push(...questions);
  }
  return all;
}
