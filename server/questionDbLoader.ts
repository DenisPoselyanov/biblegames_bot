/// <reference types="node" />
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Question } from '../src/types/index';
import { normalizeQuestion, themeIdFromPath } from '../src/data/questionDbLoader.shared';
import { createQuestionDbLoader } from '../src/data/questionDbLoader.core';

const questionDbDir = join(dirname(fileURLToPath(import.meta.url)), '../data/question-db');

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

const loader = createQuestionDbLoader({
  listThemeIds() {
    if (!existsSync(questionDbDir)) return [];
    return readdirSync(questionDbDir)
      .filter((name: string) => name.endsWith('.json'))
      .map((file) => themeIdFromPath(`/${file}`))
      .filter((themeId): themeId is string => Boolean(themeId));
  },
  async loadTheme(themeId) {
    return readThemeQuestions(themeId);
  },
});

export const { loadAiQuestionsForTheme, preloadThemeQuestions, clearQuestionDbCache, loadAllAiQuestions } = loader;
