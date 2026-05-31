const DEFAULT_TTL_MS = Number(process.env.BOLLS_CACHE_TTL_MS || 72 * 60 * 60 * 1000);
const MAX_ENTRIES = Number(process.env.BOLLS_CACHE_MAX || 500);

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs = DEFAULT_TTL_MS): void {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** Вірш дня: один запис на календарний день і переклад */
export function dailyCacheKey(translation: string, dateIso: string): string {
  return `daily:${translation}:${dateIso}`;
}
