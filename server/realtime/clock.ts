/**
 * Realtime clock service (Phase 2 §15).
 *
 * The realtime gateway stamps every `RealtimeEvent` with `serverTime` from here,
 * and Kahoot timers (`questionEndsAt`, `thinkEndsAt`) are computed against the
 * same source. Injecting it keeps tests deterministic and gives Phase 5 one
 * place to swap in an NTP-corrected clock.
 */
export interface Clock {
  /** Epoch milliseconds. */
  now(): number;
  /** ISO-8601 string for the current instant. */
  nowIso(): string;
}

export const systemClock: Clock = {
  now: () => Date.now(),
  nowIso: () => new Date().toISOString(),
};

/** Test double — advances only when `set`/`advance` is called. */
export function createFixedClock(startMs = 0): Clock & {
  set: (ms: number) => void;
  advance: (ms: number) => void;
} {
  let current = startMs;
  return {
    now: () => current,
    nowIso: () => new Date(current).toISOString(),
    set: (ms) => {
      current = ms;
    },
    advance: (ms) => {
      current += ms;
    },
  };
}
