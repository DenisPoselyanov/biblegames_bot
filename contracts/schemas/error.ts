import { z } from 'zod';

/**
 * Canonical API error envelope (Phase 2 §7.5). Every `/api/v1` route — and every
 * realtime NACK — serialises failures through this exact shape.
 *
 * Phase 1 shipped `{ error: { code, message, requestId, fields? } }`. Phase 2 adds
 * `messageKey` (i18n lookup key, `message` stays as a safe dev-facing fallback),
 * `retryable` (so a typed client can decide whether to retry — §13.4), and renames
 * `fields` → `fieldErrors` with `string[]` values. The server error handler emits
 * both `fields` and `fieldErrors` during the WS4 client cutover window.
 */
export const apiErrorEnvelope = z.object({
  error: z.object({
    /** Stable machine code, e.g. `forbidden_permission`, `invalid_completion`. */
    code: z.string().min(1).max(64),
    /** i18n key the client resolves; falls back to `message` when absent. */
    messageKey: z.string().min(1).max(128).optional(),
    /** Safe, non-secret, dev-facing description. Never a stack trace. */
    message: z.string().max(400),
    /** Correlates with server logs and the `x-request-id` response header. */
    requestId: z.string().max(64).optional(),
    /** Per-field validation errors, keyed by dotted field path. */
    fieldErrors: z.record(z.string(), z.array(z.string())).optional(),
    /** Whether an identical retry could plausibly succeed. */
    retryable: z.boolean().default(false),
  }),
});

export type ApiErrorEnvelope = z.infer<typeof apiErrorEnvelope>;

/** Codes that always carry `retryable: true`. */
export const RETRYABLE_ERROR_CODES = new Set<string>([
  'internal_error',
  'storage_unavailable',
  'rate_limited',
]);
