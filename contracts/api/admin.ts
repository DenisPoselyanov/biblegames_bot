import { z } from 'zod';
import { roleSchema } from '../enums/index';
import { entityId, isoTimestamp } from '../schemas/primitives';

/**
 * `/api/v1/admin/roles/*` — the runtime RBAC grant/revoke surface that closes the
 * ADR-011 handoff (config-sourced roles → persisted `user_roles` with provenance).
 *
 * Every route here is `admin`-only and is mounted only when a persisted identity
 * store is wired (see `server/app.ts`). Config grants (`RBAC_ROLE_GRANTS` /
 * `RBAC_ADMIN_IDS`) remain an un-revokable floor on top of the persisted set.
 */

/** `POST /api/v1/admin/roles/:userId` body. */
export const grantRoleRequest = z.object({ role: roleSchema }).strict();
export type GrantRoleRequest = z.infer<typeof grantRoleRequest>;

/** One row of a user's grant history (active or revoked). */
export const roleGrantView = z.object({
  userId: entityId,
  role: roleSchema,
  grantedBy: z.string().max(128).nullable(),
  grantedAt: isoTimestamp,
  revokedAt: isoTimestamp.nullable(),
  revokedBy: z.string().max(128).nullable(),
});
export type RoleGrantView = z.infer<typeof roleGrantView>;

/** `GET /api/v1/admin/roles/:userId` response. */
export const userRolesResponse = z.object({
  userId: entityId,
  /** Active (non-revoked) roles, always including the implicit `user`. */
  roles: z.array(roleSchema),
  /** Full grant history, newest first — one row per (user, role). */
  history: z.array(roleGrantView),
});
export type UserRolesResponse = z.infer<typeof userRolesResponse>;
