/**
 * Migration waves respect the AI reviewer (content quality gate, WS11c step 7).
 * A legacy question enters the revision store only with a current AI
 * assessment of exactly that body, and never when the AI rejected it — unless
 * a reviewer dismissed the rejection or overrode it without excluding.
 *
 * "Current" = the newest AI assessment of the same content hash made with the
 * current rubric; anything older judged a different question or other rules.
 */
import { ASSESSMENT_RUBRIC_VERSION, type AssessmentVerdict } from '../../../src/lib/contentAssessment';
import type { QuestionAssessment } from './assessment';

export interface WaveGateItem {
  questionId: string;
  contentHash: string;
}

export interface WaveGateResult {
  /** Question ids allowed into the wave. */
  admit: string[];
  /** Rejected by the AI and not overturned by a reviewer — never imported. */
  rejected: string[];
  /** No current AI assessment — imported only with `--allow-unreviewed`. */
  unreviewed: string[];
  /** Question id → the verdict that let it in (recorded in the wave report). */
  verdicts: Record<string, AssessmentVerdict>;
  byVerdict: Partial<Record<AssessmentVerdict, number>>;
}

/** A reviewer can overturn a reject: dismiss it, or override it with a patch that keeps the question. */
export function isEffectiveReject(a: QuestionAssessment): boolean {
  if (a.verdict !== 'reject') return false;
  if (a.decision === 'dismissed') return false;
  if (a.decision === 'overridden') return Boolean(a.decisionPatch?.exclude);
  return true;
}

export function gateWave(
  items: readonly WaveGateItem[],
  latestAi: readonly QuestionAssessment[],
  options: { allowUnreviewed?: boolean; rubricVersion?: string } = {},
): WaveGateResult {
  const rubric = options.rubricVersion ?? ASSESSMENT_RUBRIC_VERSION;
  const byQuestion = new Map(latestAi.map((a) => [a.questionId, a]));
  const result: WaveGateResult = { admit: [], rejected: [], unreviewed: [], verdicts: {}, byVerdict: {} };
  for (const item of items) {
    const a = byQuestion.get(item.questionId);
    const current = a && a.contentHash === item.contentHash && a.rubricVersion === rubric ? a : null;
    if (!current) {
      result.unreviewed.push(item.questionId);
      if (options.allowUnreviewed) result.admit.push(item.questionId);
      continue;
    }
    result.byVerdict[current.verdict] = (result.byVerdict[current.verdict] ?? 0) + 1;
    if (isEffectiveReject(current)) {
      result.rejected.push(item.questionId);
      continue;
    }
    result.admit.push(item.questionId);
    result.verdicts[item.questionId] = current.verdict;
  }
  return result;
}
