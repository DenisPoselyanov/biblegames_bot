/**
 * Principal role resolution (Phase 2 WS2 part 3 — closes the ADR-011 handoff).
 *
 * Phase 1 read roles synchronously from a config-only `RoleRegistry`. WS2 adds a
 * persisted `user_roles` store, so resolution becomes async. A `RoleResolver` is
 * the one seam the request path awaits (see `./principalRoles.ts`); everything
 * downstream (`./policy.ts`, `routes/me.ts`) reads the resolved
 * `req.authz` synchronously.
 *
 * Config grants (`RBAC_ROLE_GRANTS` / `RBAC_ADMIN_IDS`) stay an **un-revokable
 * floor**: they are unioned on top of the persisted set every time, so a
 * deploy-time `RBAC_ADMIN_IDS` still bootstraps the first admin who can then use
 * the runtime grant API. Removing a config-floored role means editing config.
 */

import { log } from '../lib/logger';
import { metrics } from '../lib/metrics';
import type { RoleRepository } from '../domains/identity/repository';
import { normalizeRoles, permissionsForRoles, type Permission, type Role } from './roles';
import type { PrincipalRoles, RoleRegistry } from './roleRegistry';

export type { PrincipalRoles } from './roleRegistry';

export interface RoleResolver {
  /** Active roles + derived permissions for a user. Never rejects. */
  resolve(userId: string): Promise<PrincipalRoles>;
  /** Drop any cached entry for a user (call after a grant/revoke). */
  invalidate(userId: string): void;
  /** Drop the whole cache. */
  invalidateAll(): void;
}

const describe = (roles: Iterable<Role>): PrincipalRoles => {
  const normalized = normalizeRoles(roles);
  return { roles: normalized, permissions: [...permissionsForRoles(normalized)] as Permission[] };
};

/**
 * Config-only resolver — the Phase 1 behaviour, wrapped in the async seam. Used
 * when no persisted identity store is wired (JSON storage, most unit tests).
 */
export function createConfigRoleResolver(registry: RoleRegistry): RoleResolver {
  return {
    async resolve(userId) {
      return registry.describe(userId);
    },
    invalidate() {},
    invalidateAll() {},
  };
}

export interface PersistedRoleResolverDeps {
  roleRepo: RoleRepository;
  /** Config grants, applied as an un-revokable floor. */
  floor: RoleRegistry;
  now?: () => Date;
  /** Cache lifetime for a resolved entry. Default 30s. */
  ttlMs?: number;
}

interface CacheEntry {
  value: PrincipalRoles;
  expiresAt: number;
}

/**
 * Reads `user_roles` and unions the result with the config floor. A short-TTL
 * per-user cache keeps the hot path off the database between grants; the
 * grant/revoke service calls `invalidate(userId)` so a change is visible at once.
 *
 * Fail-safe: if the store read throws, resolution degrades to the config floor
 * for that call (never a 500, never a privilege escalation) and is not cached.
 */
export function createPersistedRoleResolver({
  roleRepo,
  floor,
  now = () => new Date(),
  ttlMs = 30_000,
}: PersistedRoleResolverDeps): RoleResolver {
  const cache = new Map<string, CacheEntry>();

  return {
    async resolve(userId) {
      const cached = cache.get(userId);
      const nowMs = now().getTime();
      if (cached && cached.expiresAt > nowMs) {
        metrics.inc('role_resolve_total', { source: 'cache' });
        return cached.value;
      }

      let persisted: Role[];
      try {
        persisted = await roleRepo.activeRoles(userId);
      } catch (err) {
        metrics.inc('role_resolve_total', { source: 'error_floor' });
        log.error('rbac.role_resolve_failed', {
          userId,
          message: err instanceof Error ? err.message : String(err),
        });
        return floor.describe(userId);
      }

      const value = describe([...persisted, ...floor.rolesFor(userId)]);
      cache.set(userId, { value, expiresAt: nowMs + ttlMs });
      metrics.inc('role_resolve_total', { source: 'store' });
      return value;
    },
    invalidate(userId) {
      cache.delete(userId);
    },
    invalidateAll() {
      cache.clear();
    },
  };
}
