import type { Question } from '../types';
import { normalizeQuestion, themeIdFromPath } from './questionDbLoader.shared';
import { createQuestionDbLoader } from './questionDbLoader.core';

/** Vite replaces import.meta.glob at build time — must not be behind a runtime check. */
const dbModules = import.meta.glob('../../data/question-db/*.json');

const loadersByThemeId = new Map<string, () => Promise<unknown>>();
for (const [path, loader] of Object.entries(dbModules)) {
  const themeId = themeIdFromPath(path);
  if (themeId) loadersByThemeId.set(themeId, loader);
}

const loader = createQuestionDbLoader({
  listThemeIds: () => Array.from(loadersByThemeId.keys()),
  async loadTheme(themeId) {
    const load = loadersByThemeId.get(themeId);
    if (!load) return [];
    const mod = (await load()) as { default: Question[] };
    const list = (mod.default ?? mod) as Question[];
    return list.map((q) => normalizeQuestion(q, themeId));
  },
});

export const { loadAiQuestionsForTheme, preloadThemeQuestions, clearQuestionDbCache, loadAllAiQuestions } = loader;
