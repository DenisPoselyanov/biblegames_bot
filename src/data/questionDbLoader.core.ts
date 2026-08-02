import type { Question } from '../types';

export interface QuestionDbSource {
  listThemeIds(): string[] | Promise<string[]>;
  loadTheme(themeId: string): Promise<Question[]>;
}

/** Platform-agnostic caching core shared by the Vite (client) and fs (server) question-db loaders. */
export function createQuestionDbLoader(source: QuestionDbSource) {
  const cache = new Map<string, Question[]>();
  const loadPromises = new Map<string, Promise<Question[]>>();

  async function loadAiQuestionsForTheme(themeId: string): Promise<Question[]> {
    if (cache.has(themeId)) return cache.get(themeId)!;

    if (!loadPromises.has(themeId)) {
      const promise = source.loadTheme(themeId).then((normalized) => {
        cache.set(themeId, normalized);
        return normalized;
      });
      loadPromises.set(themeId, promise);
    }

    return loadPromises.get(themeId)!;
  }

  function preloadThemeQuestions(themeId: string): void {
    void loadAiQuestionsForTheme(themeId);
  }

  function clearQuestionDbCache(): void {
    cache.clear();
    loadPromises.clear();
  }

  async function loadAllAiQuestions(): Promise<Question[]> {
    const themeIds = await source.listThemeIds();
    const entries = await Promise.all(themeIds.map((themeId) => loadAiQuestionsForTheme(themeId)));
    return entries.flat();
  }

  return { loadAiQuestionsForTheme, preloadThemeQuestions, clearQuestionDbCache, loadAllAiQuestions };
}
