import { z } from 'zod';
import { difficultySchema } from '../enums/index';
import { entityId, isoTimestamp, nonNegativeInt } from './primitives';

/**
 * Read-side projections shared by multiple surfaces (Phase 2 §7.1–7.4).
 *
 * These describe what the server *returns*. They are deliberately loose about
 * internal derivation — a snapshot is a computed view, not a stored aggregate.
 */

/** Mirrors `ProgressionSnapshot` in `server/progression/completionOutcome.ts`. */
export const progressionSnapshot = z
  .object({
    coins: nonNegativeInt,
    wisdom: nonNegativeInt,
    rankTier: difficultySchema,
    rankPlaque: z.number().int().min(0),
    rankUnlockedTier: difficultySchema,
    streakDays: z.number().int().min(0),
    lastActiveAt: isoTimestamp.nullable(),
    millionaireWins: nonNegativeInt,
    millionaireMaxLevel: z.number().int().min(0),
    survivalHighScore: nonNegativeInt,
    completedLevels: z.array(z.record(z.string(), z.unknown())),
    achievements: z.array(z.string().max(64)),
    themePoints: z.record(z.string(), nonNegativeInt),
    practiceTracks: z.array(z.record(z.string(), z.unknown())),
    studyMastery: z.record(z.string(), z.unknown()),
  })
  .passthrough();
export type ProgressionSnapshot = z.infer<typeof progressionSnapshot>;

/**
 * `.passthrough()` — the delta carries kind-specific extras the server derives
 * (`nextStageUnlocked`, `nextStageIndex`, `rankChanged`, …). Phase 3 replaces this
 * with a discriminated union per `CompletionKind`; a derived output is never a
 * trust boundary, so passthrough is acceptable here (§8).
 */
export const progressionDelta = z
  .object({
    coins: z.number().int(),
    wisdom: z.number().int(),
    rankTier: z.number().int(),
    streakDays: z.number().int(),
    achievementsGranted: z.array(z.string().max(64)).default([]),
  })
  .passthrough();
export type ProgressionDelta = z.infer<typeof progressionDelta>;

/** Progression outcome envelope — `eventId` is the motion/notification dedup key (§7.2). */
export const progressionOutcome = z.object({
  eventId: entityId,
  previous: progressionSnapshot,
  next: progressionSnapshot,
  delta: progressionDelta,
  occurredAt: isoTimestamp,
});
export type ProgressionOutcome = z.infer<typeof progressionOutcome>;

export const walletSnapshot = z.object({
  balance: nonNegativeInt,
  updatedAt: isoTimestamp.nullable(),
});
export type WalletSnapshot = z.infer<typeof walletSnapshot>;

/** Mirrors `MasteryState` in `src/types/index.ts` (pinned by the parity test). */
export const masteryState = z.object({
  mastery: z.number().min(0).max(100),
  confidence: z.number(),
  lastReviewedAt: isoTimestamp.nullable(),
  errorTags: z.array(z.string().max(64)),
  correctStreak: z.number().int().min(0),
  wrongCount: z.number().int().min(0),
  totalAnswers: z.number().int().min(0),
  nodeId: z.string().max(128).optional(),
  hierarchyDepth: z.number().int().optional(),
  parentMastery: z.number().optional(),
});
export type MasteryState = z.infer<typeof masteryState>;
