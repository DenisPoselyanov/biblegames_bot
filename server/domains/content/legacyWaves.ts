/**
 * Apply / roll back one §12.3 migration wave (Phase 4 WS10). Used by
 * `npm run ai -- migrate-wave`; kept here so it runs against real adapters in
 * tests. Every body lands as `legacy_unreviewed` — never published — and the
 * returned `createdQuestionIds` (questions that had no revision before this
 * run) are the exact rollback set, so a rollback never touches a question
 * that existed before the wave.
 */
import type { RevisionStatusCounts } from '../shared/revisionStatusFilter';
import type { ContentRepositories } from './repository';
import { validateQuestionRevision, type RevisionValidationDeps } from './revisionValidation';
import { validateQuestion, type RawQuestionInput } from './validation';

export interface WaveImportResult {
  before: RevisionStatusCounts;
  after: RevisionStatusCounts;
  created: number;
  unchanged: number;
  skippedInvalid: number;
  createdQuestionIds: string[];
}

/** With `checks`, every imported revision gets its quality findings recorded — without them the publish gate treats it as never checked. */
export async function importWave(
  repos: ContentRepositories,
  raws: readonly RawQuestionInput[],
  checks?: RevisionValidationDeps,
): Promise<WaveImportResult> {
  const before = await repos.revisions.countByStatus();
  const createdQuestionIds: string[] = [];
  let created = 0;
  let unchanged = 0;
  let skippedInvalid = 0;
  for (const raw of raws) {
    const validation = validateQuestion(raw);
    if (!validation.ok) {
      skippedInvalid += 1;
      continue;
    }
    const hadPrior = (await repos.revisions.listRevisions(validation.draft.questionId)).length > 0;
    const outcome = await repos.revisions.appendRevision({ ...validation.draft, status: 'legacy_unreviewed' });
    if (checks) await validateQuestionRevision(checks, outcome.revision);
    if (outcome.kind === 'created') {
      created += 1;
      if (!hadPrior) createdQuestionIds.push(validation.draft.questionId);
    } else {
      unchanged += 1;
    }
  }
  const after = await repos.revisions.countByStatus();
  return { before, after, created, unchanged, skippedInvalid, createdQuestionIds };
}

/** Quarantines (never deletes) every revision of the questions a wave created. */
export async function rollbackWave(
  repos: ContentRepositories,
  wave: number,
  createdQuestionIds: readonly string[],
): Promise<number> {
  let quarantined = 0;
  for (const questionId of createdQuestionIds) {
    quarantined += await repos.revisions.quarantine({ questionId, reason: `wave ${wave} rollback` });
  }
  return quarantined;
}
