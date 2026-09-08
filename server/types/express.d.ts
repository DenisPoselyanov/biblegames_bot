import type { AuthenticatedPrincipal } from '../auth/principal';
import type { Permission, Role } from '../authz/roles';

declare global {
  namespace Express {
    interface Request {
      /** Per-request correlation id, set by requestId middleware. */
      id?: string;
      /** Verified identity, set by requireAuthenticated. Absent on public routes. */
      auth?: AuthenticatedPrincipal;
      /**
       * Authorization context. `roles`/`permissions` are set by
       * `attachPrincipalRoles` (server/authz/principalRoles.ts) right after auth;
       * `matchedPermission` is added by the policy middleware that let the
       * request through (server/authz/policy.ts).
       */
      authz?: { roles: Role[]; permissions?: Permission[]; matchedPermission?: Permission };
    }
  }
}

export {};
