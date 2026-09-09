import type { ZodType } from 'zod';
import { authHeaders } from './auth';
import { ApiError, ApiNetworkError, parseApiError } from './errors';
import { newRequestId } from './requestId';
import {
  DEFAULT_RETRY,
  mayAutoRetry,
  NO_RETRY,
  retryDelayMs,
  sleep,
  type RetryPolicy,
} from './retry';

const API_BASE = import.meta.env.VITE_API_BASE_URL as string | undefined;

/** Whether an `/api/v1` base URL is configured (else the app runs fully local). */
export function hasApi(): boolean {
  return Boolean(API_BASE);
}

/** Absolute URL for an arbitrary server path (kahoot, scripture, …). */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface ApiRequestOptions<T> {
  method?: HttpMethod;
  /** JSON request body. Omitted from the wire when `undefined`. */
  body?: unknown;
  /** Zod schema the JSON response is validated against (§13.4). */
  schema?: ZodType<T>;
  /**
   * What to do when `schema` rejects the response:
   * - `throw` (default): surface an `invalid_response` {@link ApiError};
   * - `warn`: log once and return the raw payload — used by the legacy command
   *   repos during the WS4 cutover so a schema that is merely stale cannot
   *   silently disable server authority.
   */
  onInvalidResponse?: 'throw' | 'warn';
  /**
   * Present ⇒ the command is safe to auto-retry despite being non-idempotent;
   * also sent as the `idempotency-key` header.
   */
  idempotencyKey?: string;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /** Override / disable the retry budget. */
  retry?: Partial<RetryPolicy> | false;
  /** Response statuses to resolve as `null` instead of throwing (e.g. `[404]`). */
  nullStatuses?: number[];
}

function isAbort(err: unknown): boolean {
  return err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError');
}

function fieldErrorsFromZod(error: { flatten: () => { fieldErrors: Record<string, string[] | undefined> } }) {
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(error.flatten().fieldErrors)) {
    if (value?.length) out[key] = value;
  }
  return out;
}

/**
 * The one typed entry point for the self-scoped `/api/v1` surface. Attaches
 * identity + a correlation id, parses the §7.5 error envelope, optionally
 * validates the response against a contract schema, honours an `AbortSignal`,
 * and retries only what is safe to retry.
 */
export async function apiRequest<T = unknown>(
  path: string,
  opts: ApiRequestOptions<T> = {},
): Promise<T> {
  if (!API_BASE) {
    throw new ApiError({
      status: 0,
      code: 'api_not_configured',
      message: 'No VITE_API_BASE_URL configured',
      retryable: false,
    });
  }

  const method: HttpMethod = opts.method ?? 'GET';
  const policy: RetryPolicy =
    opts.retry === false ? NO_RETRY : { ...DEFAULT_RETRY, ...(opts.retry ?? {}) };
  const retryable = policy.maxRetries > 0 && mayAutoRetry(method, Boolean(opts.idempotencyKey));
  const requestId = newRequestId();
  const url = apiUrl(`/api/v1${path}`);

  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        signal: opts.signal,
        headers: {
          'content-type': 'application/json',
          'x-request-id': requestId,
          ...authHeaders(),
          ...(opts.idempotencyKey ? { 'idempotency-key': opts.idempotencyKey } : {}),
          ...(opts.headers ?? {}),
        },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      });
    } catch (err) {
      if (isAbort(err)) throw err;
      if (retryable && attempt < policy.maxRetries) {
        await sleep(retryDelayMs(attempt, policy));
        continue;
      }
      throw new ApiNetworkError('Network request failed', { cause: err, requestId });
    }

    if (opts.nullStatuses?.includes(response.status)) return null as T;

    if (!response.ok) {
      const apiErr = await parseApiError(response, requestId);
      if (retryable && apiErr.retryable && attempt < policy.maxRetries) {
        await sleep(retryDelayMs(attempt, policy));
        continue;
      }
      throw apiErr;
    }

    if (response.status === 204) return undefined as T;

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      json = undefined;
    }

    if (!opts.schema) return json as T;

    const parsed = opts.schema.safeParse(json);
    if (parsed.success) return parsed.data;

    if ((opts.onInvalidResponse ?? 'throw') === 'warn') {
      console.warn(`[apiClient] ${method} ${path} response failed contract validation`, parsed.error.issues);
      return json as T;
    }
    throw new ApiError({
      status: response.status,
      code: 'invalid_response',
      message: `Response failed contract validation for ${method} ${path}`,
      requestId,
      retryable: false,
      fieldErrors: fieldErrorsFromZod(parsed.error),
    });
  }
}
