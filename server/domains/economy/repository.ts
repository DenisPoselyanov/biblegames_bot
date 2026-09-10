/**
 * Economy domain repository contracts (Phase 2 §10).
 *
 * Interfaces only. `wallet_ledger` predates the `domains/` layout and keeps its
 * home under `server/wallet/`; this barrel currently exposes only the
 * entitlements repository, with room for the Phase 6 catalog / ledger repos.
 */
export type {
  EconomyRepositories,
  EntitlementRepository,
} from './entitlements';
export type {
  EntitlementProductKind,
  EntitlementRecord,
  EntitlementSourceType,
  EntitlementStatus,
  GrantEntitlementInput,
  RevokeEntitlementInput,
} from './types';
