/**
 * Deterministic quality checks for a question body (Phase 4 WS3, spec §6.2,
 * §6.4, §6.5). Pure functions — no repository, no I/O — so they are testable
 * without a database and reusable from the import path, a future
 * `content.validate-batch` job, and Content Studio's review editor.
 *
 * "Heuristics create warnings or quarantine according to policy. They do not
 * auto-publish." (§6.2) — nothing here mutates a revision's status; callers
 * decide what to do with `ValidationFinding[]` (WS8's review editor renders
 * them, WS6's publish/approve action should refuse when `hasBlocking()` is
 * true per `server/domains/shared/validationFindingsRepository.ts`).
 */
import { expandReferenceStrings, parseBibleReference } from '../../../src/lib/bibleReference';
import type { NewValidationFinding } from '../shared/validationFindings';
import { canonFit } from './themeCanon';

/** The subset of a draft/revision every check needs — both `RevisionDraft` and `QuestionRevisionRecord` satisfy this structurally. */
export interface QuestionBody {
  questionId: string;
  themeId: string;
  text: string;
  options: string[];
  correctIndex: number;
  explanationShort?: string | null;
  explanationDeep?: string | null;
  /** `undefined` skips the reference checks (callers that don't carry one); `null`/'' means "has none". */
  reference?: string | null;
}

/** A sibling question to compare against for duplicate detection — same shape, minus the fields checks don't need. */
export interface QuestionSibling {
  questionId: string;
  text: string;
  options: string[];
}

export interface QualityCheckContext {
  /** Other live questions in the bank (any theme) — exclude the candidate's own `questionId`. */
  siblings: readonly QuestionSibling[];
  /** Theme ids the caller knows to be real. Omitted → the orphan-theme check is skipped, never guessed. */
  knownThemeIds?: readonly string[];
}

