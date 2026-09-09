import { z } from 'zod';
import { contentStatusSchema, difficultySchema } from '../enums/index';
import { entityId, isoTimestamp } from './primitives';

/**
 * Canonical content read contract (Phase 2 §14).
 *
 * One published question set has a stable `version` + `contentHash`. Consumers
 * (Quiz, Kahoot, lesson practice) request a *filtered published subset*; they
 * never receive the whole bank and never read a draft/quarantined revision.
 * The full authoring/quality workflow is Phase 4 — WS3 only establishes the
 * repository and revision structure.
 */

/** A Scripture citation attached to a question revision (§5.5). */
export const scriptureReference = z
  .object({
    /** Canonical book id, e.g. `John`, `1Cor` — vocabulary owned by the content domain. */
    book: z.string().trim().min(1).max(32),
    chapter: z.number().int().min(1).max(200),
    verseStart: z.number().int().min(1).max(200),
    verseEnd: z.number().int().min(1).max(200).nullable().default(null),
    /** Translation code the citation was authored against (`ubio`, `kjv`, …). */
    translation: z.string().trim().min(1).max(16).nullable().default(null),
  })
  .strict();
export type ScriptureReference = z.infer<typeof scriptureReference>;

/** Immutable stored question revision (§14 "revisions", §18.3). */
export const questionRevision = z
  .object({
    id: entityId,
    questionId: entityId,
    /** Monotonic per `questionId`. */
    revisionNumber: z.number().int().min(1),
    status: contentStatusSchema,
    themeId: entityId,
    difficulty: difficultySchema,
    topicNodeId: entityId.nullable().default(null),
    topicPath: z.string().max(512).nullable().default(null),
    text: z.string().trim().min(1).max(2_000),
    options: z.array(z.string().trim().min(1).max(500)).min(2).max(10),
    /** Validated against `options.length` at ingestion — no first-option fallback (§14). */
    correctIndex: z.number().int().min(0).max(9),
    explanationShort: z.string().max(2_000).nullable().default(null),
    explanationDeep: z.string().max(8_000).nullable().default(null),
    reference: z.string().max(200).nullable().default(null),
    scriptureRefs: z.array(scriptureReference).max(20).default([]),
    tags: z.array(z.string().max(64)).max(50).default([]),
    /** Stable hash of the normalized revision body (dedup + version identity). */
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    source: z.string().max(64).default('legacy'),
    createdAt: isoTimestamp,
    createdBy: z.string().max(128).nullable().default(null),
    supersededAt: isoTimestamp.nullable().default(null),
  })
  .strict()
  .superRefine((rev, ctx) => {
    if (rev.correctIndex >= rev.options.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['correctIndex'],
        message: `correctIndex ${rev.correctIndex} is out of range for ${rev.options.length} options`,
      });
    }
  });
export type QuestionRevision = z.infer<typeof questionRevision>;

/**
 * The read projection a game/practice consumer gets for one question — a slice of
 * the currently published revision. A database row is never returned directly (§25).
 */
export const publishedQuestion = z
  .object({
    id: entityId,
    revisionId: entityId,
    revisionNumber: z.number().int().min(1),
    themeId: entityId,
    difficulty: difficultySchema,
    topicNodeId: entityId.nullable(),
    topicPath: z.string().max(512).nullable(),
    text: z.string().min(1),
    options: z.array(z.string()).min(2),
    correctIndex: z.number().int().min(0),
    explanationShort: z.string().nullable(),
    explanationDeep: z.string().nullable(),
    reference: z.string().nullable(),
    scriptureRefs: z.array(scriptureReference),
    tags: z.array(z.string()),
  })
  .strict();
export type PublishedQuestion = z.infer<typeof publishedQuestion>;

/** How a consumer scopes a published subset request (§12.3, §14). */
export const contentSetFilter = z
  .object({
    themeIds: z.array(entityId).max(100).default([]),
    difficulty: difficultySchema.nullable().default(null),
    topicNodeId: entityId.nullable().default(null),
    questionIds: z.array(entityId).max(500).default([]),
  })
  .strict();
export type ContentSetFilter = z.infer<typeof contentSetFilter>;

/**
 * A frozen, versioned published set. Regenerating with the same published
 * revisions yields the same `contentHash`; any revision change bumps `version`.
 */
export const publishedContentSet = z
  .object({
    setId: entityId,
    kind: z.enum(['quiz', 'kahoot', 'practice', 'lesson', 'snapshot']),
    version: z.number().int().min(1),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    filter: contentSetFilter,
    questionCount: z.number().int().min(0),
    questionIds: z.array(entityId),
    publishedAt: isoTimestamp,
  })
  .strict();
export type PublishedContentSet = z.infer<typeof publishedContentSet>;
