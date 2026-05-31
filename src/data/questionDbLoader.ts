import type { Question } from '../types';
import { normalizeQuestionReference } from '../lib/bibleReference';

/** Ліниве завантаження JSON з data/question-db (тисячі питань без важкого старту) */
const dbModules = import.meta.glob('../../data/question-db/*.json');

const cache = new Map<string, Question[]>();
let loadPromises = new Map<string, Promise<Question[]>>();

function normalizeCorrectIndex(value: unknown): number {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 3) {
    return value;
  }
  return 0;
}

function normalizeQuestion(q: Question, themeId: string): Question {
  const raw = q as Question & { reference?: unknown };
  return {
    ...q,
    themeId: q.themeId || themeId,
    reference: normalizeQuestionReference(raw.reference),
    correctIndex: normalizeCorrectIndex(
      q.correctIndex ?? (q as Question & { correct?: number }).correct,
    ),
  };
}

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

/** Завантажити всі AI питання з усіх тем */
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
