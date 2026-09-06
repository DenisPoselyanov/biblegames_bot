/**
 * The single typed identity that every authenticated HTTP request and Socket.IO
 * connection carries after Phase 1 auth (ADR-002). Domain code reads this and
 * never `x-user-id`, route params, query or body for identity.
 */
export interface AuthenticatedPrincipal {
  /** Canonical application user id. Currently the Telegram user id as a string. */
  userId: string;
  /** Raw Telegram user id, kept distinct from `userId` for future id remapping. */
  telegramUserId: string;
  /** Best-effort human label ("First Last" | username | "User"). Display only. */
  displayName: string;
  username?: string;
  languageCode?: string;
  /** ISO timestamp of when this principal was verified for the current request. */
  authenticatedAt: string;
  /**
   * `telegram` — verified Telegram initData.
   * `development` — explicit AUTH_MODE=development fixture identity, impossible in production.
   */
  authSource: 'telegram' | 'development';
}

/** Stable machine-readable auth failure codes returned to the client. */
export type AuthErrorCode =
  | 'missing_credentials'
  | 'missing_hash'
  | 'bad_hash'
  | 'expired'
  | 'malformed_user'
  | 'missing_user'
  | 'auth_not_configured'
  | 'dev_identity_unavailable';

export type VerifyResult =
  | { ok: true; principal: AuthenticatedPrincipal }
  | { ok: false; code: AuthErrorCode };
