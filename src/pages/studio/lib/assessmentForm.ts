/** Non-component helpers for the quality-gate form (kept out of the .tsx for fast refresh). */
import { ALL_PASS, type AssessmentCriteria, type AssessmentVerdict } from '../../../lib/contentAssessment';
import type { AssessmentLabelInput, AssessmentLabelView } from '../../../repos/studioRepo';

export const VERDICT_TONE: Record<AssessmentVerdict, 'success' | 'info' | 'gold' | 'danger'> = {
  pass: 'success',
  reclassify: 'info',
  repair: 'gold',
  reject: 'danger',
};

export interface AssessmentFormValue extends AssessmentLabelInput {
  criteria: AssessmentCriteria;
}

export function emptyForm(): AssessmentFormValue {
  return {
    verdict: 'pass',
    criteria: { ...ALL_PASS },
    suggestedDifficulty: null,
    suggestedExplanationShort: null,
    suggestedExplanationDeep: null,
    notes: null,
  };
}

/** A saved label (or AI verdict) as the starting point of the form. */
export function formFromLabel(label: Omit<AssessmentLabelView, 'id' | 'assessor' | 'stale' | 'updatedAt'> | null): AssessmentFormValue {
  if (!label) return emptyForm();
  return {
    verdict: label.verdict,
    criteria: { ...label.criteria },
    suggestedDifficulty: label.suggestedDifficulty,
    suggestedExplanationShort: label.suggestedExplanationShort,
    suggestedExplanationDeep: label.suggestedExplanationDeep,
    notes: label.notes,
  };
}
