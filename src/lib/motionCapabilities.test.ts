import { describe, expect, it } from 'vitest';
import { deriveMotionCapabilities } from './motionCapabilities';

describe('deriveMotionCapabilities (§6.1 particles/haptic/sound gates)', () => {
  it('system prefers-reduced-motion always forces minimal, overriding a full preference (§24)', () => {
    const result = deriveMotionCapabilities(true, 'full', 'standard');
    expect(result.effectiveIntensity).toBe('minimal');
    expect(result.particlesAllowed).toBe(false);
    expect(result.hapticAllowed).toBe(false);
    expect(result.soundAllowed).toBe(false);
  });

  it('full intensity on a standard-tier device allows particles, haptics and sound', () => {
    const result = deriveMotionCapabilities(false, 'full', 'standard');
    expect(result.effectiveIntensity).toBe('full');
    expect(result.particlesAllowed).toBe(true);
    expect(result.hapticAllowed).toBe(true);
    expect(result.soundAllowed).toBe(true);
  });

  it('full intensity on a low-end device keeps haptics/sound but drops particles (§26)', () => {
    const result = deriveMotionCapabilities(false, 'full', 'low-end');
    expect(result.particlesAllowed).toBe(false);
    expect(result.hapticAllowed).toBe(true);
    expect(result.soundAllowed).toBe(true);
  });

  it('reduced intensity drops particles and sound but keeps haptics', () => {
    const result = deriveMotionCapabilities(false, 'reduced', 'standard');
    expect(result.effectiveIntensity).toBe('reduced');
    expect(result.particlesAllowed).toBe(false);
    expect(result.hapticAllowed).toBe(true);
    expect(result.soundAllowed).toBe(false);
  });

  it('minimal intensity disables everything', () => {
    const result = deriveMotionCapabilities(false, 'minimal', 'standard');
    expect(result.particlesAllowed).toBe(false);
    expect(result.hapticAllowed).toBe(false);
    expect(result.soundAllowed).toBe(false);
  });
});
