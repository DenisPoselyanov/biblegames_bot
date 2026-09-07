import { getTelegramInitData } from '../lib/telegram';

const API_BASE = import.meta.env.VITE_API_BASE_URL as string | undefined;

export function hasApi(): boolean {
  return Boolean(API_BASE);
}

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

/**
 * Self-scoped `/api/v1/*` fetch. Identity is the verified Telegram principal
 * (`req.auth`) only — the server derives the user from `x-telegram-init-data`.
 * `x-user-id` is sent solely as the dev-identity fallback for local runs
 * without Telegram (server `AUTH_MODE=development`).
 */
export async function apiV1Fetch(path: string, init?: RequestInit): Promise<Response> {
  const initData = getTelegramInitData();
  return fetch(apiUrl(`/api/v1${path}`), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(initData ? { 'x-telegram-init-data': initData } : {}),
      // Dev-identity fallback for local runs without Telegram (server AUTH_MODE=development).
      ...(initData ? {} : { 'x-user-id': readDevUserId() }),
      ...(init?.headers ?? {}),
    },
  });
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

export interface ApiError {
  code: string;
  message: string;
}

export async function readApiError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as { error?: ApiError };
    if (body?.error?.code) return body.error;
  } catch {
    /* fall through */
  }
  return { code: `http_${response.status}`, message: response.statusText };
}

