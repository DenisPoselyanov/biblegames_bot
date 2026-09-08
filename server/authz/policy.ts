/**
 * Reusable authorization policies (Phase 1 §6.2).
 *
 * Every policy here runs AFTER `requireAuthenticated` + `attachPrincipalRoles`
 * (Phase 2 WS2 part 3): it reads the resolved `req.authz`, never a store. A
 * missing principal is treated as an auth failure, not an authz failure; a
 * principal with no resolved `authz` degrades to the implicit `user` role.
 *
 * WS4 part 2 removed the `rbacV2` break-glass — the policies always enforce.
 */

import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../lib/errors';
import { metrics } from '../lib/metrics';
import type { AuditLog } from '../audit';
import { buildAuditRecord } from '../audit';
import type { Permission, Role } from './roles';

export interface PolicyDeps {
  auditLog: AuditLog;
}

function principal(req: Request): { userId: string; authSource: string } {
  if (!req.auth) {
    throw new UnauthorizedError('missing_credentials', 'Authentication required');
  }
  return { userId: req.auth.userId, authSource: req.auth.authSource };
}

const heldRoles = (req: Request): Role[] => req.authz?.roles ?? ['user'];
const heldPermissions = (req: Request): Permission[] => req.authz?.permissions ?? [];

export function createPolicies({ auditLog }: PolicyDeps) {
  function auditDenied(req: Request, needed: string[], kind: 'role' | 'permission'): void {
    metrics.inc('authz_denied_total', { kind });
    void auditLog.append(
      buildAuditRecord({
        actor: {
          userId: req.auth?.userId ?? null,
          authSource: req.auth?.authSource ?? null,
        },
        action: 'authz.denied',
        target: `${req.method} ${req.originalUrl.split('?')[0]}`,
        result: 'denied',
        requestId: req.id,
        metadata: { kind, needed, held: heldRoles(req) },
      }),
    );
  }

  const attachAuthz = (req: Request, matchedPermission?: Permission): void => {
    req.authz = {
      roles: heldRoles(req),
      permissions: req.authz?.permissions,
      matchedPermission,
    };
  };

  const requireRole = (...roles: Role[]): RequestHandler => {
    return (req: Request, _res: Response, next: NextFunction): void => {
      try {
        principal(req);
        if (roles.some((role) => heldRoles(req).includes(role))) {
          attachAuthz(req);
          next();
          return;
        }
        auditDenied(req, roles, 'role');
        next(new ForbiddenError('forbidden_role', `Requires role: ${roles.join(' or ')}`));
      } catch (err) {
        next(err);
      }
    };
  };

  const requirePermission = (...permissions: Permission[]): RequestHandler => {
    return (req: Request, _res: Response, next: NextFunction): void => {
      try {
        principal(req);
        const matched = permissions.find((perm) => heldPermissions(req).includes(perm));
        if (matched) {
          attachAuthz(req, matched);
          next();
          return;
        }
        auditDenied(req, permissions, 'permission');
        next(
          new ForbiddenError(
            'forbidden_permission',
            `Requires permission: ${permissions.join(' or ')}`,
          ),
        );
      } catch (err) {
        next(err);
      }
    };
  };

  /**
   * Allow when the caller owns the target resource, otherwise fall back to a
   * permission check. Replaces ad-hoc header/param comparison for routes that
   * are self-service for a normal user but privileged for staff (Phase 1 §5.3).
   */
  const requireOwnResourceOrPermission = (
    resolveOwnerId: (req: Request) => string | undefined,
    permission: Permission,
  ): RequestHandler => {
    return (req: Request, _res: Response, next: NextFunction): void => {
      try {
        const { userId } = principal(req);
        if (resolveOwnerId(req) === userId) {
          attachAuthz(req);
          next();
          return;
        }
        if (heldPermissions(req).includes(permission)) {
          attachAuthz(req, permission);
          next();
          return;
        }
        auditDenied(req, [permission], 'permission');
        next(new ForbiddenError('forbidden_user_scope', 'Not allowed to access this resource'));
      } catch (err) {
        next(err);
      }
    };
  };

  return { requireRole, requirePermission, requireOwnResourceOrPermission };
}

export type Policies = ReturnType<typeof createPolicies>;
