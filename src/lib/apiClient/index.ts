/**
 * The single typed client for the self-scoped `/api/v1` surface (Phase 2 §13.4).
 * Repos and domain hooks call {@link apiRequest}; raw callers that need a bare
 * `Response` (kahoot exports, scripture proxy) use {@link apiUrl} + {@link authHeaders}.
 */
export { apiRequest, apiUrl, hasApi } from './request';
export type { ApiRequestOptions, HttpMethod } from './request';
export { authHeaders } from './auth';
export { ApiError, ApiNetworkError, parseApiError } from './errors';
export { newRequestId } from './requestId';
export {
  DEFAULT_RETRY,
  NO_RETRY,
  mayAutoRetry,
  retryDelayMs,
  type RetryPolicy,
} from './retry';
