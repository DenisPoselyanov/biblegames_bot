/**
 * Identity domain value types (Phase 2 §5.1). Domain-owned: no `pg`, no Drizzle
 * `InferSelectModel`, no HTTP types. The repository interfaces speak only these
 * and `@contracts` types.
 */
import type { Role } from '../../../contracts/index';

/**
 * Identity provider for an external binding — the *source of the account*, not
 * the request-time verification mechanism (which is `AuthenticatedPrincipal
 * .authSource` / the `@contracts` `authSourceSchema`). A later identity service
 * maps one to the other.
 */
export type IdentityProvider = 'telegram' | 'development';

export interface UserRecord {
  id: string;
  displayName: string | null;
  username: string | null;
  languageCode: string | null;
  accountStatus: string;
  createdAt: string;
  updatedAt: string;
}

/** Fields a caller may set when creating or upserting a user from a principal. */
export interface UserUpsert {
  id: string;
  displayName?: string | null;
  username?: string | null;
  languageCode?: string | null;
}

export interface ExternalIdentityRef {
  provider: IdentityProvider;
  externalId: string;
}

/** One active or historical role grant for a user. */
export interface RoleGrantRecord {
  userId: string;
  role: Role;
  grantedBy: string | null;
  grantedAt: string;
  revokedAt: string | null;
  revokedBy: string | null;
}

export interface GrantRoleInput {
  userId: string;
  role: Role;
  grantedBy: string | null;
}

export interface RevokeRoleInput {
  userId: string;
  role: Role;
  revokedBy: string | null;
}
