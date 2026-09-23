/**
 * Repair prompt for the `content.ai_repair` job (Phase 4 WS9). Built on the
 * API side from the revision + the signal that flagged it, so the worker needs
 * no database: the job only calls the provider and stores an artifact. The
 * artifact is a *suggestion* — it becomes a draft revision only through the
 * reviewed path (§7.1: a provider never writes repository content).
 */
import type { QuestionRevisionRecord } from '../content/types';
import type { AccuracyBand } from './analytics';
import type { ContentReportCategory } from './types';

export const REPAIR_PROMPT_VERSION = 'question.repair.v1';

export type RepairSignal =
  | { kind: 'accuracy'; issue: Extract<AccuracyBand, 'too_hard' | 'too_easy'>; accuracy: number; attempts: number }
  | { kind: 'reports'; categories: Partial<Record<ContentReportCategory, number>>; comments: string[] }
  /** An editor's own note, from the CLI (`npm run ai -- repair-question --note …`). */
  | { kind: 'manual'; note: string };

const CATEGORY_UK: Record<ContentReportCategory, string> = {
  wrong_answer: 'неправильна відповідь',
  wording: 'незрозуміле формулювання',
  translation: 'переклад',
  reference: 'посилання на Писання',
  offensive: 'образливе чи чутливе',
  technical: 'технічна помилка',
};

function describeSignal(signal: RepairSignal): string {
  if (signal.kind === 'manual') return `Зауваження редактора: ${signal.note.slice(0, 1000)}`;
  if (signal.kind === 'accuracy') {
    const pct = Math.round(signal.accuracy * 100);
    return signal.issue === 'too_hard'
      ? `Лише ${pct}% із ${signal.attempts} відповідей гравців правильні — питання, ймовірно, двозначне, заплутане або має спірну відповідь.`
      : `${pct}% із ${signal.attempts} відповідей правильні — питання нічого не перевіряє: неправильні варіанти очевидно хибні або відповідь підказана в тексті.`;
  }
  const cats = Object.entries(signal.categories)
    .map(([c, n]) => `${CATEGORY_UK[c as ContentReportCategory] ?? c} (${n})`)
    .join(', ');
  const quoted = signal.comments.slice(0, 5).map((c) => `- «${c.slice(0, 300)}»`).join('\n');
  return `Гравці поскаржились: ${cats}.${quoted ? `\nКоментарі гравців:\n${quoted}` : ''}`;
}

export function buildRepairPrompt(revision: QuestionRevisionRecord, signal: RepairSignal): string {
  const options = revision.options.map((o, i) => `${i + 1}. ${o}${i === revision.correctIndex ? ' (правильна)' : ''}`);
  return [
    'Ти редактор біблійної вікторини українською мовою. Виправ одне питання.',
    '',
    'Поточна версія:',
    `Питання: ${revision.text}`,
    'Варіанти:',
    ...options,
    `Пояснення: ${revision.explanationShort ?? '—'}`,
    `Посилання: ${revision.reference ?? '—'}`,
    '',
    `Проблема: ${describeSignal(signal)}`,
    '',
    'Вимоги: зберегти тему й біблійний факт, що перевіряється; одна однозначно правильна відповідь, підтверджена посиланням;',
    'правдоподібні неправильні варіанти схожої довжини; не вигадувати віршів. Якщо питання виправити неможливо — поясни чому.',
    '',
    'Відповідь лише JSON: {"text": string, "options": string[], "correctIndex": number, "explanationShort": string, "reference": string, "changeNote": string}',
  ].join('\n');
}
