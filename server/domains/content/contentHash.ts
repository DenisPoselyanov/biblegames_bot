/**
 * Question-revision-body hashing (Phase 2 §14 — "a published content set has
 * a stable version/hash"). It deliberately excludes identity and lifecycle
 * fields (`id`, `status`, `createdAt`, …). `stableHash` itself now lives in
 * `server/domains/shared/stableHash.ts` (Phase 4 WS2, ADR-019 §4) — shared
 * with `learning`'s lesson-revision hashing — and is re-exported here for
 * existing callers.
 */
import type { ScriptureRef } from './types';
import { stableHash } from '../shared/stableHash';

export { stableHash };

export interface RevisionHashInput {
  themeId: string;
  difficulty: string;
  topicNodeId: string | null;
  text: string;
  options: string[];
  correctIndex: number;
  explanationShort: string | null;
  explanationDeep: string | null;
  reference: string | null;
  scriptureRefs: ScriptureRef[];
  tags: string[];
}

/** The hash that identifies a question revision's body. */
export function hashRevisionBody(input: RevisionHashInput): string {
  return stableHash({
    themeId: input.themeId,
    difficulty: input.difficulty,
    topicNodeId: input.topicNodeId,
    text: input.text.trim(),
    options: input.options.map((o) => o.trim()),
    correctIndex: input.correctIndex,
    explanationShort: input.explanationShort?.trim() ?? null,
    explanationDeep: input.explanationDeep?.trim() ?? null,
    reference: input.reference?.trim() ?? null,
    scriptureRefs: [...input.scriptureRefs]
      .map((r) => ({
        book: r.book,
        chapter: r.chapter,
        verseStart: r.verseStart,
        verseEnd: r.verseEnd ?? null,
        translation: r.translation ?? null,
      }))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    tags: [...input.tags].map((t) => t.trim()).sort(),
  });
}

/** The hash that identifies a frozen content-set version — its ordered revision ids. */
export function hashContentSet(revisionIds: string[]): string {
  return stableHash({ revisionIds });
}
