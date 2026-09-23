/**
 * Stable content hashing (Phase 2 §14 — "a published content set has a stable
 * version/hash"; Phase 4 WS2, ADR-019 §4 — shared by `content` and `learning`
 * so both domains' revision-body hashing use one canonicalization rule).
 * Dependency-free (`node:crypto` only).
 *
 * The hash is over a canonical JSON form with sorted object keys, so two
 * revisions with the same body but different field order / whitespace collide
 * — that is what makes it a dedup key.
 */
import { createHash } from 'node:crypto';

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, canonicalize(v)]),
    );
  }
  return value;
}

/** sha-256 hex of the canonical JSON of `value`. */
export function stableHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}
