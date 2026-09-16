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
