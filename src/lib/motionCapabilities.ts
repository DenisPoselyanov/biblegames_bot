import type { DeviceTier } from './deviceTier';
import type { MotionIntensity } from './motionIntensity';

export interface DerivedMotionCapabilities {
  effectiveIntensity: MotionIntensity;
  particlesAllowed: boolean;
  hapticAllowed: boolean;
  soundAllowed: boolean;
}

/**
 * Pure derivation of §6.1's particles/haptic/sound gates from the raw
 * inputs `MotionProvider` collects (system `prefers-reduced-motion`, the
 * user's chosen intensity, and the sampled device tier). Extracted out of
 * the provider's `useMemo` so this rule — system reduced motion always wins
 * (§24), minimal never gets haptics, only full+non-low-end gets particles —
 * is unit-testable without a React rendering harness.
 */
export function deriveMotionCapabilities(
  systemReducedMotion: boolean,
  intensity: MotionIntensity,
  deviceTier: DeviceTier,
): DerivedMotionCapabilities {
  const effectiveIntensity: MotionIntensity = systemReducedMotion ? 'minimal' : intensity;
  return {
    effectiveIntensity,
    particlesAllowed: effectiveIntensity === 'full' && deviceTier !== 'low-end',
    hapticAllowed: effectiveIntensity !== 'minimal',
    soundAllowed: effectiveIntensity === 'full',
  };
}
