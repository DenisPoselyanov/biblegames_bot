/**
 * Runs the deterministic question checks against a stored revision and records
 * the result (content quality gate). The WS6 publish gate reads what is
 * recorded here, so it must fail closed: a revision with no run marker for the
 * current checker version was never checked and is not publishable — an empty
 * finding set is not the same as a clean one.
 *
 * The run marker is an `info` finding of kind `validation_run` whose detail is
 * the checker version. `record()` replaces a revision's whole set, so the
 * marker always belongs to the latest run.
 */
import type { Transaction } from '../shared/context';
import type { NewValidationFinding, ValidationFinding } from '../shared/validationFindings';
import type { ValidationFindingRepository } from '../shared/validationFindingsRepository';
import { runQuestionQualityChecks, type QualityCheckContext } from './qualityChecks';
import type { QuestionRevisionRecord } from './types';

/** Bump whenever a check is added or tightened — older runs then count as "not validated". */
export const QUESTION_CHECKS_VERSION = 'question-checks@2';
export const VALIDATION_RUN_KIND = 'validation_run';

export const isValidationRunMarker = (f: Pick<ValidationFinding, 'kind'>): boolean => f.kind === VALIDATION_RUN_KIND;

export function isValidatedWith(findings: readonly ValidationFinding[], version = QUESTION_CHECKS_VERSION): boolean {
  return findings.some((f) => isValidationRunMarker(f) && f.detail === version);
}

export function questionRevisionFindings(
  revision: QuestionRevisionRecord,
  context: QualityCheckContext = { siblings: [] },
): NewValidationFinding[] {
  const checks = runQuestionQualityChecks(
    {
      questionId: revision.questionId,
      themeId: revision.themeId,
      text: revision.text,
      options: revision.options,
      correctIndex: revision.correctIndex,
      explanationShort: revision.explanationShort,
      explanationDeep: revision.explanationDeep,
      reference: revision.reference,
    },
    context,
  );
  return [
    ...checks.map((f) => ({ ...f, revisionId: revision.id })),
    {
      revisionType: 'question',
      revisionId: revision.id,
      kind: VALIDATION_RUN_KIND,
      severity: 'info',
      label: 'Перевірено',
      detail: QUESTION_CHECKS_VERSION,
    },
  ];
}

export interface RevisionValidationDeps {
  findings: ValidationFindingRepository;
  context?: QualityCheckContext;
}

export async function validateQuestionRevision(
  deps: RevisionValidationDeps,
  revision: QuestionRevisionRecord,
  tx?: Transaction,
): Promise<ValidationFinding[]> {
  return deps.findings.record('question', revision.id, questionRevisionFindings(revision, deps.context), tx);
}
