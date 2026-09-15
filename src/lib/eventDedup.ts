/**
 * Authoritative-celebration idempotency (ADR-010 §4.3, MOTION_SYSTEM.md §21
 * "Reconnect" — "do not replay old answer or victory animations; only new
 * authoritative event IDs animate"). A celebration (level up, rank up,
 * achievement, purchase success, …) is tied to a stable server event/result
 * ID; re-seeing that same ID after a remount, reload or reconnect must not
 * replay it. Backed by localStorage so it survives reload, not just remount.
 */

const STORAGE_KEY = 'bible-game-motion-consumed-events';
const MAX_TRACKED = 500;

let cache: Set<string> | null = null;

function loadCache(): Set<string> {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const ids = raw ? (JSON.parse(raw) as string[]) : [];
    cache = new Set(ids);
  } catch {
    cache = new Set();
  }
  return cache;
}

function persist(ids: Set<string>): void {
  try {
    // Insertion order is preserved by Set iteration; keep only the most recent
    // MAX_TRACKED so this never grows unbounded across a long session.
    const trimmed = Array.from(ids).slice(-MAX_TRACKED);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    /* noop — dedup degrades to in-memory-only for this session */
  }
}

/**
 * Marks `eventId` as consumed and returns whether this is the first time it's
 * been seen. Returns `true` exactly once per ID (ever, across reloads);
 * `false` on every subsequent call for the same ID.
 */
export function consumeEventOnce(eventId: string): boolean {
  const ids = loadCache();
  if (ids.has(eventId)) return false;
  ids.add(eventId);
  persist(ids);
  return true;
}

/** Test/fixture-only: clears all tracked event IDs. */
export function resetEventDedupForTests(): void {
  cache = new Set();
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}
