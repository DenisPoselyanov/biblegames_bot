/**
 * Stable content hashing (Phase 2 §14 — "a published content set has a stable
 * version/hash"). Domain-owned, dependency-free (`node:crypto` only).
 *
 * The hash is over a canonical JSON form with sorted object keys, so two
 * revisions with the same body but different field order / whitespace collide —
 * that is what makes it a dedup key. It deliberately excludes identity and
 * lifecycle fields (`id`, `status`, `createdAt`, …).
 */
import { createHash } from 'node:crypto';
import type { ScriptureRef } from './types';

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, canonicalize(v)]),
    );
  }
  return value;
}

/** sha-256 hex of the canonical JSON of `value`. */
export function stableHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

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
