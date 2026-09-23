/**
 * Well-known job types (Phase 2 §17).
 *
 * The queue itself is type-agnostic; this is the registry of the types the
 * platform actually runs, each with a Zod payload schema so a malformed enqueue
 * fails at the boundary rather than inside a handler. Phase 4 adds AI-generation
 * types here; the shape does not change.
 */
import { z } from 'zod';
import { contentSetFilter } from '../../../contracts/index';

export const JOB_TYPES = {
  /** Delete `rate_limit_counters` rows whose window ended long ago (§17 cleanup). */
  RATE_LIMIT_SWEEP: 'platform.rate_limit_sweep',
  /** Delete `idempotency_keys` past the retention window (§17 expiry). */
  IDEMPOTENCY_SWEEP: 'platform.idempotency_sweep',
  /** Delete `telemetry_events` past the retention window (§17 expiry). */
  TELEMETRY_RETENTION: 'telemetry.retention_sweep',
  /** Build a static published-content snapshot (§14, §17). Handler lands in WS5 part 2. */
  CONTENT_SNAPSHOT: 'content.snapshot',
  /** One AI generation call → a raw artifact in object storage (Phase 4 §7, §8, WS1). Not a draft/revision yet — WS2 consumes the artifact. */
  AI_CONTENT_GENERATE: 'content.ai_generate',
  /** AI repair suggestion for one flagged question (Phase 4 WS9) — same single-call primitive, artifact only. */
  AI_CONTENT_REPAIR: 'content.ai_repair',
} as const;

export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES];

/** Ukrainian display label per type, for the Studio Jobs screen (Phase 4 WS8). */
export const JOB_TYPE_LABELS: Record<string, string> = {
  [JOB_TYPES.RATE_LIMIT_SWEEP]: 'Прибирання лічильників лімітів',
  [JOB_TYPES.IDEMPOTENCY_SWEEP]: 'Прибирання ключів ідемпотентності',
  [JOB_TYPES.TELEMETRY_RETENTION]: 'Прибирання телеметрії',
  [JOB_TYPES.CONTENT_SNAPSHOT]: 'Знімок опублікованого контенту',
  [JOB_TYPES.AI_CONTENT_GENERATE]: 'Генерація контенту (AI)',
  [JOB_TYPES.AI_CONTENT_REPAIR]: 'Виправлення питання (AI)',
};

export function labelForJobType(type: string): string {
  return JOB_TYPE_LABELS[type] ?? type;
}

/** Retention sweeps take an optional override of the cutoff age, in days. */
const retentionPayload = z
  .object({ olderThanDays: z.number().int().positive().max(3650).optional() })
  .strict();

export const JOB_PAYLOAD_SCHEMAS = {
  [JOB_TYPES.RATE_LIMIT_SWEEP]: retentionPayload,
  [JOB_TYPES.IDEMPOTENCY_SWEEP]: retentionPayload,
  [JOB_TYPES.TELEMETRY_RETENTION]: retentionPayload,
  [JOB_TYPES.CONTENT_SNAPSHOT]: z
    .object({ setId: z.string().min(1), filter: contentSetFilter.optional() })
    .strict(),
  [JOB_TYPES.AI_CONTENT_GENERATE]: z
    .object({
      /** e.g. "question.generate.v1" — links the artifact back to its prompt version (§7.3). */
      promptVersion: z.string().min(1),
      prompt: z.string().min(1),
      /** Free-form label for what this batch is for (theme id, topic id, …) — not interpreted by the job. */
      label: z.string().min(1).optional(),
    })
    .strict(),
  [JOB_TYPES.AI_CONTENT_REPAIR]: z
    .object({
      promptVersion: z.string().min(1),
      prompt: z.string().min(1),
      label: z.string().min(1).optional(),
      /** The flagged question and the revision the prompt was built from. */
      questionId: z.string().min(1),
      revisionId: z.string().min(1),
      /** Why it was flagged: `accuracy:too_hard`, `reports`, … */
      signal: z.string().min(1),
    })
    .strict(),
} satisfies Record<string, z.ZodType>;

export type RetentionPayload = z.infer<typeof retentionPayload>;

/** Return the schema for a known type, or a permissive pass-through for the rest. */
export function payloadSchemaFor(type: string): z.ZodType {
  return JOB_PAYLOAD_SCHEMAS[type as keyof typeof JOB_PAYLOAD_SCHEMAS] ?? z.unknown();
}
