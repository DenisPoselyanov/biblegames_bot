/**
 * Question assessment vocabulary (content quality gate, layers 2–3), shared by
 * the owner's golden labels, the AI reviewer and the Studio screens — both
 * speak exactly the same criteria, so an AI verdict can be scored against a
 * human label criterion by criterion (calibration).
 */
import type { Difficulty } from '../types';

/** Bump when the criteria or their meaning change: older AI assessments then count as stale. */
export const ASSESSMENT_RUBRIC_VERSION = 'assessment@1';

export const ASSESSMENT_CRITERIA = [
  'answer_supported',
  'single_correct',
  'factual',
  'distractors',
  'topic_fit',
  'level_fit',
  'explanation_fit',
  'language',
] as const;
export type AssessmentCriterion = (typeof ASSESSMENT_CRITERIA)[number];

export const CRITERION_VALUES = ['pass', 'fail', 'unsure'] as const;
export type CriterionValue = (typeof CRITERION_VALUES)[number];

export const CRITERION_LABELS: Record<AssessmentCriterion, { label: string; question: string }> = {
  answer_supported: {
    label: 'Відповідь підтверджена',
    question: 'Вказаний вірш підтверджує позначену правильну відповідь?',
  },
  single_correct: {
    label: 'Одна правильна',
    question: 'Правильний рівно один варіант (інші однозначно хибні за текстом)?',
  },
  factual: {
    label: 'Без вигадок',
    question: 'Питання й пояснення не містять вигаданих подій, імен чи віршів?',
  },
  distractors: {
    label: 'Варіанти правдоподібні',
    question: 'Неправильні варіанти правдоподібні, а відповідь не підказана?',
  },
  topic_fit: {
    label: 'Своя тема',
    question: 'Питання належить до своєї теми (чи законне перехресне посилання)?',
  },
  level_fit: {
    label: 'Складність = рівень',
    question: 'Складність питання відповідає його рівню?',
  },
  explanation_fit: {
    label: 'Пояснення під рівень',
    question: 'Пояснення правильне і має глибину, потрібну для цього рівня?',
  },
  language: {
    label: 'Мова',
    question: 'Грамотна українська без росіянізмів, імена за Огієнком?',
  },
};

/**
 * What should happen to the question.
 * - `pass` — fine as is → normal human review.
 * - `reclassify` — body is fine, metadata is not (level/topic) → metadata-only change.
 * - `repair` — fixable (explanation, wording, reference, distractors) → AI repair suggestion.
 * - `reject` — wrong at the core (hallucination, wrong key, unfixable) → excluded from play.
 */
export const ASSESSMENT_VERDICTS = ['pass', 'reclassify', 'repair', 'reject'] as const;
export type AssessmentVerdict = (typeof ASSESSMENT_VERDICTS)[number];

export const VERDICT_LABELS: Record<AssessmentVerdict, string> = {
  pass: 'Добре',
  reclassify: 'Змінити рівень/тему',
  repair: 'Виправити',
  reject: 'Відхилити',
};

export type AssessmentCriteria = Record<AssessmentCriterion, CriterionValue>;

/** A reviewer's decision on an AI assessment in the Studio queue. */
export const ASSESSMENT_DECISIONS = ['accepted', 'overridden', 'dismissed'] as const;
export type AssessmentDecision = (typeof ASSESSMENT_DECISIONS)[number];

/** The question body an assessment was made against — a snapshot, bound by `contentHash`. */
export interface AssessmentSubject {
  questionId: string;
  contentHash: string;
  themeId: string;
  difficulty: Difficulty;
  topicNodeId: string | null;
  text: string;
  options: string[];
  correctIndex: number;
  explanationShort: string | null;
  explanationDeep: string | null;
  reference: string | null;
}

const VERDICT_WEIGHT: Record<AssessmentVerdict, number> = { reject: 100, repair: 60, reclassify: 35, pass: 0 };
const CRITERION_WEIGHT: Record<AssessmentCriterion, number> = {
  answer_supported: 12,
  single_correct: 12,
  factual: 12,
  distractors: 4,
  topic_fit: 5,
  level_fit: 3,
  explanation_fit: 3,
  language: 4,
};

/**
 * Review priority 0–200 (higher = look first): the verdict, the failed
 * criteria, and — for anything not already a confident `pass` — how unsure the
 * reviewer was. Player signals are added on read (`signalBoost`), because they
 * keep arriving after the assessment was written.
 */
export function assessmentRisk(input: {
  verdict: AssessmentVerdict;
  criteria: Partial<AssessmentCriteria>;
  confidence: number | null;
}): number {
  let risk = VERDICT_WEIGHT[input.verdict];
  for (const c of ASSESSMENT_CRITERIA) {
    const v = input.criteria[c];
    if (v === 'fail') risk += CRITERION_WEIGHT[c];
    else if (v === 'unsure') risk += Math.ceil(CRITERION_WEIGHT[c] / 3);
  }
  const confidence = input.confidence ?? 0.5;
  if (input.verdict === 'pass') risk += Math.round((1 - confidence) * 20);
  return Math.max(0, Math.min(200, Math.round(risk)));
}

/** Layer 4 — what players tell us, on top of the AI risk. */
export function signalBoost(signals: {
  openReports?: number;
  wrongAnswerReports?: number;
  accuracyBand?: 'too_hard' | 'too_easy' | 'ok' | null;
}): number {
  let boost = 0;
  boost += Math.min(40, (signals.openReports ?? 0) * 10);
  boost += Math.min(30, (signals.wrongAnswerReports ?? 0) * 15);
  if (signals.accuracyBand === 'too_hard') boost += 25;
  if (signals.accuracyBand === 'too_easy') boost += 10;
  return boost;
}
