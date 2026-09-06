/**
 * Reusable authorization policies (Phase 1 §6.2).
 *
 * Every policy here runs AFTER `requireAuthenticated` (it reads `req.auth`). A
 * missing principal is treated as an auth failure, not an authz failure.
 *
 * Feature flag `rbacV2` (default ON): when `FEATURE_RBACV2=false`, the policies
 * degrade to "authenticated is enough" — the WS1 behavior — as a one-release
 * break-glass while RBAC rolls out.
 */

import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../lib/errors';
import { serverFlag } from '../lib/flags';
import type { AuditLog } from '../audit';
import { buildAuditRecord } from '../audit';
import type { Permission, Role } from './roles';
import type { RoleRegistry } from './roleRegistry';

export interface PolicyDeps {
  roleRegistry: RoleRegistry;
  auditLog: AuditLog;
}

function rbacEnabled(): boolean {
  return serverFlag('rbacV2', true);
}

function principal(req: Request): { userId: string; authSource: string } {
  if (!req.auth) {
    throw new UnauthorizedError('missing_credentials', 'Authentication required');
  }
  return { userId: req.auth.userId, authSource: req.auth.authSource };
}

export function createPolicies({ roleRegistry, auditLog }: PolicyDeps) {
  function auditDenied(req: Request, needed: string[], kind: 'role' | 'permission'): void {
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
        metadata: { kind, needed, held: roleRegistry.rolesFor(req.auth?.userId ?? '') },
      }),
    );
  }

  const attachAuthz = (req: Request, matchedPermission?: Permission): void => {
    req.authz = { roles: roleRegistry.rolesFor(req.auth?.userId ?? ''), matchedPermission };
  };

  const requireRole = (...roles: Role[]): RequestHandler => {
    return (req: Request, _res: Response, next: NextFunction): void => {
      try {
        const { userId } = principal(req);
        if (!rbacEnabled() || roles.some((role) => roleRegistry.hasRole(userId, role))) {
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
        const { userId } = principal(req);
        const matched = permissions.find((perm) => roleRegistry.hasPermission(userId, perm));
        if (!rbacEnabled() || matched) {
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
        if (!rbacEnabled() || roleRegistry.hasPermission(userId, permission)) {
          attachAuthz(req, rbacEnabled() ? permission : undefined);
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
