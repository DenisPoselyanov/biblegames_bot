/**
 * Legacy content ingestion (Phase 2 §14, §18.3).
 *
 * "Import existing question files as revisions with status `legacy_unreviewed`,
 * not automatically `published_reviewed`." §14: an invalid `correctIndex` is
 * rejected/quarantined and the first-option fallback disappears. Here:
 *
 * - a body that is only untrustworthy on the answer key (`correctIndex` missing
 *   or out of range) but otherwise well-formed is imported with `correctIndex`
 *   clamped to 0 and immediately quarantined — a reviewer gets a row + a reason;
 * - a body that is structurally broken (no text, <2 options, unknown difficulty)
 *   is rejected outright and reported, nothing is written.
 *
 * A domain service: takes a `ContentRepositories` and plain inputs, never touches
 * a file or a `pg` handle. The CLI wrapper is
 * `scripts/content/import-legacy-questions.ts`.
 */
import type { ContentRepositories } from './repository';
import type { RawQuestionInput, ValidationIssue } from './validation';
import { validateQuestion } from './validation';

export interface ImportReport {
  total: number;
  created: number;
  unchanged: number;
  quarantined: number;
  rejected: Array<{ id: string; issues: ValidationIssue[] }>;
}

const ANSWER_KEY_ISSUES: ReadonlySet<ValidationIssue> = new Set([
  'missing_correct_index',
  'correct_index_out_of_range',
]);

export async function importLegacyQuestions(
  repos: ContentRepositories,
  rawQuestions: RawQuestionInput[],
): Promise<ImportReport> {
  const report: ImportReport = {
    total: rawQuestions.length,
    created: 0,
    unchanged: 0,
    quarantined: 0,
    rejected: [],
  };

  for (const raw of rawQuestions) {
    const result = validateQuestion(raw);

    if (result.ok) {
      const outcome = await repos.revisions.appendRevision(result.draft);
      if (outcome.kind === 'created') report.created += 1;
      else report.unchanged += 1;
      continue;
    }

    // Only the answer key is wrong → keep the body, quarantine it for review.
    const onlyAnswerKey = result.issues.every((i) => ANSWER_KEY_ISSUES.has(i));
    if (onlyAnswerKey) {
      const salvage = validateQuestion({ ...raw, correctIndex: 0, correct: undefined });
      if (salvage.ok) {
        await repos.revisions.appendRevision(salvage.draft);
        await repos.revisions.quarantine({
          questionId: raw.id,
          reason: `import: ${result.issues.join(', ')}`,
        });
        report.quarantined += 1;
        continue;
      }
    }

    report.rejected.push({ id: raw.id, issues: result.issues });
  }

  return report;
}
