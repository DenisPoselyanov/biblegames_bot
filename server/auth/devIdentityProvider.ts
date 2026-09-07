import type { ServerConfig } from '../config/env';
import type { AuthenticatedPrincipal } from './principal';

/**
 * Deterministic fixture identity for local/CI work (Phase 1 §5.4).
 *
 * Enabled ONLY when `nodeEnv !== 'production'` AND `authMode === 'development'`.
 * `assertProductionConfig` guarantees the second condition can never hold in
 * production, so this code path is technically impossible there.
 */
export function isDevIdentityEnabled(config: ServerConfig): boolean {
  return !config.isProduction && config.authMode === 'development';
}

export interface DevIdentityInput {
  userId?: string | null;
  displayName?: string | null;
}

export function resolveDevPrincipal(
  input: DevIdentityInput,
  now: Date = new Date(),
): AuthenticatedPrincipal | null {
  const userId = (input.userId ?? '').trim();
  if (!userId) return null;
  return {
    userId,
    telegramUserId: userId,
    displayName: (input.displayName ?? '').trim() || `Dev ${userId}`,
    authenticatedAt: now.toISOString(),
    authSource: 'development',
  };
}