const normalize = (s: string): string =>
  s
    .toLowerCase()
    .replace(/['"«»`.,;:!?()\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenize = (s: string): Set<string> => new Set(normalize(s).split(' ').filter(Boolean));

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

const NEAR_DUPLICATE_THRESHOLD = 0.85;

function duplicateChecks(body: QuestionBody, siblings: readonly QuestionSibling[]): NewValidationFinding[] {
  const findings: NewValidationFinding[] = [];
  const normalizedSelf = normalize(body.text);
  const tokensSelf = tokenize(body.text);

  for (const sibling of siblings) {
    if (sibling.questionId === body.questionId) continue;
    const normalizedOther = normalize(sibling.text);
    if (normalizedSelf === normalizedOther) {
      findings.push({
        revisionType: 'question',
        revisionId: body.questionId,
        kind: 'duplicate_exact',
        severity: 'blocking',
        label: 'Точний дублікат',
        detail: `Текст питання збігається з питанням «${sibling.questionId}».`,
      });
      return findings; // exact match already implies near-duplicate — one finding is enough
    }
    const similarity = jaccard(tokensSelf, tokenize(sibling.text));
    if (similarity >= NEAR_DUPLICATE_THRESHOLD) {
      findings.push({
        revisionType: 'question',
        revisionId: body.questionId,
        kind: 'duplicate_near',
        severity: 'warning',
        label: 'Можливий дублікат',
        detail: `Схожість ${Math.round(similarity * 100)}% з питанням «${sibling.questionId}».`,
      });
    }
  }
  return findings;
}

function duplicateOptionsCheck(body: QuestionBody): NewValidationFinding[] {
  const seen = new Map<string, string>();
  for (const option of body.options) {
    const key = normalize(option);
    if (!key) continue;
    if (seen.has(key)) {
      return [
        {
          revisionType: 'question',
          revisionId: body.questionId,
          kind: 'duplicate_options',
          severity: 'blocking',
          label: 'Варіанти відповіді повторюються',
          detail: `«${seen.get(key)}» і «${option}» — той самий варіант двічі.`,
        },
      ];
    }
    seen.set(key, option);
  }
  return [];
}

const MIN_LEAKAGE_LENGTH = 4;

function answerLeakageCheck(body: QuestionBody): NewValidationFinding[] {
  const correct = body.options[body.correctIndex];
  if (!correct) return [];
  const normalizedCorrect = normalize(correct);
  if (normalizedCorrect.length < MIN_LEAKAGE_LENGTH) return [];
  const normalizedQuestion = normalize(body.text);
  if (!normalizedQuestion.includes(normalizedCorrect)) return [];
  const otherOptionsAlsoMatch = body.options.some(
    (o, i) => i !== body.correctIndex && normalizedQuestion.includes(normalize(o)),
  );
  if (otherOptionsAlsoMatch) return [];
  return [
    {
      revisionType: 'question',
      revisionId: body.questionId,
      kind: 'answer_leakage',
      severity: 'warning',
      label: 'Відповідь підказана в тексті питання',
      detail: `Правильний варіант «${correct}» дослівно повторює частину тексту питання.`,
    },
  ];
}

function optionLengthImbalanceCheck(body: QuestionBody): NewValidationFinding[] {
  const others = body.options.filter((_, i) => i !== body.correctIndex);
  const correct = body.options[body.correctIndex];
  if (!correct || others.length === 0) return [];
  const avgOtherLength = others.reduce((sum, o) => sum + o.length, 0) / others.length;
  if (avgOtherLength === 0) return [];
  const ratio = correct.length / avgOtherLength;
  if (ratio >= 2 || ratio <= 0.5) {
    return [
      {
        revisionType: 'question',
        revisionId: body.questionId,
        kind: 'option_length_imbalance',
        severity: 'warning',
        label: 'Правильна відповідь виділяється довжиною',
        detail: `Довжина правильного варіанту (${correct.length}) істотно відрізняється від середньої довжини інших (${Math.round(avgOtherLength)}).`,
      },
    ];
  }
  return [];
}

const MIN_EXPLANATION_LENGTH = 15;

function explanationChecks(body: QuestionBody): NewValidationFinding[] {
  const findings: NewValidationFinding[] = [];
  const short = body.explanationShort?.trim() ?? '';
  if (short.length === 0) {
    findings.push({
      revisionType: 'question',
      revisionId: body.questionId,
      kind: 'missing_explanation',
      severity: 'warning',
      label: 'Пояснення відсутнє',
      detail: 'explanationShort порожнє.',
    });
  } else if (short.length < MIN_EXPLANATION_LENGTH) {
    findings.push({
      revisionType: 'question',
      revisionId: body.questionId,
      kind: 'weak_explanation',
      severity: 'warning',
      label: 'Пояснення занадто коротке',
      detail: `explanationShort має лише ${short.length} символів.`,
    });
  }
  if (!body.explanationDeep?.trim()) {
    findings.push({
      revisionType: 'question',
      revisionId: body.questionId,
      kind: 'missing_deep_explanation',
      severity: 'info',
      label: 'Розширене пояснення відсутнє',
      detail: 'explanationDeep не заповнено.',
    });
  }
  return findings;
}

/** Cyrillic letters that do not exist in the Ukrainian alphabet — a cheap, high-signal Russianism tell. */
const RUSSIAN_ONLY_LETTERS = /[ыъэёЫЪЭЁ]/;

/**
 * Frequent Russian words spelled only with letters Ukrainian also has, so the
 * letter check misses them ("Кто был первым…" passes on «кто» alone). Every
 * entry is a non-word in Ukrainian.
 */
const RUSSIAN_WORDS = new Set([
  'кто', 'что', 'которая', 'которое', 'которого', 'только', 'если', 'когда', 'почему', 'также',
  'можно', 'нужно', 'сказал', 'его', 'него', 'свой', 'своего', 'своих', 'всех', 'после', 'будет',
]);

function mixedLanguageCheck(body: QuestionBody): NewValidationFinding[] {
  const haystack = [body.text, ...body.options, body.explanationShort, body.explanationDeep]
    .filter((s): s is string => !!s)
    .join(' ');
  const letter = haystack.match(RUSSIAN_ONLY_LETTERS)?.[0];
  const word = letter ? undefined : normalize(haystack).split(' ').find((t) => RUSSIAN_WORDS.has(t));
  if (!letter && !word) return [];
  return [
    {
      revisionType: 'question',
      revisionId: body.questionId,
      kind: 'mixed_language',
      severity: 'blocking',
      label: 'Російська мова в тексті',
      detail: letter
        ? `Знайдено літеру «${letter}», відсутню в українському алфавіті.`
        : `Знайдено російське слово «${word}».`,
    },
  ];
}

/** "1 Цар."/"2 Цар." — 1–2 Samuel in Synodal numbering, 1–2 Kings in Ohienko. */
const AMBIGUOUS_KINGS = /^\s*([12])\s*цар(?=[\s.]|$)/i;

function referenceChecks(body: QuestionBody): NewValidationFinding[] {
  if (body.reference === undefined) return [];
  const finding = (kind: string, severity: NewValidationFinding['severity'], label: string, detail: string) => ({
    revisionType: 'question' as const,
    revisionId: body.questionId,
    kind,
    severity,
    label,
    detail,
  });

  const refs = expandReferenceStrings(body.reference);
  if (refs.length === 0) {
    return [finding('missing_reference', 'blocking', 'Немає посилання на Писання', 'Поле reference порожнє — факт неможливо перевірити.')];
  }

  const bookIds = new Set<number>();
  let ambiguous: string | null = null;
  for (const ref of refs) {
    const parsed = parseBibleReference(ref);
    if (parsed) bookIds.add(parsed.bookId);
    const kings = ref.match(AMBIGUOUS_KINGS);
    if (kings) {
      ambiguous = ref;
      bookIds.add(kings[1] === '1' ? 9 : 10);
    }
  }

  if (bookIds.size === 0) {
    return [finding('reference_unparsed', 'blocking', 'Посилання не розпізнано', `«${body.reference}» не є впізнаваним посиланням на книгу Біблії.`)];
  }

  const findings: NewValidationFinding[] = [];
  if (ambiguous) {
    findings.push(
      finding('reference_ambiguous', 'warning', 'Неоднозначне посилання', `«${ambiguous}» — 1–2 Самуїлова (синодальна нумерація) чи 1–2 Царів (Огієнко)? Запишіть повну назву книги.`),
    );
  }
  if (canonFit(body.themeId, [...bookIds]) === 'outside') {
    findings.push(
      finding('theme_canon_mismatch', 'warning', 'Посилання поза темою', `«${body.reference}» не належить до книг теми «${body.themeId}» — питання в чужій темі або вигадане.`),
    );
  }
  return findings;
}

function orphanThemeCheck(body: QuestionBody, knownThemeIds?: readonly string[]): NewValidationFinding[] {
  if (!knownThemeIds) return [];
  if (knownThemeIds.includes(body.themeId)) return [];
  return [
    {
      revisionType: 'question',
      revisionId: body.questionId,
      kind: 'orphan_theme',
      severity: 'blocking',
      label: 'Невідома тема',
      detail: `themeId «${body.themeId}» не знайдено серед відомих тем.`,
    },
  ];
}

/**
 * Theological-sensitivity categories (§6.5) — Ukrainian keyword scan. This is
 * a router to a human reviewer, not a classifier of "is this actually
 * sensitive": a broad match is the safe failure mode (spec §6.5 "sensitive
 * items require an appropriate reviewer and cannot be auto-approved"), a
 * missed match is not. Each matched category becomes its own `blocking`
 * finding so the review editor can show them as separate chips.
 */
const SENSITIVITY_CATEGORIES: Record<string, { label: string; keywords: string[] }> = {
  violence_trauma: {
    label: 'Насильство/травма',
    keywords: ['вбивств', 'різанин', 'геноцид', 'тортур', 'зґвалтув', 'насильств'],
  },
  sexuality_relationships: {
    label: 'Сексуальність/стосунки',
    keywords: ['перелюб', 'блуд', 'повія', 'наложниц', 'статев', 'похіт', 'хтив', 'розпуст', 'сьомої заповіді', 'сьома заповідь'],
  },
  end_times: {
    label: 'Есхатологія/кінець часів',
    keywords: ['апокаліпсис', 'антихрист', 'друге пришестя', 'тисячоліт', 'армагедон', 'есхатолог'],
  },
  divine_judgment: {
    label: 'Божий суд/покарання',
    keywords: ['суд божий', 'прокляття', 'гнів божий', 'пекло', 'содом і гомор'],
  },
  mental_health: {
    label: 'Психічне здоров’я/духовна опіка',
    keywords: ['депресі', 'самогубств', 'тривожн', 'психічн'],
  },
  denominational: {
    label: 'Міжконфесійна відмінність',
    keywords: ['католиц', 'православ', 'протестант', 'баптист', 'п’ятидесятник', 'мормон', 'єговіст'],
  },
  doctrinal: {
    label: 'Доктринальне тлумачення',
    keywords: ['доктрин', 'єресь', 'єретик', 'тринітар'],
  },
  historical_reconstruction: {
    label: 'Історична реконструкція',
    keywords: ['датування', 'археологічні докази', 'історична достовірність'],
  },
};

function theologicalSensitivityChecks(body: QuestionBody): NewValidationFinding[] {
  const haystack = normalize(
    [body.text, body.explanationShort, body.explanationDeep].filter((s): s is string => !!s).join(' '),
  );
  const findings: NewValidationFinding[] = [];
  for (const [kind, category] of Object.entries(SENSITIVITY_CATEGORIES)) {
    const matched = category.keywords.find((k) => haystack.includes(k));
    if (!matched) continue;
    findings.push({
      revisionType: 'question',
      revisionId: body.questionId,
      kind: `sensitivity_${kind}`,
      severity: 'blocking',
      label: category.label,
      detail: `Знайдено ключове слово «${matched}» — потребує рішення відповідного рецензента.`,
    });
  }
  return findings;
}

/** Run every deterministic + sensitivity check for one question body. */
export function runQuestionQualityChecks(
  body: QuestionBody,
  context: QualityCheckContext = { siblings: [] },
): NewValidationFinding[] {
  return [
    ...duplicateChecks(body, context.siblings),
    ...duplicateOptionsCheck(body),
    ...answerLeakageCheck(body),
    ...optionLengthImbalanceCheck(body),
    ...explanationChecks(body),
    ...mixedLanguageCheck(body),
    ...orphanThemeCheck(body, context.knownThemeIds),
    ...referenceChecks(body),
    ...theologicalSensitivityChecks(body),
  ];
}

export interface AnswerPositionBiasReport {
  sampleSize: number;
  /** Share of correct answers at each position (A, B, C, …). */
  shares: number[];
  /** Positions whose share strays more than `tolerance` from the uniform `1 / optionCount`. */
  skewedPositions: number[];
  /** A *batch*-level signal, never computed for a single question. */
  flagged: boolean;
}

/**
 * §6.2 answer-position bias is a property of a batch, not of any one question.
 * Every position is checked — the legacy bank's skew is at B (53.6%), which a
 * first-option-only check never sees.
 */
export function computeAnswerPositionBias(
  correctIndexes: readonly number[],
  optionCount = 4,
  tolerance = 0.1,
): AnswerPositionBiasReport {
  const sampleSize = correctIndexes.length;
  const counts = Array.from({ length: optionCount }, (_, p) => correctIndexes.filter((i) => i === p).length);
  const shares = counts.map((c) => (sampleSize === 0 ? 0 : c / sampleSize));
  const uniform = 1 / optionCount;
  const skewedPositions = sampleSize === 0 ? [] : shares.flatMap((s, p) => (Math.abs(s - uniform) > tolerance ? [p] : []));
  return { sampleSize, shares, skewedPositions, flagged: skewedPositions.length > 0 };
}
