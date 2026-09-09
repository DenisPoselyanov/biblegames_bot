/**
 * Safe frontend error reporting (Phase 2 §20).
 *
 * Captures `window.onerror` + unhandled promise rejections (and, via
 * `reportClientError`, React error-boundary catches), and POSTs a **minimal**
 * report to `/api/v1/client-errors`: the current route, the build version, a
 * coarse `code`, a level, and a truncated message. Never a stack with local
 * paths, never a payload, never user data.
 *
 * Fire-and-forget (`sendBeacon`, falling back to `keepalive` fetch), hard-capped
 * per page load, and de-duplicated — a render loop cannot spam the endpoint.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL as string | undefined;
const ENDPOINT = '/api/v1/client-errors';
const MAX_PER_LOAD = 10;
const DEDUPE_WINDOW_MS = 10_000;

let sent = 0;
const recent = new Map<string, number>();

function buildVersion(): string {
  try {
    return __APP_VERSION__;
  } catch {
    return 'unknown';
  }
}

function truncate(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export interface ClientErrorInput {
  code: string;
  level?: 'error' | 'warn';
  message?: string;
}

export function reportClientError({ code, level = 'error', message }: ClientErrorInput): void {
  if (!API_BASE || sent >= MAX_PER_LOAD) return;

  const now = Date.now();
  const dedupeKey = `${code}|${message ?? ''}`;
  const last = recent.get(dedupeKey);
  if (last && now - last < DEDUPE_WINDOW_MS) return;
  recent.set(dedupeKey, now);

  const body = JSON.stringify({
    route: window.location.pathname.slice(0, 200),
    buildVersion: buildVersion().slice(0, 80),
    code: code.toLowerCase().replace(/[^a-z0-9_.-]/g, '_').slice(0, 64) || 'unknown',
    level,
    message: truncate(message, 300),
  });

  sent += 1;
  const url = `${API_BASE}${ENDPOINT}`;
  try {
    if (navigator.sendBeacon?.(url, new Blob([body], { type: 'application/json' }))) return;
  } catch {
    /* fall through to fetch */
  }
  void fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {});
}

let installed = false;

export function installErrorReporter(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (event) => {
    reportClientError({
      code: 'window_error',
      message: event.message || (event.error instanceof Error ? event.error.message : undefined),
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    reportClientError({
      code: 'unhandled_rejection',
      message: reason instanceof Error ? reason.message : truncate(String(reason), 300),
    });
  });
}
