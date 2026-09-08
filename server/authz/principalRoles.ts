/**
 * `attachPrincipalRoles` — the single async step in the request path that
 * resolves the authenticated principal's roles (Phase 2 WS2 part 3).
 *
 * Runs immediately after `requireAuthenticated`. It populates `req.authz` with
 * the resolved roles + permissions so that `./policy.ts` and `routes/me.ts` stay
 * synchronous. On an unauthenticated request it is a no-op — the downstream
 * policy (or route) produces the 401.
 */

import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { RoleResolver } from './roleResolver';

export function createAttachPrincipalRoles(resolver: RoleResolver): RequestHandler {
  return function attachPrincipalRoles(req: Request, _res: Response, next: NextFunction): void {
    if (!req.auth) {
      next();
      return;
    }
    resolver.resolve(req.auth.userId).then(({ roles, permissions }) => {
      req.authz = { ...req.authz, roles, permissions };
      next();
    }, next);
  };
}
