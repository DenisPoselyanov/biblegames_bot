/**
 * Lesson-revision-body hashing (Phase 4 WS2, ADR-019 §2/§4) — the `lessons`/
 * `lesson_blocks` analogue of `content/contentHash.ts`'s `hashRevisionBody`,
 * on the same shared `stableHash` canonicalization.
 */
import { stableHash } from '../shared/stableHash';
import type { LessonRevisionBlock } from './types';

export interface LessonRevisionHashInput {
  planId: string;
  moduleId: string;
  objectiveId: string;
  title: string;
  description: string | null;
  blocks: LessonRevisionBlock[];
}

/** The hash that identifies a lesson revision's body. */
export function hashLessonRevisionBody(input: LessonRevisionHashInput): string {
  return stableHash({
    planId: input.planId,
    moduleId: input.moduleId,
    objectiveId: input.objectiveId,
    title: input.title.trim(),
    description: input.description?.trim() ?? null,
    blocks: input.blocks.map((b) => ({
      blockType: b.blockType,
      schemaVersion: b.schemaVersion,
      payload: b.payload,
    })),
  });
}
