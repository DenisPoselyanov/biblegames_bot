/** Retry budget for a single {@link apiRequest} call. */
export interface RetryPolicy {
  maxRetries: number;
  baseDelayMs: number;
}

export const DEFAULT_RETRY: RetryPolicy = { maxRetries: 2, baseDelayMs: 200 };
export const NO_RETRY: RetryPolicy = { maxRetries: 0, baseDelayMs: 0 };

/**
 * Whether a method is safe to auto-retry (§13.4). Idempotent by HTTP semantics
 * (GET/HEAD) is always safe; a mutation is retried ONLY when it carries an
 * explicit idempotency key, so the server can dedupe a replay. A non-idempotent
 * command with no key is never retried automatically.
 */
export function mayAutoRetry(method: string, hasIdempotencyKey: boolean): boolean {
  const m = method.toUpperCase();
  if (m === 'GET' || m === 'HEAD') return true;
  return hasIdempotencyKey;
}

/** Exponential backoff with a little jitter. */
export function retryDelayMs(attempt: number, policy: RetryPolicy): number {
  return policy.baseDelayMs * 2 ** attempt + Math.floor(Math.random() * 50);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
