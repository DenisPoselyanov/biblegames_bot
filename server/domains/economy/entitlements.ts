/**
 * Entitlements — the typed, decomposed home for what used to be the
 * `unlockedThemes` / `unlockedAvatars` string arrays in the `player_profiles`
 * blob (Phase 2 §5.4, §18.2 step 5, ADR-016).
 *
 * Interfaces only — implementations live in
 * `server/infrastructure/database/repositories/economy.ts` (SQL, production) and
 * `./inMemoryRepository.ts` (dev/test parity peer). Both pass
 * `__tests__/repositoryContract.ts`.
 *
 * `tx` is the opaque `Transaction` from `ServiceContext` (§11). A call with no
 * `tx` runs on the pooled connection; the SQL adapter narrows the handle to its
 * driver type internally.
 */
import type { Transaction } from '../shared/context';
import type {
  EntitlementRecord,
  GrantEntitlementInput,
  RevokeEntitlementInput,
} from './types';

export interface EntitlementRepository {
  /** Every grant row for a user (active, expired and revoked), newest first. */
  list(userId: string, tx?: Transaction): Promise<EntitlementRecord[]>;
  /**
   * Currently-effective grants: `status = 'active'`, not revoked, and not past
   * `expires_at` (evaluated against `now`).
   */
  listActive(userId: string, now: Date, tx?: Transaction): Promise<EntitlementRecord[]>;
  /** The grant for an idempotency key, or `null`. */
  findBySource(
    sourceType: string,
    sourceId: string,
    tx?: Transaction,
  ): Promise<EntitlementRecord | null>;
  /**
   * Idempotent on `(sourceType, sourceId)`: a replay returns the existing row
   * unchanged. Creates the row `active` otherwise.
   */
  grant(input: GrantEntitlementInput, tx?: Transaction): Promise<EntitlementRecord>;
  /**
   * Idempotent: revoking a product the user does not currently hold returns
   * `null`. Sets `status = 'revoked'` + `revoked_at`; the row is kept for audit.
   */
  revoke(input: RevokeEntitlementInput, tx?: Transaction): Promise<EntitlementRecord | null>;
}

export interface EconomyRepositories {
  entitlements: EntitlementRepository;
}
