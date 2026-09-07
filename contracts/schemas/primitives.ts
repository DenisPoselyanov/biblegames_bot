import { z } from 'zod';

/**
 * Reusable field-level building blocks. Keep validation *strict* here — every
 * surface schema composes these, so a bound tightened once is enforced everywhere.
 */

/** Opaque stable entity id (§6). Non-empty, bounded, no surrounding whitespace. */
export const entityId = z
  .string()
  .trim()
  .min(1)
  .max(128);

/** Human-readable, mutable label (display name, room code echo, …). */
export const shortText = z.string().trim().min(1).max(120);

/** Free-form but bounded blob key/value used in metadata bags. */
export const boundedText = z.string().max(2_000);

/** ISO-8601 timestamp string. */
export const isoTimestamp = z.string().datetime({ offset: true });

/** Client-supplied idempotency key for a non-idempotent command (§13.4). */
export const idempotencyKey = z.string().trim().min(1).max(200);

/** Non-negative integer coin / point amount. */
export const nonNegativeInt = z.number().int().min(0);

/** A cursor page request (§12.3 — no uncontrolled full dumps). */
export const pageRequest = z.object({
  cursor: z.string().max(512).optional(),
  limit: z.number().int().min(1).max(100).default(50),
});
export type PageRequest = z.infer<typeof pageRequest>;

export function pageResponse<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().max(512).nullable(),
  });
}
