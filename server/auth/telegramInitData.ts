import crypto from 'node:crypto';
import type { AuthenticatedPrincipal, VerifyResult } from './principal';

export interface VerifyOptions {
  /** Max age of `auth_date` in seconds. Older initData is rejected as `expired`. */
  maxAgeSec: number;
  /** Injectable clock for tests. */
  now?: Date;
  /** Small allowance for clock skew on future-dated `auth_date`, in seconds. */
  clockSkewSec?: number;
}

interface TelegramUser {
  id?: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

function deriveDisplayName(user: TelegramUser): string {
  const full = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return full || user.username || 'User';
}

/**
 * Verify a Telegram Web App `initData` string per the official Bot API algorithm
 * (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app).
 *
 * Hardened per Phase 1 §5.2 / ADR-002:
 *  - `hash` is required and must be the only `hash` key;
 *  - the data-check-string is built once from the remaining keys, sorted;
 *  - the secret key is `HMAC_SHA256("WebAppData", botToken)`;
 *  - comparison is length-guarded and `crypto.timingSafeEqual`;
 *  - `auth_date` freshness is enforced;
 *  - `user` is parsed defensively and must carry a numeric id.
 *
 * Pure function: no environment reads, no logging of the raw initData.
 */
export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  opts: VerifyOptions,
): VerifyResult {
  if (!initData || typeof initData !== 'string') {
    return { ok: false, code: 'missing_credentials' };
  }
  if (!botToken) {
    return { ok: false, code: 'auth_not_configured' };
  }

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return { ok: false, code: 'missing_hash' };
  }

  const hashes = params.getAll('hash');
  if (hashes.length !== 1 || !hashes[0]) {
    return { ok: false, code: 'missing_hash' };
  }
  const providedHash = hashes[0];

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculatedHex = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  const providedBuf = Buffer.from(providedHash, 'hex');
  const calculatedBuf = Buffer.from(calculatedHex, 'hex');
  if (
    providedBuf.length === 0 ||
    providedBuf.length !== calculatedBuf.length ||
    !crypto.timingSafeEqual(providedBuf, calculatedBuf)
  ) {
    return { ok: false, code: 'bad_hash' };
  }

  const now = opts.now ?? new Date();
  const authDateRaw = params.get('auth_date');
  const authDateSec = Number(authDateRaw);
  if (!authDateRaw || !Number.isFinite(authDateSec) || authDateSec <= 0) {
    return { ok: false, code: 'expired' };
  }
  const nowSec = Math.floor(now.getTime() / 1000);
  const skew = opts.clockSkewSec ?? 60;
  if (authDateSec - nowSec > skew) {
    return { ok: false, code: 'expired' };
  }
  if (nowSec - authDateSec > opts.maxAgeSec) {
    return { ok: false, code: 'expired' };
  }

  const userRaw = params.get('user');
  if (!userRaw) {
    return { ok: false, code: 'missing_user' };
  }
  let user: TelegramUser;
  try {
    user = JSON.parse(userRaw) as TelegramUser;
  } catch {
    return { ok: false, code: 'malformed_user' };
  }
  if (!user || typeof user !== 'object' || typeof user.id !== 'number' || !Number.isFinite(user.id)) {
    return { ok: false, code: 'malformed_user' };
  }

  const telegramUserId = String(user.id);
  const principal: AuthenticatedPrincipal = {
    userId: telegramUserId,
    telegramUserId,
    displayName: deriveDisplayName(user),
    username: user.username || undefined,
    languageCode: user.language_code || undefined,
    authenticatedAt: now.toISOString(),
    authSource: 'telegram',
  };
  return { ok: true, principal };
}
