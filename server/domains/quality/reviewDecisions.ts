/**
 * What a reviewer's decision on an AI assessment does to the bank (content
 * quality gate, layer 3). Pure: `apply-review-decisions` turns the plan into
 * file writes (`data/question-exclusions.json`, `data/question-overrides.json`)
 * and, for questions already imported as revisions, a quarantine or a
 * metadata-only draft revision. Nothing here publishes (§22).
 *
 * - accepted → what the AI suggested: reject = exclude from play; reclassify =
 *   suggested level/theme; repair = suggested explanations (a repair without
 *   suggested text is handled by an AI repair job, not by a patch).
 * - overridden → the reviewer's own patch.
 * - dismissed → nothing.
 */
import type { AssessmentPatch, QuestionAssessment } from './assessment';

export function acceptedPatch(a: QuestionAssessment): AssessmentPatch | null {
  switch (a.verdict) {
    case 'reject':
      return { exclude: true };
    case 'reclassify': {
      const patch: AssessmentPatch = {};
      if (a.suggestedDifficulty) patch.difficulty = a.suggestedDifficulty;
      if (a.suggestedThemeId) patch.themeId = a.suggestedThemeId;
      if (a.suggestedTopicNodeId) patch.topicNodeId = a.suggestedTopicNodeId;
      return Object.keys(patch).length ? patch : null;
    }
    case 'repair': {
      const patch: AssessmentPatch = {};
      if (a.suggestedExplanationShort) patch.explanationShort = a.suggestedExplanationShort;
      if (a.suggestedExplanationDeep) patch.explanationDeep = a.suggestedExplanationDeep;
      return Object.keys(patch).length ? patch : null;
    }
    default:
      return null;
  }
}

/** The change a decided assessment asks for, or `null` when it asks for none. */
export function effectivePatch(a: QuestionAssessment): AssessmentPatch | null {
  if (a.decision === 'accepted') return acceptedPatch(a);
  if (a.decision === 'overridden') {
    const p = a.decisionPatch;
    return p && Object.keys(p).length ? p : null;
  }
  return null;
}

/** The subset of a question the overrides file may change. */
export interface QuestionOverridePatch {
  difficulty?: AssessmentPatch['difficulty'];
  themeId?: string;
  topicNodeId?: string;
  explanationShort?: string;
  explanationDeep?: string;
}

export type ReviewSkipReason = 'stale' | 'not_in_bank';

export interface ReviewApplicationPlan {
  /** Question ids to take out of play. */
  exclude: string[];
  /** Question id → metadata/explanation patch. */
  overrides: Record<string, QuestionOverridePatch>;
  /** Assessment ids to mark applied (including decisions that change nothing). */
  applied: string[];
  /** Decided assessment ids whose change is written by this plan. */
  changed: string[];
  skipped: Array<{ id: string; questionId: string; reason: ReviewSkipReason }>;
}

/**
 * Turn decided, unapplied assessments into one plan. `currentHash` returns the
 * question's current body hash (`null` = not in the bank): a decision made on
 * an older body is skipped as stale — the question changed after the review.
 */
export function planReviewApplication(
  assessments: readonly QuestionAssessment[],
  currentHash: (questionId: string) => string | null,
): ReviewApplicationPlan {
  const plan: ReviewApplicationPlan = { exclude: [], overrides: {}, applied: [], changed: [], skipped: [] };
  for (const a of assessments) {
    if (!a.decision || a.decision === 'dismissed' || a.appliedAt) continue;
    const hash = currentHash(a.questionId);
    if (hash === null) {
      plan.skipped.push({ id: a.id, questionId: a.questionId, reason: 'not_in_bank' });
      continue;
    }
    if (hash !== a.contentHash) {
      plan.skipped.push({ id: a.id, questionId: a.questionId, reason: 'stale' });
      continue;
    }
    plan.applied.push(a.id);
    const patch = effectivePatch(a);
    if (!patch) continue;
    plan.changed.push(a.id);
    if (patch.exclude) {
      plan.exclude.push(a.questionId);
      continue;
    }
    const o: QuestionOverridePatch = { ...plan.overrides[a.questionId] };
    if (patch.difficulty) o.difficulty = patch.difficulty;
    if (patch.themeId) o.themeId = patch.themeId;
    if (patch.topicNodeId) o.topicNodeId = patch.topicNodeId;
    if (patch.explanationShort) o.explanationShort = patch.explanationShort;
    if (patch.explanationDeep) o.explanationDeep = patch.explanationDeep;
    if (Object.keys(o).length) plan.overrides[a.questionId] = o;
  }
  plan.exclude = [...new Set(plan.exclude)].sort();
  for (const id of plan.exclude) delete plan.overrides[id];
  return plan;
}
