/**
 * In-process counter registry (Phase 1 §16).
 *
 * Deliberately tiny: a single-instance server keeps monotonic counters in
 * memory and exposes them at `GET /metrics`. Phase 2/7 replaces this with a
 * real metrics backend; the call sites (`metrics.inc(...)`) stay the same.
 *
 * Label values must be low-cardinality, non-PII strings (an error code, a
 * limiter name) — never a user id, token or free-text payload.
 */

type Labels = Record<string, string>;

const counters = new Map<string, number>();

function keyOf(name: string, labels?: Labels): string {
  if (!labels || Object.keys(labels).length === 0) return name;
  const parts = Object.keys(labels)
    .sort()
    .map((k) => `${k}=${labels[k]}`);
  return `${name}{${parts.join(',')}}`;
}

export const metrics = {
  inc(name: string, labels?: Labels, by = 1): void {
    const key = keyOf(name, labels);
    counters.set(key, (counters.get(key) ?? 0) + by);
  },

  /** Flat `{ "name{label=value}": count }` map — safe to serve unauthenticated. */
  snapshot(): Record<string, number> {
    return Object.fromEntries([...counters.entries()].sort(([a], [b]) => a.localeCompare(b)));
  },

  /** Test helper. */
  reset(): void {
    counters.clear();
  },
};
