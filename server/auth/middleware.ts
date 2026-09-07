import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { ServerConfig } from '../config/env';
import { serverFlag } from '../lib/flags';
import { telegramAuthMiddleware } from '../middleware/telegramAuth';
import { UnauthorizedError } from '../lib/errors';
import { verifyTelegramInitData } from './telegramInitData';
import { isDevIdentityEnabled, resolveDevPrincipal } from './devIdentityProvider';
import type { AuthErrorCode } from './principal';

const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  missing_credentials: 'Telegram initData is required',
  missing_hash: 'Telegram initData is malformed',
  bad_hash: 'Telegram initData signature is invalid',
  expired: 'Telegram initData has expired',
  malformed_user: 'Telegram initData user is malformed',
  missing_user: 'Telegram initData is missing the user field',
  auth_not_configured: 'Server authentication is not configured',
  dev_identity_unavailable: 'Development identity is not available',
};

/** Pull raw initData from the agreed header or `Authorization: tma <initData>`. */
export function readInitData(req: Request): string {
  const header = req.header('x-telegram-init-data');
  if (header) return header;
  const auth = req.header('authorization');
  if (auth && /^tma\s+/i.test(auth)) return auth.replace(/^tma\s+/i, '').trim();
  return '';
}

/**
 * Fail-closed request authentication (Phase 1 §5.3, ADR-002).
 *
 * - `authMode === 'telegram'`: a valid HMAC-verified, fresh Telegram initData is
 *   the ONLY accepted identity. `x-user-id` is never trusted.
 * - `authMode === 'development'` (non-production only): deterministic fixture
 *   identity from `x-user-id` / `x-user-name`.
 *
 * Gated by the `authV2` flag (default ON). `FEATURE_AUTHV2=false` is a one-release
 * break-glass that reverts to the legacy middleware.
 */
export function createRequireAuthenticated(config: ServerConfig): RequestHandler {
  const legacy = telegramAuthMiddleware;

  return function requireAuthenticated(req: Request, res: Response, next: NextFunction): void {
    if (!serverFlag('authV2', true)) {
      legacy(req, res, next);
      return;
    }

    if (isDevIdentityEnabled(config)) {
      const principal = resolveDevPrincipal({
        userId: req.header('x-user-id'),
        displayName: req.header('x-user-name'),
      });
      if (!principal) {
        next(new UnauthorizedError('dev_identity_unavailable', AUTH_ERROR_MESSAGES.dev_identity_unavailable));
        return;
      }
      req.auth = principal;
      next();
      return;
    }

    const initData = readInitData(req);
    const result = verifyTelegramInitData(initData, config.telegramBotToken, {
      maxAgeSec: config.authInitDataMaxAgeSec,
    });
    if (!result.ok) {
      next(new UnauthorizedError(result.code, AUTH_ERROR_MESSAGES[result.code]));
      return;
    }
    req.auth = result.principal;
    next();
  };
}
