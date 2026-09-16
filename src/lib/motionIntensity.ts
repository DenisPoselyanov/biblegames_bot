/** User-selected motion intensity (MOTION_SYSTEM.md §25) — a separate axis from
 * the OS/browser `prefers-reduced-motion` signal. This localStorage copy is
 * the instant, offline-safe source of truth for rendering (read
 * synchronously at `MotionProvider` mount); `/me/preferences`' `motionIntensity`
 * (WS8) is a best-effort cross-device backup only — it never overrides an
 * explicit local choice, see `MotionProvider.setIntensity` and
 * `hasStoredMotionIntensity` below. */
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

/** True once the user (this device) has ever set an intensity explicitly —
 * distinguishes "never chosen, showing the `full` fallback" from a real
 * choice, so a Settings screen can safely hydrate from a server value only
 * in the former case. */
export function hasStoredMotionIntensity(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return (VALID as readonly string[]).includes(raw ?? '');
  } catch {
    return false;
  }
}

export function saveMotionIntensity(intensity: MotionIntensity): void {
  try {
    localStorage.setItem(STORAGE_KEY, intensity);
  } catch {
    /* noop */
  }
}
