import { z } from 'zod';
import { authSourceSchema, roleSchema } from '../enums/index';
import { entityId, isoTimestamp } from '../schemas/primitives';

/** `/api/v1/me/*` — self-scoped identity + preference surface (Phase 1 §5.3, §7.1). */

/** `GET /api/v1/me` */
export const meResponse = z.object({
  userId: entityId,
  displayName: z.string().max(120).nullable(),
  username: z.string().max(120).nullable().optional(),
  languageCode: z.string().max(16).nullable().optional(),
  authSource: authSourceSchema,
  roles: z.array(roleSchema),
  permissions: z.array(z.string().max(64)),
});
export type MeResponse = z.infer<typeof meResponse>;

/**
 * `PATCH /api/v1/me/preferences` — the ONLY client-trusted write (Phase 1 §7.1).
 * The server further constrains `activeTheme` / `avatar` to owned items and
 * `bibleTranslation` to a known translation; unknown keys are ignored, not rejected,
 * so the schema stays permissive on shape but bounded on content.
 */
export const preferencesRequest = z
  .object({
    displayName: z.string().trim().min(1).max(120).optional(),
    bibleTranslation: z.string().trim().min(1).max(32).optional(),
    activeTheme: z.string().trim().max(64).optional(),
    avatar: z.string().trim().max(64).optional(),
  })
  .strip();
export type PreferencesRequest = z.infer<typeof preferencesRequest>;

/** `PATCH /api/v1/me/learning-state` — client-owned opaque review blob (§7.4 exception). */
export const learningStateRequest = z.object({
  reviewSchedules: z.record(z.string().max(128), z.record(z.string(), z.unknown())).default({}),
});
export type LearningStateRequest = z.infer<typeof learningStateRequest>;

export const learningStateResponse = z.object({
  ok: z.literal(true),
  reviewSchedules: z.record(z.string(), z.record(z.string(), z.unknown())),
});

/**
 * `POST /api/v1/me/migrate` — one-time bounded legacy import (Phase 1 §9).
 * `profile` is the legacy client-owned blob; the server validates + bounds each
 * field it trusts (`server/migration/applyMigration.ts`), so the contract keeps
 * it as an opaque record rather than re-describing the legacy shape.
 */
export const migrateRequest = z
  .object({
    sourceVersion: z.number().int().min(0).max(1000).optional(),
    hash: z.string().max(128).optional(),
    profile: z.record(z.string(), z.unknown()).optional(),
  })
  .strip();
export type MigrateRequest = z.infer<typeof migrateRequest>;

export const migrateResponse = z.object({
  ok: z.literal(true),
  replayed: z.boolean(),
  record: z.object({
    userId: entityId,
    sourceVersion: z.number().int(),
    migrationVersion: z.number().int(),
    submittedHash: z.string(),
    accepted: z.record(z.string(), z.unknown()),
    rejected: z.record(z.string(), z.unknown()),
    walletOpeningEntryId: z.string().nullable(),
    status: z.enum(['applied', 'applied_with_caps']),
    createdAt: isoTimestamp,
  }),
});

/** `POST /api/v1/me/telemetry` — events are bounded, not otherwise trusted. */
export const telemetryRequest = z.object({
  events: z.array(z.record(z.string(), z.unknown())).max(100),
});
export type TelemetryRequest = z.infer<typeof telemetryRequest>;
