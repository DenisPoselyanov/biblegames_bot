/**
 * The single query-key factory for server-owned state (Phase 2 §13.2).
 *
 * Keys are hierarchical so a broad invalidation works: `invalidateQueries({
 * queryKey: queryKeys.me.root() })` drops every `me/*` entry. Self-scoped data
 * still carries the resolved `userId` as the last segment — the API is
 * principal-scoped, but the dev-identity fallback can switch users on one device
 * and a stale cache must not bleed across.
 *
 * Do not duplicate the same object in Context, Zustand, localStorage AND the
 * Query cache (§13.2) — the Query cache is the source of truth for these.
 */
export const queryKeys = {
  me: {
    root: () => ['me'] as const,
    profile: (userId: string) => ['me', 'profile', userId] as const,
    progress: (userId: string) => ['me', 'progress', userId] as const,
    wallet: (userId: string) => ['me', 'wallet', userId] as const,
    stats: (userId: string) => ['me', 'stats', userId] as const,
  },
  learning: {
    root: () => ['learning'] as const,
    today: (userId: string) => ['learning', 'today', userId] as const,
    plan: (planId: string) => ['learning', 'plan', planId] as const,
  },
  practice: {
    root: () => ['practice'] as const,
    session: (sessionId: string) => ['practice', 'session', sessionId] as const,
  },
  content: {
    root: () => ['content'] as const,
    /** The published content set is immutable per version — cache it hard. */
    publishedVersion: () => ['content', 'publishedVersion'] as const,
  },
  kahoot: {
    root: () => ['kahoot'] as const,
    room: (roomId: string) => ['kahoot', 'room', roomId] as const,
  },
} as const;

/**
 * Key prefixes whose payload may be persisted to disk (§13.3): the last server
 * snapshot and published immutable content. Everything else — and in particular
 * wallet / rank / current competitive result — is memory-only and is never
 * trusted solely from local cache.
 */
export const OFFLINE_CACHEABLE_PREFIXES = [
  ['me', 'profile'],
  ['content', 'publishedVersion'],
] as const;

export function isOfflineCacheable(key: readonly unknown[]): boolean {
  return OFFLINE_CACHEABLE_PREFIXES.some((prefix) =>
    prefix.every((segment, i) => key[i] === segment),
  );
}
