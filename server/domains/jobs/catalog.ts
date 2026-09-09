/**
 * Well-known job types (Phase 2 §17).
 *
 * The queue itself is type-agnostic; this is the registry of the types the
 * platform actually runs, each with a Zod payload schema so a malformed enqueue
 * fails at the boundary rather than inside a handler. Phase 4 adds AI-generation
 * types here; the shape does not change.
 */
import { z } from 'zod';

export const JOB_TYPES = {
  /** Delete `rate_limit_counters` rows whose window ended long ago (§17 cleanup). */
  RATE_LIMIT_SWEEP: 'platform.rate_limit_sweep',
  /** Delete `idempotency_keys` past the retention window (§17 expiry). */
  IDEMPOTENCY_SWEEP: 'platform.idempotency_sweep',
  /** Delete `telemetry_events` past the retention window (§17 expiry). */
  TELEMETRY_RETENTION: 'telemetry.retention_sweep',
  /** Build a static published-content snapshot (§14, §17). Handler lands in WS5 part 2. */
  CONTENT_SNAPSHOT: 'content.snapshot',
} as const;

export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES];

/** Retention sweeps take an optional override of the cutoff age, in days. */
const retentionPayload = z
  .object({ olderThanDays: z.number().int().positive().max(3650).optional() })
  .strict();

export const JOB_PAYLOAD_SCHEMAS = {
  [JOB_TYPES.RATE_LIMIT_SWEEP]: retentionPayload,
  [JOB_TYPES.IDEMPOTENCY_SWEEP]: retentionPayload,
  [JOB_TYPES.TELEMETRY_RETENTION]: retentionPayload,
  [JOB_TYPES.CONTENT_SNAPSHOT]: z
    .object({ setId: z.string().min(1), filter: z.record(z.unknown()).optional() })
    .strict(),
} satisfies Record<string, z.ZodType>;

export type RetentionPayload = z.infer<typeof retentionPayload>;

/** Return the schema for a known type, or a permissive pass-through for the rest. */
export function payloadSchemaFor(type: string): z.ZodType {
  return JOB_PAYLOAD_SCHEMAS[type as keyof typeof JOB_PAYLOAD_SCHEMAS] ?? z.unknown();
}
