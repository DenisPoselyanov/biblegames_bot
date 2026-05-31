import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const AUTH_STRICT = process.env.TELEGRAM_AUTH_STRICT === 'true';

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

export function telegramAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const headerUserId = req.header('x-user-id');
  if (!headerUserId) {
    res.status(401).json({ error: 'missing_user_header' });
    return;
  }

  const initData = req.header('x-telegram-init-data');
  if (BOT_TOKEN && initData) {
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

  if (AUTH_STRICT && BOT_TOKEN) {
    res.status(401).json({ error: 'missing_telegram_init_data' });
    return;
  }

  next();
}
