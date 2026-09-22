/**
 * Field-level diff between two question revisions (Phase 4 WS2, ADR-019 §4)
 * — the data WS8's review editor renders side-by-side. Excludes identity and
 * lifecycle bookkeeping (`id`, `revisionNumber`, `status`, `contentHash`,
 * `source`, `createdAt`, `createdBy`, `supersededAt`, `quarantineReason`).
 */
import { diffFields, type RevisionDiff } from '../shared/revisionDiff';
import type { QuestionRevisionRecord } from './types';

const QUESTION_DIFF_FIELDS = [
  'themeId',
  'difficulty',
  'topicNodeId',
  'topicPath',
  'text',
  'options',
  'correctIndex',
  'explanationShort',
  'explanationDeep',
  'reference',
  'scriptureRefs',
  'tags',
] as const satisfies readonly (keyof QuestionRevisionRecord)[];

export function diffQuestionRevisions(
  before: QuestionRevisionRecord | null,
  after: QuestionRevisionRecord,
): RevisionDiff {
  return diffFields(before, after, QUESTION_DIFF_FIELDS);
}
