/**
 * Per-request correlation id. Sent as `x-request-id` on every `/api/v1` call and
 * echoed back by the server (`server/middleware/requestId.ts`, which accepts an
 * inbound id matching `/^[\w-]{8,128}$/` and otherwise mints its own). Keeping the
 * id client-generated lets a failed request be correlated with a server log line
 * even when the response never arrives.
 */
export function newRequestId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through to the manual id */
  }
  return `rid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
