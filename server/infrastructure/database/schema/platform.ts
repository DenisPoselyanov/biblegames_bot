/**
 * Cross-cutting platform storage (Phase 2 §9). Adopted 1:1 from
 * `server/db/schema.sql`: the audit log, command idempotency, and the one-time
 * legacy profile-migration record.
 */
import { bigserial, index, integer, jsonb, pgTable, text } from 'drizzle-orm/pg-core';
import { createdAt } from './_shared';

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
