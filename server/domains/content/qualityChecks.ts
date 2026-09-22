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
import type { NewValidationFinding } from '../shared/validationFindings';

/** The subset of a draft/revision every check needs — both `RevisionDraft` and `QuestionRevisionRecord` satisfy this structurally. */
export interface QuestionBody {
  questionId: string;
  themeId: string;
  text: string;
  options: string[];
  correctIndex: number;
  explanationShort?: string | null;
  explanationDeep?: string | null;
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
const RUSSIAN_ONLY_LETTERS = /[ыъэЫЪЭ]/;

function mixedLanguageCheck(body: QuestionBody): NewValidationFinding[] {
  const haystack = [body.text, ...body.options, body.explanationShort, body.explanationDeep]
    .filter((s): s is string => !!s)
    .join(' ');
  const match = haystack.match(RUSSIAN_ONLY_LETTERS);
  if (!match) return [];
  return [
    {
      revisionType: 'question',
      revisionId: body.questionId,
      kind: 'mixed_language',
      severity: 'warning',
      label: 'Можливий росіянізм',
      detail: `Знайдено літеру «${match[0]}», відсутню в українському алфавіті.`,
    },
  ];
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
    keywords: ['перелюб', 'блуд', 'повія', 'наложниц', 'статев'],
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
    ...theologicalSensitivityChecks(body),
  ];
}

export interface FirstOptionBiasReport {
  sampleSize: number;
  firstOptionCount: number;
  firstOptionRatio: number;
  /** Flagged when the ratio clears `threshold` — a *batch*-level signal, never computed for a single question. */
  flagged: boolean;
}

/**
 * §6.2 "first-option bias distribution" is a property of a batch, not of any
 * one question — reporting it per-draft would be a fabricated metric. Callers
 * (a generation-batch review, WS9's dashboard) pass every `correctIndex` in
 * the set being judged.
 */
export function computeFirstOptionBias(
  correctIndexes: readonly number[],
  threshold = 0.4,
): FirstOptionBiasReport {
  const sampleSize = correctIndexes.length;
  const firstOptionCount = correctIndexes.filter((i) => i === 0).length;
  const firstOptionRatio = sampleSize === 0 ? 0 : firstOptionCount / sampleSize;
  return {
    sampleSize,
    firstOptionCount,
    firstOptionRatio,
    flagged: sampleSize > 0 && firstOptionRatio >= threshold,
  };
}
