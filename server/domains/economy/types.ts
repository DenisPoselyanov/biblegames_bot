/**
 * Economy domain value types (Phase 2 §5.4, ADR-016). Domain-owned: no `pg`, no
 * Drizzle `InferSelectModel`, no HTTP types. The repository interfaces speak only
 * these and `@contracts` types.
 */

/** What kind of product an entitlement grants. Phase 6 extends this vocabulary. */
export type EntitlementProductKind = 'theme' | 'avatar';

/** How an entitlement came to exist. */
export type EntitlementSourceType = 'purchase' | 'grant' | 'migration' | 'promotion';

export type EntitlementStatus = 'active' | 'expired' | 'revoked';

/** One grant of a product to a user, with provenance. */
export interface EntitlementRecord {
  id: string;
  userId: string;
  productId: string;
  productKind: EntitlementProductKind;
  sourceType: EntitlementSourceType;
  sourceId: string;
  status: EntitlementStatus;
  grantedBy: string | null;
  grantedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  metadata: Record<string, unknown>;
}

export interface GrantEntitlementInput {
  userId: string;
  productId: string;
  productKind: EntitlementProductKind;
  sourceType: EntitlementSourceType;
  /** Idempotency key together with `sourceType` — a replay returns the existing row. */
  sourceId: string;
  grantedBy?: string | null;
  expiresAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface RevokeEntitlementInput {
  userId: string;
  productId: string;
  revokedBy: string | null;
}
