/**
 * Field-level diff between two lesson revisions (Phase 4 WS2, ADR-019 §4) —
 * the data WS8's review editor renders side-by-side. Excludes identity and
 * lifecycle bookkeeping (`id`, `revisionNumber`, `status`, `contentHash`,
 * `source`, `createdAt`, `createdBy`, `supersededAt`, `quarantineReason`).
 */
import { diffFields, type RevisionDiff } from '../shared/revisionDiff';
import type { LessonRevisionRecord } from './types';

const LESSON_DIFF_FIELDS = [
  'planId',
  'moduleId',
  'objectiveId',
  'title',
  'description',
  'blocks',
] as const satisfies readonly (keyof LessonRevisionRecord)[];

export function diffLessonRevisions(
  before: LessonRevisionRecord | null,
  after: LessonRevisionRecord,
): RevisionDiff {
  return diffFields(before, after, LESSON_DIFF_FIELDS);
}
