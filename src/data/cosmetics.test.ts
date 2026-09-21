import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_COSMETIC_THEME_ID, resolveDefaultCosmeticThemeId } from './cosmetics';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('resolveDefaultCosmeticThemeId (WS8 §7.3)', () => {
  it('falls back to the legacy default when the flag is off', () => {
    vi.stubEnv('VITE_FLAG_LIGHTTHEMEDEFAULT', 'false');
    expect(resolveDefaultCosmeticThemeId()).toBe(DEFAULT_COSMETIC_THEME_ID);
    expect(resolveDefaultCosmeticThemeId()).toBe('classic');
  });

  it('resolves to the rebrand default when the flag is on', () => {
    vi.stubEnv('VITE_FLAG_LIGHTTHEMEDEFAULT', 'true');
    expect(resolveDefaultCosmeticThemeId()).toBe('light');
  });
});

describe('resolveDefaultCosmeticThemeId (Phase 3.5 §4, ADR-018)', () => {
  it('resolves to aurora when designSystemV2 is on, regardless of lightThemeDefault', () => {
    vi.stubEnv('VITE_FLAG_DESIGNSYSTEMV2', 'true');
    vi.stubEnv('VITE_FLAG_LIGHTTHEMEDEFAULT', 'true');
    expect(resolveDefaultCosmeticThemeId()).toBe('aurora');
  });

  it('falls back to the Phase 3 default when designSystemV2 is off', () => {
    vi.stubEnv('VITE_FLAG_DESIGNSYSTEMV2', 'false');
    vi.stubEnv('VITE_FLAG_LIGHTTHEMEDEFAULT', 'true');
    expect(resolveDefaultCosmeticThemeId()).toBe('light');
  });
});
