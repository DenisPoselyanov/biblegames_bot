/**
 * AI reviewer prompt (content quality gate, layer 2). The reviewer judges one
 * question by the same eight criteria the owner uses for the golden set
 * (`src/lib/contentAssessment.ts`), grounded in the verse text fetched from a
 * trusted source — never from the model's memory of the Bible alone.
 *
 * Pure: the verse text is fetched by `fetchReviewPassages` (through the WS4
 * `ScriptureSourceAdapter`) and handed in, so the prompt is reproducible and
 * testable without a network.
 */
import { z } from 'zod';
import { THEMES } from '../../../src/data/themes';
import { expandReferenceStrings, parseBibleReference } from '../../../src/lib/bibleReference';
import {
  ASSESSMENT_CRITERIA,
  ASSESSMENT_VERDICTS,
  CRITERION_LABELS,
  CRITERION_VALUES,
  type AssessmentCriterion,
  type AssessmentSubject,
} from '../../../src/lib/contentAssessment';
import {
  COMMON_QUESTION_RULES,
  describeAllLevelsForPrompt,
  describeLevelForPrompt,
} from '../../../src/lib/contentLevelRubric';
import type { Difficulty } from '../../../src/types';
import { bookNameUk, describeBooks } from '../content/bibleBooks';
import { AMBIGUOUS_KINGS } from '../content/qualityChecks';
import type { ScriptureSourceAdapter } from '../content/scriptureSourceAdapter';
import { THEME_CANON } from '../content/themeCanon';

/** Bump when the prompt's wording or output contract changes. */
export const AI_REVIEW_PROMPT_VERSION = 'question.review.v1';
/** Ohienko on bolls.life — the translation the bank's names follow. */
export const AI_REVIEW_TRANSLATION = 'UBIO';
/** At most this many cited references are fetched per question. */
const MAX_REFERENCES = 3;

export interface ReviewPassage {
  /** The reference as cited in the question. */
  cited: string;
  /** What was actually looked up, e.g. "1 Самуїлова 17:4". */
  label: string;
  /** Joined verse text, or `null` when the reference didn't resolve / the source had nothing. */
  text: string | null;
  /** Why this candidate exists — set for the two readings of an ambiguous «1–2 Цар.». */
  note?: string;
}

interface Lookup {
  bookId: number;
  chapter: number;
  verses: number[];
  note?: string;
}

function lookupsFor(cited: string): Lookup[] {
  const parsed = parseBibleReference(cited);
  if (!parsed) return [];
  const kings = cited.match(AMBIGUOUS_KINGS);
  if (!kings) return [{ bookId: parsed.bookId, chapter: parsed.chapter, verses: parsed.verses }];
  // «1 Цар.» — 1 Samuel in the Synodal numbering, 1 Kings in Ohienko: show both, let the reviewer decide.
  const n = kings[1] === '1' ? 0 : 1;
  return [
    { bookId: 11 + n, chapter: parsed.chapter, verses: parsed.verses, note: 'якщо «Цар.» — Огієнко (Царів)' },
    { bookId: 9 + n, chapter: parsed.chapter, verses: parsed.verses, note: 'якщо «Цар.» — синодальна нумерація (Самуїлова)' },
  ];
}

const passageLabel = (l: Lookup): string => {
  const first = l.verses[0];
  const last = l.verses[l.verses.length - 1];
  return `${bookNameUk(l.bookId)} ${l.chapter}:${first}${last !== first ? `-${last}` : ''}`;
};

/** The cited verses (Ohienko), both readings for an ambiguous «1–2 Цар.». Never throws. */
export async function fetchReviewPassages(
  reference: string | null,
  adapter: ScriptureSourceAdapter,
): Promise<ReviewPassage[]> {
  const out: ReviewPassage[] = [];
  for (const cited of expandReferenceStrings(reference).slice(0, MAX_REFERENCES)) {
    const lookups = lookupsFor(cited);
    if (lookups.length === 0) {
      out.push({ cited, label: cited, text: null, note: 'посилання не розпізнано' });
      continue;
    }
    for (const l of lookups) {
      let text: string | null = null;
      try {
        const rows = await adapter.fetchPassage({ ...l, translation: AI_REVIEW_TRANSLATION });
        if (rows && rows.length > 0) {
          text = [...rows].sort((a, b) => a.verse - b.verse).map((r) => `${r.verse} ${r.text}`).join(' ');
        }
      } catch {
        text = null;
      }
      out.push({ cited, label: passageLabel(l), text, ...(l.note ? { note: l.note } : {}) });
    }
  }
  return out;
}

const THEME_TITLE = new Map(THEMES.map((t) => [t.id, t.title]));
const LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е'];

function describeCanon(themeId: string): string {
  const canon = THEME_CANON[themeId];
  if (!canon) return 'Книги теми не визначені.';
  const lines = [`Книги теми: ${describeBooks(canon.primary)}.`];
  if (canon.secondary.length) lines.push(`Законні перехресні посилання: ${describeBooks(canon.secondary)}.`);
  return lines.join(' ');
}

