/**
 * Difficulty-level rubric for questions AND their explanations (content quality
 * gate). One source for the deterministic checks, the AI reviewer / repair /
 * generation prompts and the Studio labelling page; the prose version is
 * `docs/CONTENT_DIFFICULTY_RUBRIC.md`.
 *
 * Levels are question difficulty only — never an age rating (owner decision
 * 2026-09-23). An explanation "fits the level" when its depth and vocabulary
 * match what a player at that level is being taught, not when it is short.
 *
 * Two explanation fields, two jobs:
 * - `explanationShort` — shown right after the answer, every level: one or two
 *   sentences that confirm the answer from the text.
 * - `explanationDeep` — the "Детальніше" part of the explanation sheet: optional
 *   for the lower levels, expected from `preacher` up, where the point of the
 *   question is context, meaning and connections.
 */
import type { Difficulty } from '../types';

export interface LevelRubric {
  level: Difficulty;
  label: string;
  /** What the question itself checks at this level. */
  question: string;
  example: string;
  /** What `explanationShort` says and how. */
  explanationShort: string;
  /** What `explanationDeep` adds, and whether it is expected. */
  explanationDeep: string;
  deepExpected: boolean;
  /** `explanationShort` length window in characters (outside it → warning). */
  shortChars: { min: number; max: number };
  /** `explanationDeep` length window, when present. */
  deepChars: { min: number; max: number };
}

export const LEVEL_RUBRIC: readonly LevelRubric[] = [
  {
    level: 'baby',
    label: 'Немовля',
    question: 'найвідоміші історії та постаті, одна очевидна деталь',
    example: '«Хто збудував ковчег?»',
    explanationShort: 'одне просте речення: що сталося і де це написано; без богословських термінів',
    explanationDeep: 'не потрібне; якщо є — 1–2 прості речення про те, що було далі',
    deepExpected: false,
    shortChars: { min: 30, max: 160 },
    deepChars: { min: 60, max: 300 },
  },
  {
    level: 'child',
    label: 'Дитина',
    question: 'ключові події й персонажі, прості «хто/що/де»',
    example: '«Скільки разів Петро відрікся від Ісуса?»',
    explanationShort: '1–2 прості речення: факт і одна деталь контексту (хто, де, чому)',
    explanationDeep: 'не обовʼязкове; коротко — чим подія важлива в історії',
    deepExpected: false,
    shortChars: { min: 40, max: 200 },
    deepChars: { min: 80, max: 400 },
  },
  {
    level: 'youth',
    label: 'Юнак',
    question: 'послідовність подій, звʼязок персонажів, відомі вірші',
    example: '«Кого Бог послав до Ніневії?»',
    explanationShort: '1–2 речення: факт плюс причина чи наслідок, звʼязок із сусідніми подіями',
    explanationDeep: 'бажане: 2–4 речення про місце події в книзі',
    deepExpected: false,
    shortChars: { min: 50, max: 240 },
    deepChars: { min: 120, max: 600 },
  },
  {
    level: 'student',
    label: 'Учень',
    question: 'менш відомі деталі, книги та автори, основні вчення',
    example: '«Як звали чоловіка Ноомі?»',
    explanationShort: '1–2 речення: факт із точним посиланням і контекстом книги чи автора',
    explanationDeep: 'бажане: контекст книги, чому неправильні варіанти хибні',
    deepExpected: false,
    shortChars: { min: 60, max: 260 },
    deepChars: { min: 150, max: 700 },
  },
  {
    level: 'preacher',
    label: 'Проповідник',
    question: 'вчення в контексті, прообрази, цитати з посиланням',
    example: '«Як Євр. 1:7 описує ангелів порівняно з Сином?»',
    explanationShort: '1–2 речення: відповідь і її значення для вчення',
    explanationDeep: 'потрібне: значення для вчення, прообраз чи паралель, звʼязок з іншими місцями Писання',
    deepExpected: true,
    shortChars: { min: 60, max: 280 },
    deepChars: { min: 200, max: 900 },
  },
  {
    level: 'teacher',
    label: 'Учитель',
    question: 'точні деталі тексту, звʼязки між Заповітами, значення слів',
    example: '«Що означало «виправданий» у притчі про митаря?»',
    explanationShort: '1–2 речення: точна деталь тексту і що вона означає',
    explanationDeep: 'потрібне: значення слів, звʼязок Старого й Нового Заповіту, історичний контекст',
    deepExpected: true,
    shortChars: { min: 60, max: 300 },
    deepChars: { min: 250, max: 1000 },
  },
  {
    level: 'theologian',
    label: 'Богослов',
    question: 'тонкі текстуальні й доктринальні питання, історичний контекст',
    example: '«Чим Филип-диякон (Дії 8) відрізняється від апостола Филипа?»',
    explanationShort: '1–2 речення: чітка відповідь із посиланнями',
    explanationDeep: 'потрібне: текстуальні, історичні чи доктринальні нюанси, різні прочитання, якщо вони є',
    deepExpected: true,
    shortChars: { min: 60, max: 320 },
    deepChars: { min: 300, max: 1200 },
  },
];

const BY_LEVEL = new Map(LEVEL_RUBRIC.map((r) => [r.level, r]));

export function rubricFor(level: Difficulty | string): LevelRubric | undefined {
  return BY_LEVEL.get(level as Difficulty);
}

/** The rules every level shares — the AI prompts quote these verbatim. */
export const COMMON_QUESTION_RULES: readonly string[] = [
  'Одна правильна відповідь, і її підтверджує вказаний вірш.',
  'Неправильні варіанти правдоподібні, але однозначно хибні за текстом; жартівливі — лише для «Немовля»/«Дитина».',
  'Відповідь не підказана ні текстом питання, ні довжиною варіанта.',
  'Питання в своїй темі: вірш належить до книг теми або до її законних перехресних посилань.',
  'Українська мова без росіянізмів; імена в перекладі Огієнка.',
  'Посилання повною назвою книги («1 Самуїлова», а не «1 Цар.»).',
  'Пояснення не вигадує віршів і подій, яких немає в тексті; рівень — це складність, а не вік гравця.',
];

/** Compact Ukrainian description of one level, for prompts. */
export function describeLevelForPrompt(level: Difficulty | string): string {
  const r = rubricFor(level);
  if (!r) return `Рівень: ${level}`;
  return [
    `Рівень «${r.label}» (${r.level}). Питання перевіряє: ${r.question}. Приклад: ${r.example}.`,
    `Коротке пояснення (${r.shortChars.min}–${r.shortChars.max} символів): ${r.explanationShort}.`,
    `Розширене пояснення (${r.deepChars.min}–${r.deepChars.max} символів): ${r.explanationDeep}.`,
  ].join('\n');
}

/** All seven levels, one line each — lets the reviewer propose a different level. */
export function describeAllLevelsForPrompt(): string {
  return LEVEL_RUBRIC.map((r) => `- ${r.level} «${r.label}»: ${r.question}`).join('\n');
}
