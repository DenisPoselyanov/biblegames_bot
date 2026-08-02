import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const AUTH_STRICT = process.env.TELEGRAM_AUTH_STRICT === 'true';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

function validateInitData(initData: string, botToken: string): { ok: boolean; userId?: string } {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return { ok: false };

    params.delete('hash');
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculated = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (calculated !== hash) return { ok: false };

    const userRaw = params.get('user');
    if (!userRaw) return { ok: true };
    const user = JSON.parse(userRaw) as { id?: number };
    return { ok: true, userId: user.id?.toString() };
  } catch {
    return { ok: false };
  }
}

/**
 * Production must never trust `x-user-id` on its own (ADR-002 / R-006): a valid,
 * HMAC-verified `x-telegram-init-data` is required regardless of
 * TELEGRAM_AUTH_STRICT, and regardless of whether TELEGRAM_BOT_TOKEN happens to
 * be configured — an unconfigured bot token in production is a deploy
 * misconfiguration, not a license to fall back to client-trusted identity.
 * Non-production keeps the permissive dev fallback so local/CI workflows that
 * don't send real Telegram initData keep working.
 */
export function telegramAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const headerUserId = req.header('x-user-id');
  if (!headerUserId) {
    res.status(401).json({ error: 'missing_user_header' });
    return;
  }

  const initData = req.header('x-telegram-init-data');

  if (initData) {
    if (!BOT_TOKEN) {
      if (IS_PRODUCTION) {
        res.status(500).json({ error: 'telegram_auth_not_configured' });
        return;
      }
      next();
      return;
    }

    const result = validateInitData(initData, BOT_TOKEN);
    if (!result.ok) {
      res.status(401).json({ error: 'invalid_telegram_init_data' });
      return;
    }
    if (result.userId && result.userId !== headerUserId) {
      res.status(403).json({ error: 'user_id_mismatch' });
      return;
    }
    next();
    return;
  }

  if (IS_PRODUCTION || (AUTH_STRICT && BOT_TOKEN)) {
    res.status(401).json({ error: 'missing_telegram_init_data' });
    return;
  }

  next();
}
