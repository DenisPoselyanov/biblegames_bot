/**
 * SQL identity repositories (Phase 2 §10) — the production adapter for
 * `server/domains/identity/repository.ts`, on Drizzle.
 *
 * The opaque `Transaction` from `ServiceContext` is narrowed to the Drizzle
 * executor here and nowhere else (`asExecutor`).
 */
import { and, desc, eq, isNull } from 'drizzle-orm';
import { normalizeRoles } from '../../../authz/roles';
import type { Role } from '../../../../contracts/index';
import type { Transaction as OpaqueTx } from '../../../domains/shared/context';
import type {
  IdentityRepositories,
  PreferencesRepository,
  RoleRepository,
  UserRepository,
} from '../../../domains/identity/repository';
import { PREFERENCE_KEYS, type PreferencesPatch, type PreferencesRecord } from '../../../domains/identity/preferences';
import type {
  ExternalIdentityRef,
  GrantRoleInput,
  RevokeRoleInput,
  RoleGrantRecord,
  UserRecord,
  UserUpsert,
} from '../../../domains/identity/types';
import type { Database, Transaction } from '../client';
import { externalIdentities, userPreferences, userRoles, users } from '../schema/identity';

type Executor = Database | Transaction;

/** Single point where the opaque handle becomes a concrete Drizzle executor. */
function asExecutor(db: Database, tx?: OpaqueTx): Executor {
  return (tx as unknown as Transaction | undefined) ?? db;
}

const toUserRecord = (r: typeof users.$inferSelect): UserRecord => ({
  id: r.id,
  displayName: r.displayName,
  username: r.username,
  languageCode: r.languageCode,
  accountStatus: r.accountStatus,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

const toGrantRecord = (r: typeof userRoles.$inferSelect): RoleGrantRecord => ({
  userId: r.userId,
  role: r.roleKey as Role,
  grantedBy: r.grantedBy,
  grantedAt: r.grantedAt,
  revokedAt: r.revokedAt,
  revokedBy: r.revokedBy,
});

const toPreferencesRecord = (r: typeof userPreferences.$inferSelect): PreferencesRecord => ({
  userId: r.userId,
  schemaVersion: r.schemaVersion,
  bibleTranslation: r.bibleTranslation,
  activeTheme: r.activeTheme,
  avatar: r.avatar,
  locale: r.locale,
  timezone: r.timezone,
  motionIntensity: r.motionIntensity,
  updatedAt: r.updatedAt,
});

export function createSqlIdentityRepositories(db: Database): IdentityRepositories {
  const userRepo: UserRepository = {
    async getById(id, tx) {
      const [row] = await asExecutor(db, tx)
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      return row ? toUserRecord(row) : null;
    },

    async getByExternalId(ref: ExternalIdentityRef, tx) {
      const [row] = await asExecutor(db, tx)
        .select({ user: users })
        .from(externalIdentities)
        .innerJoin(users, eq(users.id, externalIdentities.userId))
        .where(
          and(
            eq(externalIdentities.provider, ref.provider),
            eq(externalIdentities.externalId, ref.externalId),
          ),
        )
        .limit(1);
      return row ? toUserRecord(row.user) : null;
    },

    async upsertFromIdentity(user: UserUpsert, identity, tx) {
      const exec = asExecutor(db, tx);
      const set: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      if (user.displayName !== undefined) set.displayName = user.displayName;
      if (user.username !== undefined) set.username = user.username;
      if (user.languageCode !== undefined) set.languageCode = user.languageCode;

      const [row] = await exec
        .insert(users)
        .values({
          id: user.id,
          displayName: user.displayName ?? null,
          username: user.username ?? null,
          languageCode: user.languageCode ?? null,
        })
        .onConflictDoUpdate({ target: users.id, set })
        .returning();

      await exec
        .insert(externalIdentities)
        .values({
          userId: user.id,
          provider: identity.provider,
          externalId: identity.externalId,
        })
        .onConflictDoNothing();

      return toUserRecord(row);
    },
  };

  const roleRepo: RoleRepository = {
    async activeRoles(userId, tx) {
      const rows = await asExecutor(db, tx)
        .select({ role: userRoles.roleKey })
        .from(userRoles)
        .where(and(eq(userRoles.userId, userId), isNull(userRoles.revokedAt)));
      return normalizeRoles(rows.map((r) => r.role as Role));
    },

    async history(userId, tx) {
      const rows = await asExecutor(db, tx)
        .select()
        .from(userRoles)
        .where(eq(userRoles.userId, userId))
        .orderBy(desc(userRoles.grantedAt));
      return rows.map(toGrantRecord);
    },

    async grant(input: GrantRoleInput, tx) {
      const exec = asExecutor(db, tx);
      const [current] = await exec
        .select()
        .from(userRoles)
        .where(and(eq(userRoles.userId, input.userId), eq(userRoles.roleKey, input.role)))
        .limit(1);
      if (current && current.revokedAt === null) return toGrantRecord(current);

      const [row] = await exec
        .insert(userRoles)
        .values({ userId: input.userId, roleKey: input.role, grantedBy: input.grantedBy })
        .onConflictDoUpdate({
          target: [userRoles.userId, userRoles.roleKey],
          set: {
            grantedBy: input.grantedBy,
            grantedAt: new Date().toISOString(),
            revokedAt: null,
            revokedBy: null,
          },
        })
        .returning();
      return toGrantRecord(row);
    },

    async revoke(input: RevokeRoleInput, tx) {
      const [row] = await asExecutor(db, tx)
        .update(userRoles)
        .set({ revokedAt: new Date().toISOString(), revokedBy: input.revokedBy })
        .where(
          and(
            eq(userRoles.userId, input.userId),
            eq(userRoles.roleKey, input.role),
            isNull(userRoles.revokedAt),
          ),
        )
        .returning();
      return row ? toGrantRecord(row) : null;
    },
  };

  const preferencesRepo: PreferencesRepository = {
    async get(userId, tx) {
      const [row] = await asExecutor(db, tx)
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1);
      return row ? toPreferencesRecord(row) : null;
    },

    async upsert(userId, patch: PreferencesPatch, tx) {
      const set: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      for (const key of PREFERENCE_KEYS) {
        if (patch[key] !== undefined) set[key] = patch[key] ?? null;
      }
      const [row] = await asExecutor(db, tx)
        .insert(userPreferences)
        .values({
          userId,
          bibleTranslation: patch.bibleTranslation ?? null,
          activeTheme: patch.activeTheme ?? null,
          avatar: patch.avatar ?? null,
          locale: patch.locale ?? null,
          timezone: patch.timezone ?? null,
          motionIntensity: patch.motionIntensity ?? null,
        })
        .onConflictDoUpdate({ target: userPreferences.userId, set })
        .returning();
      return toPreferencesRecord(row);
    },
  };

  return { users: userRepo, roles: roleRepo, preferences: preferencesRepo };
}
