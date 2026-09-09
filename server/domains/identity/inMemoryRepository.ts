/**
 * In-memory identity repositories (Phase 2 §10 parity peer).
 *
 * For dev fixtures and as the contract-test peer to the SQL adapter. Writes
 * inside a `tx` are rejected — the in-memory store does not emulate transactions
 * for production writes (§10).
 */
import { normalizeRoles } from '../../authz/roles';
import type { Role } from '../../../contracts/index';
import type { Transaction } from '../shared/context';
import type {
  IdentityRepositories,
  PreferencesRepository,
  RoleRepository,
  UserRepository,
} from './repository';
import type { PreferencesPatch, PreferencesRecord } from './preferences';
import { PREFERENCE_KEYS } from './preferences';
import type {
  ExternalIdentityRef,
  GrantRoleInput,
  RevokeRoleInput,
  RoleGrantRecord,
  UserRecord,
  UserUpsert,
} from './types';

function rejectTx(tx?: Transaction): void {
  if (tx) {
    throw new Error('in-memory identity repository does not support transactional writes (§10)');
  }
}

const identityKey = (ref: ExternalIdentityRef): string => `${ref.provider}:${ref.externalId}`;

export function createInMemoryIdentityRepositories(
  now: () => Date = () => new Date(),
): IdentityRepositories {
  const users = new Map<string, UserRecord>();
  const identities = new Map<string, string>(); // provider:externalId -> userId
  const grants = new Map<string, RoleGrantRecord>(); // `${userId}\0${role}` -> row
  const preferences = new Map<string, PreferencesRecord>();

  const iso = (): string => now().toISOString();
  const grantKey = (userId: string, role: Role): string => `${userId}\0${role}`;

  const userRepo: UserRepository = {
    async getById(id, tx) {
      rejectTx(tx);
      return users.get(id) ? { ...users.get(id)! } : null;
    },
    async getByExternalId(ref, tx) {
      rejectTx(tx);
      const userId = identities.get(identityKey(ref));
      return userId ? this.getById(userId) : null;
    },
    async upsertFromIdentity(user: UserUpsert, identity, tx) {
      rejectTx(tx);
      const existing = users.get(user.id);
      const ts = iso();
      const row: UserRecord = existing
        ? {
            ...existing,
            displayName: user.displayName ?? existing.displayName,
            username: user.username ?? existing.username,
            languageCode: user.languageCode ?? existing.languageCode,
            updatedAt: ts,
          }
        : {
            id: user.id,
            displayName: user.displayName ?? null,
            username: user.username ?? null,
            languageCode: user.languageCode ?? null,
            accountStatus: 'active',
            createdAt: ts,
            updatedAt: ts,
          };
      users.set(row.id, row);
      identities.set(identityKey(identity), row.id);
      return { ...row };
    },
  };

  const roleRepo: RoleRepository = {
    async activeRoles(userId, tx) {
      rejectTx(tx);
      const active = [...grants.values()]
        .filter((g) => g.userId === userId && g.revokedAt === null)
        .map((g) => g.role);
      return normalizeRoles(active);
    },
    async history(userId, tx) {
      rejectTx(tx);
      return [...grants.values()]
        .filter((g) => g.userId === userId)
        .sort((a, b) => b.grantedAt.localeCompare(a.grantedAt))
        .map((g) => ({ ...g }));
    },
    async grant(input: GrantRoleInput, tx) {
      rejectTx(tx);
      const key = grantKey(input.userId, input.role);
      const existing = grants.get(key);
      if (existing && existing.revokedAt === null) return { ...existing };
      const row: RoleGrantRecord = {
        userId: input.userId,
        role: input.role,
        grantedBy: input.grantedBy,
        grantedAt: iso(),
        revokedAt: null,
        revokedBy: null,
      };
      grants.set(key, row);
      return { ...row };
    },
    async revoke(input: RevokeRoleInput, tx) {
      rejectTx(tx);
      const key = grantKey(input.userId, input.role);
      const existing = grants.get(key);
      if (!existing || existing.revokedAt !== null) return null;
      const row: RoleGrantRecord = { ...existing, revokedAt: iso(), revokedBy: input.revokedBy };
      grants.set(key, row);
      return { ...row };
    },
  };

  const preferencesRepo: PreferencesRepository = {
    async get(userId, tx) {
      rejectTx(tx);
      const row = preferences.get(userId);
      return row ? { ...row } : null;
    },
    async upsert(userId, patch: PreferencesPatch, tx) {
      rejectTx(tx);
      const ts = iso();
      const existing = preferences.get(userId);
      const base: PreferencesRecord = existing ?? {
        userId,
        schemaVersion: 1,
        bibleTranslation: null,
        activeTheme: null,
        avatar: null,
        locale: null,
        timezone: null,
        motionIntensity: null,
        updatedAt: ts,
      };
      const next: PreferencesRecord = { ...base, updatedAt: ts };
      for (const key of PREFERENCE_KEYS) {
        if (patch[key] !== undefined) next[key] = patch[key] ?? null;
      }
      preferences.set(userId, next);
      return { ...next };
    },
  };

  return { users: userRepo, roles: roleRepo, preferences: preferencesRepo };
}
