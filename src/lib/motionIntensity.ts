/** User-selected motion intensity (MOTION_SYSTEM.md §25) — a separate axis from
 * the OS/browser `prefers-reduced-motion` signal. No server preference field
 * exists yet (Phase 2's `/me/preferences` doesn't cover it) — WS8 owns wiring
 * a settings-screen control to a persisted field; until then this is a
 * client-only, localStorage-backed default so the mechanism isn't blocked on
 * that backend work. */
export type MotionIntensity = 'full' | 'reduced' | 'minimal';

const STORAGE_KEY = 'bible-game-motion-intensity';
const VALID: readonly MotionIntensity[] = ['full', 'reduced', 'minimal'];

export function loadMotionIntensity(): MotionIntensity {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return (VALID as readonly string[]).includes(raw ?? '') ? (raw as MotionIntensity) : 'full';
  } catch {
    return 'full';
  }
}

export function saveMotionIntensity(intensity: MotionIntensity): void {
  try {
    localStorage.setItem(STORAGE_KEY, intensity);
  } catch {
    /* noop */
  }
}
