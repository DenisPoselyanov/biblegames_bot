import { z } from 'zod';

/**
 * Shared closed vocabularies (Phase 2 §6 "canonical IDs and entity rules", §8).
 *
 * These are the *contract* copies. Where `src/types/index.ts` still declares the
 * same literal union for legacy UI code, the two must stay in sync until Phase 3
 * migrates the client onto `@contracts`. The architecture test asserts the value
 * lists match.
 */

/** Difficulty of a single question — NOT player rank, NOT mastery (§3.4 ref-arch). */
export const DIFFICULTY_VALUES = [
  'baby',
  'child',
  'youth',
  'student',
  'preacher',
  'teacher',
  'theologian',
] as const;
export const difficultySchema = z.enum(DIFFICULTY_VALUES);
export type Difficulty = z.infer<typeof difficultySchema>;

/** Server-authoritative progression command kinds (Phase 1 §7.2, carried forward). */
export const COMPLETION_KIND_VALUES = [
  'level',
  'practice_stage',
  'millionaire',
  'survival',
] as const;
export const completionKindSchema = z.enum(COMPLETION_KIND_VALUES);
export type CompletionKind = z.infer<typeof completionKindSchema>;

/** Cosmetic purchase kinds (Phase 1 shop, Phase 6 owns the catalog). */
export const COSMETIC_KIND_VALUES = ['theme', 'avatar'] as const;
export const cosmeticKindSchema = z.enum(COSMETIC_KIND_VALUES);
export type CosmeticKind = z.infer<typeof cosmeticKindSchema>;

/** Accessibility / motion preference (§7.1 UserProfileView.preferences). */
export const MOTION_INTENSITY_VALUES = ['full', 'reduced', 'minimal'] as const;
export const motionIntensitySchema = z.enum(MOTION_INTENSITY_VALUES);
export type MotionIntensity = z.infer<typeof motionIntensitySchema>;

/**
 * Authorization roles — MUST mirror `ROLES` in `server/authz/roles.ts`
 * (parity test guards this) until WS2 makes `contracts` the single source and
 * the server imports from here.
 */
export const ROLE_VALUES = [
  'user',
  'group_leader',
  'content_reviewer',
  'content_publisher',
  'support',
  'admin',
] as const;
export const roleSchema = z.enum(ROLE_VALUES);
export type Role = z.infer<typeof roleSchema>;

/** Verified identity source bound to a principal (Phase 1 ADR-002). */
export const AUTH_SOURCE_VALUES = ['telegram-init-data', 'development'] as const;
export const authSourceSchema = z.enum(AUTH_SOURCE_VALUES);
export type AuthSource = z.infer<typeof authSourceSchema>;

/** Content publication lifecycle (Phase 2 §14, §18.3; Phase 4 drives the workflow). */
export const CONTENT_STATUS_VALUES = [
  'legacy_unreviewed',
  'draft',
  'ready_for_review',
  'published',
  'quarantined',
  'archived',
] as const;
export const contentStatusSchema = z.enum(CONTENT_STATUS_VALUES);
export type ContentStatus = z.infer<typeof contentStatusSchema>;
