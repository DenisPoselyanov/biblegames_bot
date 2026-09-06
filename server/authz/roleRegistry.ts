/**
 * Config-sourced role grants (Phase 1 WS2, ADR-011).
 *
 * Phase 1 does not have a persisted role store or a runtime grant/revoke API —
 * that is WS3, which owns the storage-contract expansion. Here roles come from
 * two env vars parsed once by `loadConfig`:
 *
 *   RBAC_ROLE_GRANTS  JSON — either `{"<userId>": ["admin", ...]}` or
 *                     `[{"userId": "...", "roles": ["..."]}]`
 *   RBAC_ADMIN_IDS    comma-separated user ids granted the `admin` role
 *
 * Parsing is fail-safe: malformed JSON or unknown role names produce a warning
 * and are dropped, never a crash (a broken grants string must not take the
 * server down, and must not silently escalate privileges).
 */

import { isRole, normalizeRoles, permissionsForRoles, type Permission, type Role } from './roles';

export interface RoleGrant {
  userId: string;
  roles: Role[];
}

export interface PrincipalRoles {
  roles: Role[];
  permissions: Permission[];
}

function coerceRoleList(raw: unknown, userId: string, warnings: string[]): Role[] {
  if (!Array.isArray(raw)) {
    warnings.push(`RBAC_ROLE_GRANTS: roles for "${userId}" is not an array, ignored`);
    return [];
  }
  const roles: Role[] = [];
  for (const entry of raw) {
    if (isRole(entry)) {
      roles.push(entry);
    } else {
      warnings.push(`RBAC_ROLE_GRANTS: unknown role "${String(entry)}" for "${userId}", dropped`);
    }
  }
  return roles;
}

function parseRoleGrantsJson(raw: string, warnings: string[]): Map<string, Set<Role>> {
  const grants = new Map<string, Set<Role>>();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    warnings.push('RBAC_ROLE_GRANTS is not valid JSON, ignored (no roles granted from it)');
    return grants;
  }

  const add = (userId: string, roles: Role[]): void => {
    const id = userId.trim();
    if (!id) return;
    const set = grants.get(id) ?? new Set<Role>();
    for (const role of roles) set.add(role);
    grants.set(id, set);
  };

  if (Array.isArray(parsed)) {
    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object') continue;
      const { userId, roles } = entry as { userId?: unknown; roles?: unknown };
      if (typeof userId !== 'string') {
        warnings.push('RBAC_ROLE_GRANTS: array entry without a string "userId", skipped');
        continue;
      }
      add(userId, coerceRoleList(roles, userId, warnings));
    }
  } else if (parsed && typeof parsed === 'object') {
    for (const [userId, roles] of Object.entries(parsed as Record<string, unknown>)) {
      add(userId, coerceRoleList(roles, userId, warnings));
    }
  } else {
    warnings.push('RBAC_ROLE_GRANTS must be a JSON object or array, ignored');
  }

  return grants;
}

export function parseRoleGrants(
  env: NodeJS.ProcessEnv = process.env,
  warnings: string[] = [],
): RoleGrant[] {
  const grants = env.RBAC_ROLE_GRANTS?.trim()
    ? parseRoleGrantsJson(env.RBAC_ROLE_GRANTS.trim(), warnings)
    : new Map<string, Set<Role>>();

  const adminIds = (env.RBAC_ADMIN_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const id of adminIds) {
    const set = grants.get(id) ?? new Set<Role>();
    set.add('admin');
    grants.set(id, set);
  }

  return [...grants.entries()].map(([userId, roles]) => ({
    userId,
    roles: [...roles],
  }));
}

export class RoleRegistry {
  private readonly byUser = new Map<string, Role[]>();

  constructor(grants: readonly RoleGrant[] = []) {
    for (const grant of grants) {
      this.byUser.set(grant.userId, normalizeRoles(grant.roles));
    }
  }

  rolesFor(userId: string): Role[] {
    return this.byUser.get(userId) ?? ['user'];
  }

  hasPermission(userId: string, permission: Permission): boolean {
    return permissionsForRoles(this.rolesFor(userId)).has(permission);
  }

  hasRole(userId: string, role: Role): boolean {
    return this.rolesFor(userId).includes(role);
  }

  describe(userId: string): PrincipalRoles {
    const roles = this.rolesFor(userId);
    return { roles, permissions: [...permissionsForRoles(roles)] };
  }
}
