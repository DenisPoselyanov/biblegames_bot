/**
 * Identity + access storage (Phase 2 §5.1, §9 "identity/account" + "preferences").
 *
 * NEW in WS2 — Phase 1 had no `users` table (the Telegram id was used directly as
 * an opaque key on `player_profiles` etc.). These tables make the principal, its
 * provider bindings, its roles and its preferences first-class, and close the
 * ADR-011 handoff (config-sourced roles → persisted grant/revoke).
 */
import { sql } from 'drizzle-orm';
import { index, integer, pgTable, primaryKey, text } from 'drizzle-orm/pg-core';
import { createdAt, tstz, updatedAt } from './_shared';

/** The canonical application user. `id` is currently the Telegram user id string. */
export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    displayName: text('display_name'),
    username: text('username'),
    languageCode: text('language_code'),
    /** 'active' | 'suspended' | 'deleted' — free text for now, no lifecycle yet. */
    accountStatus: text('account_status').notNull().default('active'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('idx_users_username').on(t.username)],
);

/** A verified external identity bound to a user (Phase 1 ADR-002). */
export const externalIdentities = pgTable(
  'external_identities',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** `IdentityProvider`: 'telegram' | 'development' (the account source). */
    provider: text('provider').notNull(),
    externalId: text('external_id').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.provider, t.externalId] }),
    index('idx_external_identities_user').on(t.userId),
  ],
);

/** Role vocabulary. Rows mirror `ROLES` in `server/authz/roles.ts` (seeded by 0001). */
export const roles = pgTable('roles', {
  key: text('key').primaryKey(),
  description: text('description').notNull().default(''),
});

/**
 * A persisted role grant with provenance (ADR-011 handoff). A revoked grant keeps
 * its row (`revoked_at` set) for audit; the active-role query filters it out.
 */
export const userRoles = pgTable(
  'user_roles',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleKey: text('role_key')
      .notNull()
      .references(() => roles.key),
    grantedBy: text('granted_by'),
    grantedAt: createdAt(),
    revokedAt: tstz('revoked_at'),
    revokedBy: text('revoked_by'),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.roleKey] }),
    index('idx_user_roles_active')
      .on(t.userId)
      .where(sql`${t.revokedAt} is null`),
  ],
);

/** Schema-versioned user preferences — the only client-trusted write surface (§7.1). */
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
  motionIntensity: text('motion_intensity'),
  updatedAt: updatedAt(),
});
