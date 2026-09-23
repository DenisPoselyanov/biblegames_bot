/**
 * Builds the `AssessmentSubject` snapshot an assessment is made against, with
 * the same content hash `RevisionRepository.appendRevision` would compute for
 * that body — so a verdict on a legacy file item still matches the revision
 * once the item is imported (and goes stale if the body changes).
 */
import type { AssessmentSubject } from '../../../src/lib/contentAssessment';
import { hashRevisionBody } from '../content/contentHash';
import type { QuestionRevisionRecord, RevisionDraft } from '../content/types';

export function subjectFromDraft(draft: RevisionDraft): AssessmentSubject {
  const contentHash = hashRevisionBody({
    themeId: draft.themeId,
    difficulty: draft.difficulty,
    topicNodeId: draft.topicNodeId ?? null,
    text: draft.text,
    options: draft.options,
    correctIndex: draft.correctIndex,
    explanationShort: draft.explanationShort ?? null,
    explanationDeep: draft.explanationDeep ?? null,
    reference: draft.reference ?? null,
    scriptureRefs: draft.scriptureRefs ?? [],
    tags: draft.tags ?? [],
  });
  return {
    questionId: draft.questionId,
    contentHash,
    themeId: draft.themeId,
    difficulty: draft.difficulty,
    topicNodeId: draft.topicNodeId ?? null,
    text: draft.text,
    options: [...draft.options],
    correctIndex: draft.correctIndex,
    explanationShort: draft.explanationShort ?? null,
    explanationDeep: draft.explanationDeep ?? null,
    reference: draft.reference ?? null,
  };
}

export function subjectFromRevision(revision: QuestionRevisionRecord): AssessmentSubject {
  return {
    questionId: revision.questionId,
    contentHash: revision.contentHash,
    themeId: revision.themeId,
    difficulty: revision.difficulty,
    topicNodeId: revision.topicNodeId,
    text: revision.text,
    options: [...revision.options],
    correctIndex: revision.correctIndex,
    explanationShort: revision.explanationShort,
    explanationDeep: revision.explanationDeep,
    reference: revision.reference,
  };
}
