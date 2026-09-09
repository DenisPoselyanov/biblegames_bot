/**
 * Static content snapshots (Phase 2 §14).
 *
 * "Static snapshots can be generated for offline/dev but are OUTPUTS, not
 * competing sources." A snapshot is a frozen projection of the currently
 * published revisions: a `PublishedContentSet` header (stable `contentHash`)
 * plus the `PublishedQuestion` read projections. It is never read back as a
 * repository — regenerate it from the canonical store instead.
 */
import type { PublishedContentSet, PublishedQuestion } from '../../../contracts/index';
import { hashContentSet } from './contentHash';
import type { ContentSetFilter, QuestionRevisionRecord } from './types';

export interface ContentSnapshot {
  set: PublishedContentSet;
  questions: PublishedQuestion[];
  generatedAt: string;
}

export function toPublishedQuestion(rev: QuestionRevisionRecord): PublishedQuestion {
  return {
    id: rev.questionId,
    revisionId: rev.id,
    revisionNumber: rev.revisionNumber,
    themeId: rev.themeId,
    difficulty: rev.difficulty,
    topicNodeId: rev.topicNodeId,
    topicPath: rev.topicPath,
    text: rev.text,
    options: rev.options,
    correctIndex: rev.correctIndex,
    explanationShort: rev.explanationShort,
    explanationDeep: rev.explanationDeep,
    reference: rev.reference,
    scriptureRefs: rev.scriptureRefs,
    tags: rev.tags,
  };
}

export function buildSnapshot(
  setId: string,
  filter: ContentSetFilter,
  publishedRevisions: QuestionRevisionRecord[],
  now: () => Date = () => new Date(),
): ContentSnapshot {
  const ordered = [...publishedRevisions].sort((a, b) =>
    a.questionId < b.questionId ? -1 : a.questionId > b.questionId ? 1 : 0,
  );
  const generatedAt = now().toISOString();
  return {
    set: {
      setId,
      kind: 'snapshot',
      version: 1,
      contentHash: hashContentSet(ordered.map((r) => r.id)),
      filter,
      questionCount: ordered.length,
      questionIds: ordered.map((r) => r.questionId),
      publishedAt: generatedAt,
    },
    questions: ordered.map(toPublishedQuestion),
    generatedAt,
  };
}
