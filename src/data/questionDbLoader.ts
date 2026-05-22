import type { Question } from '../types';

/** Ліниве завантаження JSON з data/question-db (тисячі питань без важкого старту) */
const dbModules = import.meta.glob('../../data/question-db/*.json');

const cache = new Map<string, Question[]>();
let loadPromises = new Map<string, Promise<Question[]>>();

function themeIdFromPath(path: string): string {
  const match = path.match(/\/([^/]+)\.json$/);
  return match?.[1] ?? '';
}

export async function loadAiQuestionsForTheme(themeId: string): Promise<Question[]> {
  if (cache.has(themeId)) return cache.get(themeId)!;

  if (!loadPromises.has(themeId)) {
    const loader = Object.entries(dbModules).find(([path]) =>
      themeIdFromPath(path) === themeId,
    );

    const promise = loader
      ? (loader[1]() as Promise<{ default: Question[] }>).then((mod) => {
          const list = (mod.default ?? mod) as Question[];
          const normalized = list.map((q) => ({
            ...q,
            themeId: q.themeId || themeId,
            correctIndex: q.correctIndex ?? (q as Question & { correct?: number }).correct ?? 0,
          }));
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

/** Завантажити всі AI питання з усіх тем */
export async function loadAllAiQuestions(): Promise<Question[]> {
  const all: Question[] = [];
  for (const [path, loader] of Object.entries(dbModules)) {
    const themeId = themeIdFromPath(path);
    if (!themeId) continue;
    const mod = await loader() as { default: Question[] };
    const list = (mod.default ?? mod) as Question[];
    const normalized = list.map((q) => ({
      ...q,
      themeId: q.themeId || themeId,
      correctIndex: q.correctIndex ?? (q as Question & { correct?: number }).correct ?? 0,
    }));
    cache.set(themeId, normalized);
    all.push(...normalized);
  }
  return all;
}
