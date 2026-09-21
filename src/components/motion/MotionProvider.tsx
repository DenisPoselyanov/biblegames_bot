import { LazyMotion, domAnimation, useReducedMotion } from 'framer-motion';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { computeStaticDeviceTier, sampleFrameJank, type DeviceTier } from '../../lib/deviceTier';
import {
  loadMotionIntensity,
  saveMotionIntensity,
  type MotionIntensity,
} from '../../lib/motionIntensity';
import { deriveMotionCapabilities } from '../../lib/motionCapabilities';
import { hasApi } from '../../repos/apiClient';
import { progressionRepo } from '../../repos/progressionRepo';
import { trackEvent } from '../../lib/telemetry';

export interface MotionCapabilities {
  /** OS/browser `prefers-reduced-motion` — always overrides `intensity` (§24). */
  systemReducedMotion: boolean;
  /** User-selected preference (§25), independent of the system setting. */
  intensity: MotionIntensity;
  setIntensity: (intensity: MotionIntensity) => void;
  /** `intensity`, forced to `minimal` whenever the system asks for reduced motion. */
  effectiveIntensity: MotionIntensity;
  deviceTier: DeviceTier;
  /** What new motion/celebration code should gate on — derived from
   * `effectiveIntensity` + `deviceTier` (§25 "Minimal", §26 low-end). */
  particlesAllowed: boolean;
  hapticAllowed: boolean;
  soundAllowed: boolean;
}

const MotionCapabilitiesContext = createContext<MotionCapabilities | null>(null);

/** Read the app's motion contract (§6.1) — intensity, device tier and the
 * derived particles/haptic/sound flags. Must be used within `MotionProvider`. */
export function useMotionCapabilities(): MotionCapabilities {
  const ctx = useContext(MotionCapabilitiesContext);
  if (!ctx) {
    throw new Error('useMotionCapabilities must be used within MotionProvider');
  }
  return ctx;
}

interface MotionProviderProps {
  children: ReactNode;
  /** Test/fixture-only: pin intensity and/or device tier, bypassing the
   * persisted preference and frame-jank sampling (§6.1 "test override"). */
  testOverride?: Partial<Pick<MotionCapabilities, 'intensity' | 'deviceTier'>>;
}

export function MotionProvider({ children, testOverride }: MotionProviderProps) {
  const systemReducedMotion = !!useReducedMotion();
  const [intensity, setIntensityState] = useState<MotionIntensity>(
    () => testOverride?.intensity ?? loadMotionIntensity(),
  );
  const [deviceTier, setDeviceTier] = useState<DeviceTier>(
    () => testOverride?.deviceTier ?? computeStaticDeviceTier(),
  );

  useEffect(() => {
    if (testOverride?.deviceTier) return;
    if (deviceTier === 'low-end') return;
    return sampleFrameJank((janky) => {
      if (janky) setDeviceTier('low-end');
    });
  }, [deviceTier, testOverride?.deviceTier]);

  const setIntensity = useCallback((next: MotionIntensity) => {
    setIntensityState(next);
    saveMotionIntensity(next);
    trackEvent('motion_intensity_changed', { intensity: next });
    // Local apply is instant/offline-safe above; this is a best-effort
    // cross-device sync only — never blocks or reverts the local choice.
    if (hasApi()) {
      progressionRepo.savePreferences({ motionIntensity: next }).catch(() => {});
    }
  }, []);

  const value = useMemo<MotionCapabilities>(() => {
    const derived = deriveMotionCapabilities(systemReducedMotion, intensity, deviceTier);
    return {
      systemReducedMotion,
      intensity,
      setIntensity,
      deviceTier,
      ...derived,
    };
  }, [systemReducedMotion, intensity, setIntensity, deviceTier]);

  return (
    <MotionCapabilitiesContext.Provider value={value}>
      <LazyMotion features={domAnimation}>{children}</LazyMotion>
    </MotionCapabilitiesContext.Provider>
  );
}
