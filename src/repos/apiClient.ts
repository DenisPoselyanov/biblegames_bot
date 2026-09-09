/**
 * Compatibility surface for repos not yet ported to the typed client
 * (`src/lib/apiClient`). New code should import `apiRequest` from there; this
 * module stays only for the raw-`Response` callers (`statsRepo`, `studyRepo`,
 * kahoot exports) during the WS4 cutover.
 */
import { apiUrl, authHeaders, newRequestId, parseApiError } from '../lib/apiClient';

export { apiUrl, hasApi } from '../lib/apiClient';

/**
 * Self-scoped `/api/v1/*` fetch returning the raw `Response`. Identity is the
 * verified Telegram principal; `x-user-id` is only the dev fallback. Every call
 * carries a client-generated `x-request-id` for log correlation.
 */
export async function apiV1Fetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(`/api/v1${path}`), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-request-id': newRequestId(),
      ...authHeaders(),
      ...(init?.headers ?? {}),
    },
  });
}

export interface ApiError {
  code: string;
  message: string;
}

/** @deprecated use `parseApiError` from `src/lib/apiClient` (returns a typed `ApiError`). */
export async function readApiError(response: Response): Promise<ApiError> {
  const err = await parseApiError(response);
  return { code: err.code, message: err.message };
}
