import type { AuthenticatedPrincipal } from '../auth/principal';
import type { Permission, Role } from '../authz/roles';

declare global {
  namespace Express {
    interface Request {
      /** Per-request correlation id, set by requestId middleware. */
      id?: string;
      /** Verified identity, set by requireAuthenticated. Absent on public routes. */
      auth?: AuthenticatedPrincipal;
      /** Authorization context, set by policy middleware (server/authz/policy.ts). */
      authz?: { roles: Role[]; matchedPermission?: Permission };
    }
  }
}

export {};
