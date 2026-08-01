import type { Question } from '../types';
import { normalizeQuestion, themeIdFromPath } from './questionDbLoader.shared';

/** Vite replaces import.meta.glob at build time — must not be behind a runtime check. */
const dbModules = import.meta.glob('../../data/question-db/*.json');

const cache = new Map<string, Question[]>();
const loadPromises = new Map<string, Promise<Question[]>>();

export async function loadAiQuestionsForTheme(themeId: string): Promise<Question[]> {
  if (cache.has(themeId)) return cache.get(themeId)!;

  if (!loadPromises.has(themeId)) {
    const loader = Object.entries(dbModules).find(([path]) =>
      themeIdFromPath(path) === themeId,
    );

    const promise = loader
      ? (loader[1]() as Promise<{ default: Question[] }>).then((mod) => {
          const list = (mod.default ?? mod) as Question[];
          const normalized = list.map((q) => normalizeQuestion(q, themeId));
          cache.set(themeId, normalized);
          return normalized;
        })
      : Promise.resolve([]).then((empty) => {
          cache.set(themeId, empty);
          return empty;
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
  const entries = await Promise.all(
    Object.entries(dbModules).map(async ([path, loader]) => {
      const themeId = themeIdFromPath(path);
      if (!themeId) return [] as Question[];
      const mod = (await loader()) as { default: Question[] };
      const list = (mod.default ?? mod) as Question[];
      const normalized = list.map((q) => normalizeQuestion(q, themeId));
      cache.set(themeId, normalized);
      return normalized;
    }),
  );
  return entries.flat();
}
