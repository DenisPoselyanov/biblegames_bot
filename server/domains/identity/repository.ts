/**
 * Identity domain repository contracts (Phase 2 §10).
 *
 * Interfaces only — implementations live in `server/infrastructure/database/`
 * (SQL, production) and `./inMemoryRepository.ts` (dev/test parity peer). Both
 * pass `__tests__/repositoryContract.ts`.
 *
 * `tx` is the opaque `Transaction` from `ServiceContext` (§11). A call with no
 * `tx` runs on the pooled connection. The SQL adapter narrows the opaque handle
 * to its driver type internally; the domain never sees a Drizzle type.
 */
import type { Role } from '../../../contracts/index';
import type { Transaction } from '../shared/context';
import type {
  ExternalIdentityRef,
  GrantRoleInput,
  RevokeRoleInput,
  RoleGrantRecord,
  UserRecord,
  UserUpsert,
} from './types';

export interface UserRepository {
  getById(id: string, tx?: Transaction): Promise<UserRecord | null>;
  getByExternalId(ref: ExternalIdentityRef, tx?: Transaction): Promise<UserRecord | null>;
  /**
   * Insert the user if absent (by `id`), refresh the display fields if present,
   * and ensure the external-identity binding exists. Returns the stored row.
   */
  upsertFromIdentity(
    user: UserUpsert,
    identity: ExternalIdentityRef,
    tx?: Transaction,
  ): Promise<UserRecord>;
}

export interface RoleRepository {
  /** Active (non-revoked) roles for a user, always including the implicit `user`. */
  activeRoles(userId: string, tx?: Transaction): Promise<Role[]>;
  /** Every grant row for a user, active and revoked, newest first. */
  history(userId: string, tx?: Transaction): Promise<RoleGrantRecord[]>;
  /** Idempotent: granting an already-active role is a no-op that returns the row. */
  grant(input: GrantRoleInput, tx?: Transaction): Promise<RoleGrantRecord>;
  /** Idempotent: revoking a role the user does not hold returns `null`. */
  revoke(input: RevokeRoleInput, tx?: Transaction): Promise<RoleGrantRecord | null>;
}

export interface IdentityRepositories {
  users: UserRepository;
  roles: RoleRepository;
}
