/**
 * Low-end device heuristic (MOTION_SYSTEM.md §26). Device tier must never
 * alter business logic or final state — only motion richness (particle
 * count, blur, stagger, shadow layers).
 */
export type DeviceTier = 'standard' | 'low-end';

const LOW_MEMORY_GB = 2;
const LOW_CORE_COUNT = 2;
const JANK_SAMPLE_MS = 700;
/** A frame budget more than double 60fps (~16.7ms) counts as janky. */
const JANK_FRAME_MS = 34;
/** Share of sampled frames that must be janky to upgrade the tier. */
const JANK_RATIO_THRESHOLD = 0.3;

interface NavigatorWithDeviceHints extends Navigator {
  deviceMemory?: number;
}

/**
 * One-shot static heuristic from memory + logical cores. Cheap, synchronous,
 * safe to call outside React. Telegram WebView-specific signals (platform,
 * version) aren't factored in yet — no concrete threshold to anchor them to;
 * flagged here rather than guessed.
 */
export function computeStaticDeviceTier(): DeviceTier {
  if (typeof navigator === 'undefined') return 'standard';
  const nav = navigator as NavigatorWithDeviceHints;

  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= LOW_MEMORY_GB) {
    return 'low-end';
  }
  if (
    typeof nav.hardwareConcurrency === 'number' &&
    nav.hardwareConcurrency <= LOW_CORE_COUNT
  ) {
    return 'low-end';
  }
  return 'standard';
}

/**
 * Samples real frame timing for `JANK_SAMPLE_MS` via requestAnimationFrame
 * and reports whether the device is dropping frames badly enough to warrant
 * downgrading to low-end mode — catches devices the static heuristic misses
 * (throttled/thermal-limited hardware, an overloaded Telegram WebView).
 * No-ops (never calls back) in non-browser environments.
 */
export function sampleFrameJank(onResult: (janky: boolean) => void): () => void {
  if (typeof requestAnimationFrame === 'undefined') return () => {};

  let last = performance.now();
  let jankyFrames = 0;
  let totalFrames = 0;
  let rafId = 0;
  let cancelled = false;

  const tick = (now: number) => {
    const delta = now - last;
    last = now;
    totalFrames += 1;
    if (delta > JANK_FRAME_MS) jankyFrames += 1;

    if (now < startedAt + JANK_SAMPLE_MS) {
      rafId = requestAnimationFrame(tick);
      return;
    }
    if (!cancelled && totalFrames > 0) {
      onResult(jankyFrames / totalFrames >= JANK_RATIO_THRESHOLD);
    }
  };

  const startedAt = performance.now();
  rafId = requestAnimationFrame(tick);

  return () => {
    cancelled = true;
    cancelAnimationFrame(rafId);
  };
}
