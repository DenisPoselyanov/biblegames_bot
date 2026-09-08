/**
 * Cross-cutting platform storage (Phase 2 §9). Adopted 1:1 from
 * `server/db/schema.sql`: the audit log, command idempotency, and the one-time
 * legacy profile-migration record.
 */
import { bigserial, index, integer, jsonb, pgTable, text } from 'drizzle-orm/pg-core';
import { createdAt, tstz } from './_shared';

/** Append-only audit log (Phase 1 §6.4). No update/delete paths in code. */
export const auditLog = pgTable(
  'audit_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    actorUserId: text('actor_user_id'),
    actorAuthSource: text('actor_auth_source'),
    action: text('action').notNull(),
    target: text('target'),
    result: text('result').notNull(),
    requestId: text('request_id'),
    createdAt: createdAt(),
    metadata: jsonb('metadata').notNull().$type<Record<string, unknown>>().default({}),
  },
  (t) => [
    index('idx_audit_log_action_time').on(t.action, t.createdAt.desc()),
    index('idx_audit_log_actor_time').on(t.actorUserId, t.createdAt.desc()),
  ],
);

/** Command-level idempotency cache (Phase 1 §7.3). */
export const idempotencyKeys = pgTable('idempotency_keys', {
  key: text('key').primaryKey(),
  userId: text('user_id'),
  result: jsonb('result').notNull().$type<Record<string, unknown>>(),
  createdAt: createdAt(),
});

/**
 * Shared fixed-window rate-limit counters (Phase 2 WS2 part 4 — closes the
 * Phase 1 §13 single-instance handoff).
 *
 * One row per `(policy name, principal-or-IP key)`. The window rolls in a single
 * atomic `INSERT … ON CONFLICT DO UPDATE` (see
 * `infrastructure/database/repositories/rateLimitStore.ts`): when `reset_at` has
 * passed, the update resets `count` to 1 and pushes `reset_at` out by the
 * window; otherwise it increments. Stale rows are harmless (the next hit
 * overwrites them); bulk pruning by `reset_at` is a WS5 pg-boss job.
 *
 * Opt-in — the in-memory store (`server/middleware/rateLimitStore.ts`) stays the
 * default and the only store when no database is wired.
 */
export const rateLimitCounters = pgTable(
  'rate_limit_counters',
  {
    /** `${policyName}:${key}` — the limiter name keeps buckets independent. */
    bucket: text('bucket').primaryKey(),
    count: integer('count').notNull().default(0),
    /** When the current window ends; a hit at/after this rolls the window. */
    resetAt: tstz('reset_at').notNull(),
  },
  (t) => [index('idx_rate_limit_counters_reset').on(t.resetAt)],
);

/** One-time legacy profile import record (Phase 1 §9, Phase 2 §18.2). */
export const migrationRecords = pgTable('migration_records', {
  userId: text('user_id').primaryKey(),
  sourceVersion: integer('source_version').notNull().default(0),
  migrationVersion: integer('migration_version').notNull(),
  submittedHash: text('submitted_hash'),
  accepted: jsonb('accepted').notNull().$type<Record<string, unknown>>().default({}),
  rejected: jsonb('rejected').notNull().$type<Record<string, unknown>>().default({}),
  walletOpeningEntryId: text('wallet_opening_entry_id'),
  status: text('status').notNull(),
  createdAt: createdAt(),
});
