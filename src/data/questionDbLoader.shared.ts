import type { Question } from '../types';
import { normalizeQuestionReference } from '../lib/bibleReference';

export function normalizeCorrectIndex(value: unknown): number {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 3) {
    return value;
  }
  return 0;
}

export function normalizeQuestion(q: Question, themeId: string): Question {
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

export function themeIdFromPath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const match = normalized.match(/\/([^/]+)\.json$/);
  return match?.[1] ?? '';
}
