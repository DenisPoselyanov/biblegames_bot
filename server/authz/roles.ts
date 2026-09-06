/**
 * Server-side role and permission taxonomy (Phase 1 §6.1, ADR-002).
 *
 * Roles are assigned to users out-of-band (config in Phase 1 — see
 * ./roleRegistry.ts). Permissions are derived from roles; route handlers and
 * policy middleware check permissions, never role names directly, except where a
 * role *is* the unit of authorization (e.g. `requireRole('admin')`).
 *
 * The frontend `VITE_ADMIN_IDS` list is never an authority here — it may only
 * hide a menu for UX (Phase 1 §6.1).
 */

export const ROLES = [
  'user',
  'group_leader',
  'content_reviewer',
  'content_publisher',
  'support',
  'admin',
] as const;

export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'content:draft:create',
  'content:review',
  'content:publish',
  'users:manage',
  'groups:manage',
  'audit:read',
  'kahoot:host',
  'sessions:export',
  /**
   * Mutate the live question bank. Admin-only in Phase 1 — live question
   * mutation stays minimally protected until Phase 4 Content Studio exists
   * (ADR-004). `content_publisher` gains this in Phase 4.
   */
  'questions:admin',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const NON_ADMIN_ROLE_PERMISSIONS: Record<Exclude<Role, 'admin'>, readonly Permission[]> = {
  user: [],
  group_leader: ['groups:manage', 'kahoot:host', 'sessions:export'],
  content_reviewer: ['content:draft:create', 'content:review'],
  content_publisher: ['content:draft:create', 'content:review', 'content:publish'],
  support: ['users:manage', 'audit:read'],
};

/** `admin` holds every permission (superset). */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ...NON_ADMIN_ROLE_PERMISSIONS,
  admin: [...PERMISSIONS],
};

const ROLE_SET: ReadonlySet<string> = new Set(ROLES);

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && ROLE_SET.has(value);
}

/** Every user implicitly has the `user` role even with no explicit grant. */
export function normalizeRoles(roles: Iterable<Role>): Role[] {
  const set = new Set<Role>(['user']);
  for (const role of roles) set.add(role);
  return ROLES.filter((role) => set.has(role));
}

export function permissionsForRoles(roles: Iterable<Role>): Set<Permission> {
  const permissions = new Set<Permission>();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role] ?? []) permissions.add(permission);
  }
  return permissions;
}
