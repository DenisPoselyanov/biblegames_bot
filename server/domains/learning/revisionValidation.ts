/**
 * Runs the structural lesson checks against a stored lesson revision and
 * records the result — the lesson peer of `content/revisionValidation.ts`.
 *
 * The publish gate fails closed for lessons too: a revision without a run
 * marker for the current checker version was never checked and is not
 * publishable. Before this, nothing in production code recorded lesson
 * findings, so "no findings" passed as clean.
 */
import { VALIDATION_RUN_KIND } from '../content/revisionValidation';
import type { Transaction } from '../shared/context';
import type { NewValidationFinding, ValidationFinding } from '../shared/validationFindings';
import type { ValidationFindingRepository } from '../shared/validationFindingsRepository';
import { runLessonQualityChecks, type LessonQualityCheckContext } from './qualityChecks';
import type { LessonRevisionRecord } from './types';

/** Bump whenever a lesson check is added or tightened — older runs then count as "not validated". */
export const LESSON_CHECKS_VERSION = 'lesson-checks@1';

export function lessonRevisionFindings(
  revision: LessonRevisionRecord,
  context: LessonQualityCheckContext = {},
): NewValidationFinding[] {
  const checks = runLessonQualityChecks(
    { lessonId: revision.lessonId, objectiveId: revision.objectiveId, title: revision.title, blocks: revision.blocks },
    context,
  );
  return [
    // The checks name the lesson; findings belong to this revision.
    ...checks.map((f) => ({ ...f, revisionId: revision.id })),
    {
      revisionType: 'lesson',
      revisionId: revision.id,
      kind: VALIDATION_RUN_KIND,
      severity: 'info',
      label: 'Перевірено',
      detail: LESSON_CHECKS_VERSION,
    },
  ];
}

export interface LessonValidationDeps {
  findings: ValidationFindingRepository;
  context?: LessonQualityCheckContext;
}

export async function validateLessonRevision(
  deps: LessonValidationDeps,
  revision: LessonRevisionRecord,
  tx?: Transaction,
): Promise<ValidationFinding[]> {
  return deps.findings.record('lesson', revision.id, lessonRevisionFindings(revision, deps.context), tx);
}
