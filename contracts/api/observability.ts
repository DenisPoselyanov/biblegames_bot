import { z } from 'zod';

/**
 * `/api/v1/client-errors` — safe frontend error reporting (Phase 2 §20).
 *
 * The client sends only what is safe to log: the route it happened on, the
 * build version, a coarse error code and level, and a truncated message. Never
 * a stack with local paths, never a payload, never user data.
 */
export const clientErrorReport = z
  .object({
    /** App route (pathname only — no query, no ids). */
    route: z.string().max(200),
    /** Build version string baked into the bundle. */
    buildVersion: z.string().max(80),
    /** Coarse, low-cardinality classifier (e.g. `unhandled_rejection`, `render_error`). */
    code: z
      .string()
      .max(64)
      .regex(/^[a-z0-9_.-]+$/, 'code must be a lowercase slug'),
    level: z.enum(['error', 'warn']).default('error'),
    /** Optional short human message — truncated server-side to 300 chars. */
    message: z.string().max(2000).optional(),
  })
  .strict();
export type ClientErrorReport = z.infer<typeof clientErrorReport>;

export const clientErrorAccepted = z.object({ ok: z.literal(true) });
