/**
 * Runtime RBAC admin surface — `/api/v1/admin/roles/*` (Phase 2 WS2 part 3).
 *
 * Authentication + the `admin` role are enforced by the caller (see
 * `server/app.ts`); this router is mounted only when a persisted identity store
 * is wired. Config grants stay an un-revokable floor on top of what is set here.
 */

import { Router, type Request } from 'express';
import { adminContract } from '../../contracts/index';
import { isRole, type Role } from '../authz/roles';
import type { RoleService } from '../authz/roleService';
import type { RoleGrantRecord } from '../domains/identity/types';
import { asyncHandler } from '../middleware/asyncHandler';
import { validateBody } from '../middleware/validate';
import { AppError, UnauthorizedError } from '../lib/errors';

export interface AdminRolesRouterDeps {
  roleService: RoleService;
}

function actorId(req: Request): string {
  if (!req.auth) throw new UnauthorizedError('missing_credentials', 'Authentication required');
  return req.auth.userId;
}

const toGrantView = (r: RoleGrantRecord) => ({
  userId: r.userId,
  role: r.role,
  grantedBy: r.grantedBy,
  grantedAt: r.grantedAt,
  revokedAt: r.revokedAt,
  revokedBy: r.revokedBy,
});

export function createAdminRolesRouter({ roleService }: AdminRolesRouterDeps): Router {
  const router = Router();

  router.get(
    '/:userId',
    asyncHandler(async (req, res) => {
      const view = await roleService.list(req.params.userId);
      res.json({
        userId: view.userId,
        roles: view.roles,
        history: view.history.map(toGrantView),
      });
    }),
  );

  router.post(
    '/:userId',
    validateBody(adminContract.grantRoleRequest, 'invalid_role'),
    asyncHandler(async (req, res) => {
      const grant = await roleService.grant({
        actor: actorId(req),
        userId: req.params.userId,
        role: (req.body as { role: Role }).role,
        requestId: req.id,
      });
      res.status(201).json({ ok: true, grant: toGrantView(grant) });
    }),
  );

  router.delete(
    '/:userId/:role',
    asyncHandler(async (req, res) => {
      const { role } = req.params;
      if (!isRole(role)) {
        throw new AppError('invalid_role', `Unknown role: ${role}`, 400);
      }
      const revoked = await roleService.revoke({
        actor: actorId(req),
        userId: req.params.userId,
        role,
        requestId: req.id,
      });
      res.json({ ok: true, revoked: revoked ? toGrantView(revoked) : null });
    }),
  );

  return router;
}
