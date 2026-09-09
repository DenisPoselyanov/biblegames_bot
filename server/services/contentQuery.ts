/**
 * Read side of the canonical content repository (Phase 2 §14).
 *
 * The consumers (`server/services/questionService.ts` → Quiz / Kahoot / lesson
 * practice) still speak the legacy `Question` shape and own the pool-building and
 * picking logic. This service only swaps the *source of the rows*: published
 * `question_revisions` instead of the legacy `questions` table. Everything
 * downstream is unchanged.
 */
import type { Question } from '../../src/types/index';
import type { ContentRepositories } from '../domains/content/repository';
import type { PublishedFilter, QuestionRevisionRecord } from '../domains/content/types';

export function revisionToLegacyQuestion(rev: QuestionRevisionRecord): Question {
  return {
    id: rev.questionId,
    themeId: rev.themeId,
    difficulty: rev.difficulty,
    text: rev.text,
    options: rev.options,
    correctIndex: rev.correctIndex,
    reference: rev.reference ?? undefined,
    explanationShort: rev.explanationShort ?? undefined,
    explanationDeep: rev.explanationDeep ?? undefined,
    topicNodeId: rev.topicNodeId ?? undefined,
    topicPath: rev.topicPath ?? undefined,
    tags: rev.tags.length ? rev.tags : undefined,
    createdAt: rev.createdAt,
  };
}

export interface ContentQueryService {
  /** Published questions for a filter, mapped to the legacy shape. */
  listPublished(filter: PublishedFilter): Promise<Question[]>;
  /** Published questions for explicit ids, in the requested order. */
  getPublishedByIds(ids: string[]): Promise<Question[]>;
}

export function createContentQueryService(repos: ContentRepositories): ContentQueryService {
  return {
    async listPublished(filter) {
      const rows = await repos.revisions.listPublished(filter);
      return rows.map(revisionToLegacyQuestion);
    },
    async getPublishedByIds(ids) {
      if (ids.length === 0) return [];
      const rows = await repos.revisions.listPublished({ questionIds: ids, limit: ids.length });
      const byId = new Map(rows.map((r) => [r.questionId, revisionToLegacyQuestion(r)]));
      return ids.map((id) => byId.get(id)).filter((q): q is Question => q != null);
    },
  };
}
