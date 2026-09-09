import { getTelegramInitData } from '../telegram';

/**
 * Identity headers for a self-scoped `/api/v1/*` call. The server derives the
 * user from the verified Telegram principal (`x-telegram-init-data`); `x-user-id`
 * is only the dev-identity fallback for local runs without Telegram (server
 * `AUTH_MODE=development`). Never send both.
 */
export function authHeaders(): Record<string, string> {
  const initData = getTelegramInitData();
  if (initData) return { 'x-telegram-init-data': initData };
  return { 'x-user-id': readDevUserId() };
}

function readDevUserId(): string {
  try {
    return (
      (window as unknown as { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { id?: number } } } } })
        .Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() ?? 'guest'
    );
  } catch {
    return 'guest';
  }
}
