import { getTelegramInitData } from '../lib/telegram';

const API_BASE = import.meta.env.VITE_API_BASE_URL as string | undefined;

export function hasApi(): boolean {
  return Boolean(API_BASE);
}

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export async function apiFetch(path: string, userId: string, init?: RequestInit): Promise<Response> {
  const initData = getTelegramInitData();
  return fetch(apiUrl(path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
      ...(initData ? { 'x-telegram-init-data': initData } : {}),
      ...(init?.headers ?? {}),
    },
  });
}

