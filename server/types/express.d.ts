import type { AuthenticatedPrincipal } from '../auth/principal';

declare global {
  namespace Express {
    interface Request {
      /** Per-request correlation id, set by requestId middleware. */
      id?: string;
      /** Verified identity, set by requireAuthenticated. Absent on public routes. */
      auth?: AuthenticatedPrincipal;
    }
  }
}

export {};
