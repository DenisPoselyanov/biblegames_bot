import { z } from 'zod';
import { completionKindSchema, difficultySchema } from '../enums/index';
import { entityId, idempotencyKey, isoTimestamp } from '../schemas/primitives';
import { masteryState, progressionOutcome } from '../schemas/snapshots';

/**
 * `/api/v1/progression/*` — server-authoritative progression commands
 * (Phase 1 §7.2, contract-formalised in Phase 2 WS1).
 */

/** `POST /api/v1/progression/completions` */
export const completionRequest = z
  .object({
    kind: completionKindSchema,
    idempotencyKey,
    runId: z.string().trim().min(1).max(128),
    stageIndex: z.number().int().min(0).max(1_000).optional(),
    stageCount: z.number().int().min(1).max(1_000).optional(),
    difficulty: difficultySchema.optional(),
    themeId: z.string().trim().max(64).optional(),
    nodeId: z.string().trim().max(128).nullish(),
    questionIds: z.array(z.string().max(128)).max(100).optional(),
    correctCount: z.number().int().min(0).max(100).optional(),
    totalQuestions: z.number().int().min(0).max(100).optional(),
    reachedLevel: z.number().int().min(0).max(15).optional(),
    runLength: z.number().int().min(0).max(10_000).optional(),
    score: z.number().int().min(0).max(10_000_000).optional(),
  })
  .strict();
export type CompletionRequest = z.infer<typeof completionRequest>;

export const completionResponse = progressionOutcome;
export type CompletionResponse = z.infer<typeof completionResponse>;

/** `POST /api/v1/progression/answers` */
export const answerRequest = z
  .object({
    questionId: z.string().trim().min(1).max(128),
    idempotencyKey,
    isCorrect: z.boolean(),
    themeId: z.string().trim().max(64).optional(),
    nodeId: z.string().trim().max(128).optional(),
    subthemeId: z.string().trim().max(128).optional(),
    errorTag: z.string().trim().max(64).optional(),
  })
  .strict()
  .refine((b) => Boolean(b.themeId || b.nodeId || b.subthemeId), {
    message: 'themeId or nodeId required',
    path: ['nodeId'],
  });
export type AnswerRequest = z.infer<typeof answerRequest>;

export const answerResponse = z.object({
  nodeId: entityId,
  mastery: masteryState,
  achievementsGranted: z.array(z.string().max(64)),
  answeredAt: isoTimestamp,
});
export type AnswerResponse = z.infer<typeof answerResponse>;
