/**
 * Canonical contract version (Phase 2 §8).
 *
 * Bump the MAJOR only when a *shipped* request/response/event contract changes in a
 * backward-incompatible way (removed field, narrowed type, changed semantics). Adding
 * an optional field or a new endpoint does not require a bump.
 *
 * The value is surfaced on every `/api/v1` response via `CONTRACT_VERSION_HEADER` so
 * clients and logs can correlate a payload shape with the code that produced it
 * (§20 "content version in responses/logs").
 */
export const CONTRACT_VERSION = '1.0.0' as const;

export const CONTRACT_VERSION_HEADER = 'x-contract-version' as const;
