import { createJSONStorage } from 'zustand/middleware';

function isPersistEnvelope(value: unknown): value is { state: Record<string, unknown> } {
  return Boolean(value && typeof value === 'object' && 'state' in value);
}

/** Flat legacy JSON in localStorage ↔ zustand persist envelope with one field. */
export function createFieldJsonStorage<T>(field: string, isLegacyPayload: (parsed: unknown) => parsed is T) {
  return createJSONStorage(() => ({
    getItem: (name) => {
      const raw = localStorage.getItem(name);
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (isPersistEnvelope(parsed)) return raw;
        if (isLegacyPayload(parsed)) {
          return JSON.stringify({ state: { [field]: parsed }, version: 0 });
        }
      } catch {
        /* ignore */
      }
      return null;
    },
    setItem: (name, value) => {
      try {
        const wrapper = JSON.parse(value) as { state?: Record<string, unknown> };
        const payload = wrapper.state?.[field];
        if (payload !== undefined) {
          localStorage.setItem(name, JSON.stringify(payload));
        }
      } catch {
        /* ignore */
      }
    },
    removeItem: (name) => {
      localStorage.removeItem(name);
    },
  }));
}