export function buildAiReviewPrompt(subject: AssessmentSubject, passages: readonly ReviewPassage[]): string {
  const themeTitle = THEME_TITLE.get(subject.themeId) ?? subject.themeId;
  const options = subject.options.map(
    (o, i) => `${LETTERS[i] ?? i + 1}) ${o}${i === subject.correctIndex ? '   ← позначена правильною' : ''}`,
  );
  const verses = passages.length
    ? passages.map((p) =>
        p.text
          ? `- ${p.label}${p.note ? ` (${p.note})` : ''}: ${p.text}`
          : `- ${p.label}: текст не знайдено${p.note ? ` (${p.note})` : ''}`,
      )
    : ['- посилання немає'];
  const criteria = ASSESSMENT_CRITERIA.map((c) => `- ${c}: ${CRITERION_LABELS[c].question}`);
  const themes = THEMES.map((t) => `${t.id} («${t.title}»)`).join(', ');

  return [
    'Ти рецензент біблійної вікторини українською мовою (переклад Огієнка). Оціни ОДНЕ питання. Нічого не виправляй у самому питанні — лише оціни й, за потреби, запропонуй.',
    '',
    '## Питання',
    `Тема: ${themeTitle} (${subject.themeId})`,
    `Рівень: ${subject.difficulty}`,
    `Питання: ${subject.text}`,
    ...options,
    `Коротке пояснення: ${subject.explanationShort ?? '—'}`,
    `Розширене пояснення: ${subject.explanationDeep ?? '—'}`,
    `Посилання: ${subject.reference ?? '—'}`,
    '',
    '## Текст вказаних віршів (Огієнко, з довіреного джерела)',
    ...verses,
    'Спирайся насамперед на цей текст. Якщо тексту немає або він не про те — не вигадуй вірш: став answer_supported = "unsure" (або "fail", якщо впевнений, що факт хибний) і знижуй confidence.',
    '',
    '## Тема',
    describeCanon(subject.themeId),
    'Посилання поза книгами теми — ще не помилка (буває законне перехресне посилання), але питання про іншу подію чи особу — topic_fit = "fail" і suggestedThemeId.',
    '',
    '## Рівень питання',
    describeLevelForPrompt(subject.difficulty),
    'Усі рівні (рівень — це складність знання, а не вік гравця):',
    describeAllLevelsForPrompt(),
    '',
    '## Правила банку',
    ...COMMON_QUESTION_RULES.map((r) => `- ${r}`),
    '',
    '## Критерії (кожен: "pass" | "fail" | "unsure")',
    ...criteria,
    '',
    '## Вердикт',
    '- reject — хибна чи непідтверджена правильна відповідь, кілька правильних, вигадані події/імена/вірші (answer_supported, single_correct або factual = fail).',
    '- repair — зміст правильний, але слабкі варіанти, пояснення не під рівень або мова (distractors, explanation_fit, language = fail).',
    '- reclassify — тіло питання добре, але не той рівень чи тема (level_fit, topic_fit = fail).',
    '- pass — усе гаразд.',
    'Вердикт не може бути м’якшим, ніж випливає з критеріїв.',
    '',
    '## Пропозиції (лише коли потрібні, інакше null)',
    '- suggestedDifficulty — якщо level_fit = fail: один із baby, child, youth, student, preacher, teacher, theologian.',
    `- suggestedThemeId — якщо topic_fit = fail: один з id: ${themes}.`,
    '- suggestedExplanationShort / suggestedExplanationDeep — якщо explanation_fit = fail: нові пояснення під рівень, лише за текстом віршів.',
    '- notes — до 400 символів: що саме не так (для редактора).',
    '- confidence — від 0 до 1: наскільки ти впевнений у вердикті.',
    '',
    'Відповідь — лише JSON:',
    '{"criteria": {"answer_supported": "...", "single_correct": "...", "factual": "...", "distractors": "...", "topic_fit": "...", "level_fit": "...", "explanation_fit": "...", "language": "..."}, "verdict": "pass|reclassify|repair|reject", "confidence": 0.0, "suggestedDifficulty": null, "suggestedThemeId": null, "suggestedExplanationShort": null, "suggestedExplanationDeep": null, "notes": ""}',
  ].join('\n');
}

const criterionValue = z.enum(CRITERION_VALUES);
const criteriaShape = Object.fromEntries(ASSESSMENT_CRITERIA.map((c) => [c, criterionValue])) as {
  [K in AssessmentCriterion]: typeof criterionValue;
};
const DIFFICULTY_VALUES = ['baby', 'child', 'youth', 'student', 'preacher', 'teacher', 'theologian'] as const satisfies readonly Difficulty[];

/**
 * The reviewer's raw output. Deliberately lenient on lengths and ranges (a
 * schema miss is a non-retryable provider error) — `aiReview.ts` clamps and
 * trims before anything is stored.
 */
export const aiReviewOutputSchema = z.object({
  criteria: z.object(criteriaShape),
  verdict: z.enum(ASSESSMENT_VERDICTS),
  confidence: z.number(),
  suggestedDifficulty: z.enum(DIFFICULTY_VALUES).nullish(),
  suggestedThemeId: z.string().nullish(),
  suggestedExplanationShort: z.string().nullish(),
  suggestedExplanationDeep: z.string().nullish(),
  notes: z.string().nullish(),
});
export type AiReviewOutput = z.infer<typeof aiReviewOutputSchema>;
