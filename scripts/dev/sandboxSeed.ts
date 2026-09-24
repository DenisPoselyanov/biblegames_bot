/**
 * Fake data for `npm run studio:sandbox` — lets the quality-gate screens be
 * tried without a database or an AI provider. Heuristic "AI" verdicts are
 * derived from the deterministic findings of each golden-sample item and go
 * through the real `assessmentFromOutput` path, so they look and behave like
 * reviewer output (escalation, risk, trimmed suggestions). Never used outside
 * the sandbox.
 */
import {
  ALL_PASS,
  ASSESSMENT_RUBRIC_VERSION,
  assessmentRisk,
  impliedVerdict,
  type AssessmentCriteria,
} from '../../src/lib/contentAssessment';
import { LEVEL_RUBRIC } from '../../src/lib/contentLevelRubric';
import type { AiReviewOutput } from '../../server/domains/quality/aiReviewPrompt';
import { assessmentFromOutput } from '../../server/domains/quality/aiReview';
import type { AssessmentRepository } from '../../server/domains/quality/assessment';
import type { GoldenSample, GoldenSampleItem } from '../../server/domains/quality/goldenSample';

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const THEME_GUESS: Record<string, string> = {
  pentateuch: 'gospels',
  patriarchs: 'pentateuch',
  gospels: 'acts',
  prophets: 'kings',
  paul: 'acts',
  acts: 'paul',
  kings: 'prophets',
};

/** One heuristic reviewer output for a sample item. */
export function heuristicOutput(item: GoldenSampleItem): AiReviewOutput {
  const h = hash(item.subject.questionId);
  const criteria: AssessmentCriteria = { ...ALL_PASS };
  const f = new Set(item.findings);
  let confidence = 0.75 + (h % 20) / 100;
  let suggestedThemeId: string | null = null;
  let suggestedDifficulty: AiReviewOutput['suggestedDifficulty'] = null;
  let suggestedExplanationShort: string | null = null;
  let notes = '';

  if (f.has('theme_canon_mismatch')) {
    criteria.topic_fit = 'fail';
    suggestedThemeId = THEME_GUESS[item.subject.themeId] ?? 'old-testament';
    notes = 'Вірш і подія з іншої частини Біблії — питання не в своїй темі.';
    if (h % 3 === 0) {
      criteria.factual = 'fail';
      notes = 'Описаної події немає у вказаному вірші — схоже на вигадку.';
    }
  }
  if (f.has('reference_unparsed') || f.has('missing_reference')) {
    criteria.answer_supported = h % 2 === 0 ? 'fail' : 'unsure';
    confidence = Math.min(confidence, 0.55);
    notes ||= 'Посилання немає або не розпізнано — відповідь неможливо перевірити.';
  }
  if (f.has('reference_ambiguous')) {
    criteria.answer_supported = 'unsure';
    confidence = Math.min(confidence, 0.6);
    notes ||= '«Цар.» — незрозуміло, Самуїлова чи Царів.';
  }
  if (f.has('mixed_language')) {
    criteria.language = 'fail';
    notes ||= 'Росіянізми в тексті питання.';
  }
  if (f.has('explanation_length_for_level') || f.has('missing_deep_explanation') || h % 7 === 0) {
    criteria.explanation_fit = 'fail';
    suggestedExplanationShort = `${item.subject.explanationShort ?? 'Пояснення'} (${item.subject.reference ?? 'без посилання'}).`;
  }
  if (h % 11 === 0) {
    criteria.level_fit = 'fail';
    const i = LEVEL_RUBRIC.findIndex((r) => r.level === item.subject.difficulty);
    suggestedDifficulty = LEVEL_RUBRIC[Math.max(0, Math.min(LEVEL_RUBRIC.length - 1, i + (h % 2 ? 1 : -1)))].level;
  }
  // A lenient verdict now and then, so the fail-closed escalation shows up.
  return {
    criteria,
    verdict: h % 13 === 0 ? 'pass' : impliedVerdict(criteria),
    confidence,
    suggestedDifficulty,
    suggestedThemeId,
    suggestedExplanationShort,
    suggestedExplanationDeep: null,
    notes,
  };
}

export async function seedHeuristicAi(repo: AssessmentRepository, sample: GoldenSample): Promise<number> {
  for (const item of sample.items) {
    const a = assessmentFromOutput(item.subject, heuristicOutput(item), {
      assessor: 'sandbox:heuristic',
      extra: { provider: 'sandbox', model: 'heuristic', stratum: item.stratum },
    });
    await repo.addAi(a);
  }
  return sample.items.length;
}

/**
 * Fake owner labels for the first `count` sample items: the heuristic view,
 * with every fifth item judged harder (a reject the "AI" may miss), so the
 * calibration panel has disagreements to show.
 */
export async function seedHeuristicGolden(repo: AssessmentRepository, sample: GoldenSample, count: number): Promise<number> {
  const items = sample.items.slice(0, Math.max(0, count));
  for (const item of items) {
    const out = heuristicOutput(item);
    const criteria: AssessmentCriteria = { ...out.criteria };
    if (hash(`${item.subject.questionId}:owner`) % 5 === 0) criteria.answer_supported = 'fail';
    const verdict = impliedVerdict(criteria);
    await repo.upsertGolden({
      questionId: item.subject.questionId,
      contentHash: item.subject.contentHash,
      source: 'golden',
      assessor: 'guest',
      rubricVersion: ASSESSMENT_RUBRIC_VERSION,
      verdict,
      criteria,
      suggestedDifficulty: out.suggestedDifficulty ?? null,
      suggestedThemeId: out.suggestedThemeId ?? null,
      suggestedTopicNodeId: null,
      suggestedExplanationShort: null,
      suggestedExplanationDeep: null,
      notes: null,
      confidence: null,
      risk: assessmentRisk({ verdict, criteria, confidence: 1 }),
      subject: item.subject,
      meta: { stratum: item.stratum, sandbox: true },
    });
  }
  return items.length;
}
