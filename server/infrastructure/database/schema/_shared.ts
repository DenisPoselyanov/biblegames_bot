/**
 * Shared column builders for the Drizzle schema (Phase 2 WS2, ADR-012).
 *
 * The schema is authored per-domain (`identity.ts`, `economy.ts`, …) and
 * re-exported from `./index.ts`. These helpers keep column conventions identical
 * across domains — a bound changed here changes everywhere.
 */
import { jsonb, timestamp } from 'drizzle-orm/pg-core';

/** `timestamptz` stored/read as an ISO string (matches the `@contracts` `isoTimestamp`). */
export const tstz = (name: string) => timestamp(name, { withTimezone: true, mode: 'string' });

/** `timestamptz not null default now()`. */
export const createdAt = () => tstz('created_at').notNull().defaultNow();

/** `timestamptz not null default now()` — bump on write in the repository. */
export const updatedAt = () => tstz('updated_at').notNull().defaultNow();

/** `jsonb not null default '{}'` — an opaque metadata bag. Type it at the call site. */
export const metadataBag = <T = Record<string, unknown>>(name = 'metadata') =>
  jsonb(name).notNull().$type<T>().default({} as T);
