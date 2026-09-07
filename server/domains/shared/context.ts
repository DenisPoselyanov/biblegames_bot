/**
 * `ServiceContext` — the explicit call context every domain service receives
 * (Phase 2 §11, §12.4). It replaces "pass the Express `Request` around": a
 * service depends only on this shape, never on HTTP or realtime types, so the
 * same service is callable from an HTTP route, a Socket.IO handler, a background
 * job or a test.
 *
 * The transaction handle is introduced with the repository layer in WS2; it is
 * declared here now as an opaque, optional slot so service signatures are stable.
 */

import type { AuthSource, Role } from '../../../contracts/index';

/** Verified caller. Mirrors `AuthenticatedPrincipal` (server/auth/principal.ts). */
export interface ServicePrincipal {
  userId: string;
  telegramUserId: string | null;
  displayName: string | null;
  roles: readonly Role[];
  permissions: readonly string[];
  authSource: AuthSource;
}

/** Opaque transaction handle — concretised by the repository layer in WS2. */
export type Transaction = { readonly __tx: unique symbol } & object;

export interface ServiceContext {
  /** The authenticated principal, or `null` for an unauthenticated/system call. */
  principal: ServicePrincipal | null;
  /** Correlation id shared with logs, audit records and the error envelope. */
  requestId: string;
  /** Injectable clock — services never call `Date.now()` directly. */
  now: () => Date;
  /** Active transaction, when the caller has opened one. */
  tx?: Transaction;
  /** Caller's locale / timezone where a service needs them (§12.4). */
  locale?: string;
  timezone?: string;
}

/** Narrow a context to one that definitely carries a principal. */
export function requirePrincipal(ctx: ServiceContext): ServicePrincipal {
  if (!ctx.principal) {
    throw new Error('ServiceContext has no principal — this call requires authentication');
  }
  return ctx.principal;
}
