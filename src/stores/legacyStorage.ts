import { createJSONStorage } from 'zustand/middleware';

function isPersistEnvelope(value: unknown): value is { state: Record<string, unknown> } {
  return Boolean(value && typeof value === 'object' && 'state' in value);
}

/** Flat JSON written by a previous version of this storage adapter: `{ [field]: T, __v: number }`. */
function isVersionedFlatPayload(
  value: unknown,
  field: string,
): value is Record<string, unknown> & { __v: number } {
  return Boolean(value && typeof value === 'object' && '__v' in (value as object) && field in (value as object));
}

/**
 * Flat JSON in localStorage ↔ zustand persist envelope with one field.
 *
 * Round-trips the persist `version` through a `__v` sibling key on the flat
 * payload, so zustand's own `version`/`migrate` machinery works correctly even
 * though this adapter stores flat JSON instead of the raw persist envelope.
 * Data written before this `__v` round-trip existed (or by any pre-versioning
 * build) has no `__v` key and is treated as version 0.
 */
export function createFieldJsonStorage<T>(field: string, isLegacyPayload: (parsed: unknown) => parsed is T) {
  return createJSONStorage(() => ({
    getItem: (name) => {
      const raw = localStorage.getItem(name);
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (isPersistEnvelope(parsed)) return raw;
        if (isVersionedFlatPayload(parsed, field)) {
          return JSON.stringify({ state: { [field]: parsed[field] }, version: parsed.__v });
        }
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
        const wrapper = JSON.parse(value) as { state?: Record<string, unknown>; version?: number };
        const payload = wrapper.state?.[field];
        if (payload !== undefined) {
          localStorage.setItem(name, JSON.stringify({ [field]: payload, __v: wrapper.version ?? 0 }));
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
