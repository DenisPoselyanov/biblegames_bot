/**
 * Candidate Drizzle schema — Phase 2 WS2 spike (ADR-012).
 *
 * A representative slice of the §9 "database model foundation": enough surface to
 * judge Drizzle's ergonomics, not the full model. Translated from the hand-written
 * `server/db/schema.sql` (existing tables kept column-identical so a migration can
 * adopt them) plus the new identity/RBAC tables §9 requires.
 *
 * NOT imported by the server. See ./README.md.
 */

import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { Role } from '../../server/authz/roles';
import type { ProgressionSnapshot } from '../../contracts/index';

const createdAt = timestamp('created_at', { withTimezone: true, mode: 'string' })
  .notNull()
  .defaultNow();
const updatedAt = timestamp('updated_at', { withTimezone: true, mode: 'string' })
  .notNull()
  .defaultNow();

/* ------------------------------------------------------------------ identity */

/** §9 identity/account — replaces the opaque `player_profiles.user_id` key. */
export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    displayName: text('display_name'),
    username: text('username'),
    languageCode: text('language_code'),
    accountStatus: text('account_status').notNull().default('active'),
    createdAt,
    updatedAt,
  },
  (t) => [index('idx_users_username').on(t.username)],
);

/** §9 external identities — one verified provider binding per principal (ADR-002). */
export const externalIdentities = pgTable(
  'external_identities',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(), // 'telegram-init-data' | 'development'
    externalId: text('external_id').notNull(),
    createdAt,
  },
  (t) => [
    primaryKey({ columns: [t.provider, t.externalId] }),
    index('idx_external_identities_user').on(t.userId),
  ],
);

/** §9 roles — the vocabulary. Mirrors `server/authz/roles.ts ROLES` (parity test). */
export const roles = pgTable('roles', {
  key: text('key').primaryKey().$type<Role>(),
  description: text('description').notNull().default(''),
});

/**
 * §9 user_roles — the persisted grant. Closes the ADR-011 handoff: Phase 1
 * assigned roles from static config, Phase 2 makes them a runtime grant/revoke
 * with provenance.
 */
export const userRoles = pgTable(
  'user_roles',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleKey: text('role_key')
      .notNull()
      .references(() => roles.key)
      .$type<Role>(),
    grantedBy: text('granted_by'),
    grantedAt: createdAt,
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'string' }),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.roleKey] }),
    index('idx_user_roles_active').on(t.userId).where(sql`${t.revokedAt} is null`),
  ],
);

/* --------------------------------------------------------------- preferences */

/** §9 preferences — schema-versioned; the only client-trusted write surface. */
export const userPreferences = pgTable('user_preferences', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  schemaVersion: integer('schema_version').notNull().default(1),
  bibleTranslation: text('bible_translation'),
  activeTheme: text('active_theme'),
  avatar: text('avatar'),
  locale: text('locale'),
  timezone: text('timezone'),
  motionIntensity: text('motion_intensity'), // 'full' | 'reduced' | 'minimal'
  updatedAt,
});

/* -------------------------------------------------------------------- economy */

/** Existing `wallet_ledger` (Phase 1 §8) — kept column-identical. Append-only. */
export const walletLedger = pgTable(
  'wallet_ledger',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    type: text('type').notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    balanceAfter: bigint('balance_after', { mode: 'number' }).notNull(),
    sourceType: text('source_type').notNull(),
    sourceId: text('source_id').notNull(),
    reversalOf: text('reversal_of'),
    createdAt,
    metadata: jsonb('metadata').notNull().default({}),
  },
  (t) => [
    uniqueIndex('uq_wallet_ledger_source').on(t.sourceType, t.sourceId),
    index('idx_wallet_ledger_user_time').on(t.userId, t.createdAt.desc()),
  ],
);

/* ---------------------------------------------------------------- progression */

/**
 * §9 "mastery/progress snapshots or event-derived state". The spike stores the
 * snapshot as a typed jsonb blob keyed by user — `$type<ProgressionSnapshot>()`
 * pins it to the SAME type the `@contracts` schema produces (see
 * ./contract-bridge.ts). Event table omitted from the spike.
 */
export const progressionSnapshots = pgTable('progression_snapshots', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  snapshot: jsonb('snapshot').notNull().$type<ProgressionSnapshot>(),
  revision: bigint('revision', { mode: 'number' }).notNull().default(0),
  updatedAt,
});

/** Existing one-time legacy import record (Phase 1 §9). Kept column-identical. */
export const migrationRecords = pgTable('migration_records', {
  userId: text('user_id').primaryKey(),
  sourceVersion: integer('source_version').notNull().default(0),
  migrationVersion: integer('migration_version').notNull(),
  submittedHash: text('submitted_hash'),
  accepted: jsonb('accepted').notNull().default({}),
  rejected: jsonb('rejected').notNull().default({}),
  walletOpeningEntryId: text('wallet_opening_entry_id'),
  status: text('status').notNull(),
  createdAt,
});

export const spikeSchema = {
  users,
  externalIdentities,
  roles,
  userRoles,
  userPreferences,
  walletLedger,
  progressionSnapshots,
  migrationRecords,
};
