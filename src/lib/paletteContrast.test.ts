import { beforeAll, describe, expect, it, vi } from 'vitest';
import { getCosmeticThemeById, type CosmeticTheme } from '../data/cosmetics';
import type { deriveSemanticPalette as DeriveSemanticPalette } from './cosmeticTheme';

/**
 * WCAG 2.1 contrast-ratio math, self-contained. Locks in the WS7 §17
 * re-audit findings against the `aurora`/`aurora-light` palettes (Phase 3.5
 * §4/§6), plus the `stateSuccess*`/`stateDanger*` light-theme fix, so a
 * future palette edit can't silently regress below WCAG AA without a test
 * failure.
 *
 * `./cosmeticTheme` transitively imports `./telegram` -> `@twa-dev/sdk`,
 * which touches `window`/`document` at module-evaluation time (fine in the
 * browser, not under vitest's `node` environment per vitest.config.mjs).
 * Stub the minimal surface it needs and import dynamically so the stub is
 * in place before that side effect runs — a static top-level import would
 * be hoisted and evaluated first regardless of where in this file it's
 * written.
 */
let deriveSemanticPalette: typeof DeriveSemanticPalette;

beforeAll(async () => {
  vi.stubGlobal('window', {
    sessionStorage: { getItem: () => null, setItem: () => {} },
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  vi.stubGlobal('document', {
    documentElement: { style: { setProperty: () => {} } },
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  ({ deriveSemanticPalette } = await import('./cosmeticTheme'));
});

function pinned(theme: CosmeticTheme, key: keyof NonNullable<CosmeticTheme['semantic']>): string {
  const value = theme.semantic?.[key];
  if (!value) {
    throw new Error(
      `expected '${theme.id}' to pin semantic.${key} — this test only checks pinned tokens, ` +
        'not the generic per-preview derivation',
    );
  }
  return value;
}

function parseColor(input: string): { r: number; g: number; b: number; a: number } {
  const hex = input.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const rgba = input.match(/rgba?\(([^)]+)\)/i);
  if (rgba) {
    const [r, g, b, a = 1] = rgba[1].split(',').map((part) => parseFloat(part.trim()));
    return { r, g, b, a };
  }
  throw new Error(`unsupported color format in contrast test: ${input}`);
}

function compositeOverOpaque(fg: string, bgHex: string): { r: number; g: number; b: number } {
  const f = parseColor(fg);
  const bg = parseColor(bgHex);
  return {
    r: f.r * f.a + bg.r * (1 - f.a),
    g: f.g * f.a + bg.g * (1 - f.a),
    b: f.b * f.a + bg.b * (1 - f.a),
  };
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const cs = c / 255;
    return cs <= 0.03928 ? cs / 12.92 : ((cs + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/** Contrast ratio of a (possibly translucent) foreground against an opaque background. */
function contrast(fg: string, bgHex: string): number {
  const fgOpaque = compositeOverOpaque(fg, bgHex);
  const bgOpaque = compositeOverOpaque(bgHex, bgHex);
  const l1 = relativeLuminance(fgOpaque);
  const l2 = relativeLuminance(bgOpaque);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const AA_NORMAL_TEXT = 4.5;
const AA_UI_COMPONENT = 3;

describe.each([
  ['aurora', getCosmeticThemeById('aurora')!],
  ['aurora-light', getCosmeticThemeById('aurora-light')!],
])('%s contrast (Phase 3.5 WS7 §17 re-audit)', (_name, theme) => {
  const bgApp = pinned(theme, 'bgApp');
  const bgSurfaceRaw = pinned(theme, 'bgSurface');
  // bgSurface is itself translucent (a card tint over bgApp) — composite it
  // to an opaque color once so it can act as a background for the checks
  // below, the same way the real DOM renders a card over the app background.
  const bgSurface = (() => {
    const c = compositeOverOpaque(bgSurfaceRaw, bgApp);
    return `rgb(${c.r}, ${c.g}, ${c.b})`;
  })();

  it('body text meets AA normal-text contrast against bgApp/bgSurface', () => {
    for (const bg of [bgApp, bgSurface]) {
      expect(contrast(pinned(theme, 'textPrimary'), bg)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
      expect(contrast(pinned(theme, 'textSecondary'), bg)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
      expect(contrast(pinned(theme, 'textMuted'), bg)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
      expect(contrast(pinned(theme, 'accentSpiritualText'), bg)).toBeGreaterThanOrEqual(
        AA_NORMAL_TEXT,
      );
    }
  });

  it('primary button text meets AA normal-text contrast across the gradient', () => {
    // buttonPrimaryBg is a two-stop gradient — check both stops, since the
    // button text (14px/700 — below the 14pt/18.66px "large text" floor)
    // must clear AA across the whole gradient, not just one end.
    const gradient = pinned(theme, 'buttonPrimaryBg');
    const stops = gradient.match(/#[0-9a-fA-F]{6}/g) ?? [];
    expect(stops.length).toBeGreaterThanOrEqual(2);
    for (const stop of stops) {
      expect(contrast(pinned(theme, 'buttonPrimaryText'), stop)).toBeGreaterThanOrEqual(
        AA_NORMAL_TEXT,
      );
    }
  });

  it('focus/border/accent indicators meet AA non-text UI contrast against bgApp', () => {
    expect(contrast(pinned(theme, 'borderFocus'), bgApp)).toBeGreaterThanOrEqual(AA_UI_COMPONENT);
    expect(contrast(pinned(theme, 'accentSpiritual'), bgApp)).toBeGreaterThanOrEqual(
      AA_UI_COMPONENT,
    );
    expect(contrast(pinned(theme, 'progressRampEnd'), bgApp)).toBeGreaterThanOrEqual(
      AA_UI_COMPONENT,
    );
  });
});

describe.each([
  ['light', getCosmeticThemeById('light')!],
  ['aurora-light', getCosmeticThemeById('aurora-light')!],
])('%s correct/incorrect answer feedback contrast (Phase 3.5 WS7 §17)', (_name, theme) => {
  it('stateSuccessText/stateDangerText meet AA against their own tinted background', () => {
    const semantic = deriveSemanticPalette(theme);
    const bgApp = semantic.bgApp;
    const successBg = compositeOverOpaque(semantic.stateSuccessBg, bgApp);
    const dangerBg = compositeOverOpaque(semantic.stateDangerBg, bgApp);
    expect(
      contrast(semantic.stateSuccessText, `rgb(${successBg.r}, ${successBg.g}, ${successBg.b})`),
    ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    expect(
      contrast(semantic.stateDangerText, `rgb(${dangerBg.r}, ${dangerBg.g}, ${dangerBg.b})`),
    ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it('stateSuccess/stateDanger borders meet AA non-text UI contrast against bgApp', () => {
    const semantic = deriveSemanticPalette(theme);
    expect(contrast(semantic.stateSuccess, semantic.bgApp)).toBeGreaterThanOrEqual(
      AA_UI_COMPONENT,
    );
    expect(contrast(semantic.stateDanger, semantic.bgApp)).toBeGreaterThanOrEqual(
      AA_UI_COMPONENT,
    );
  });
});

describe('classic/aurora (dark) keep today\'s exact stateSuccess/stateDanger values', () => {
  it('dark themes are byte-identical to the pre-WS7 static globals', () => {
    const classic = deriveSemanticPalette(getCosmeticThemeById('classic')!);
    const aurora = deriveSemanticPalette(getCosmeticThemeById('aurora')!);
    for (const semantic of [classic, aurora]) {
      expect(semantic.stateSuccess).toBe('#4a9c5d');
      expect(semantic.stateSuccessBg).toBe('rgba(74, 156, 93, 0.18)');
      expect(semantic.stateSuccessText).toBe('#9ee0ad');
      expect(semantic.stateDanger).toBe('#9c4a4a');
      expect(semantic.stateDangerBg).toBe('rgba(156, 74, 74, 0.18)');
      expect(semantic.stateDangerText).toBe('#e8b0b0');
    }
  });
});

describe('aurora text-role tokens pinned away from raw brandPrimary (Phase 3.5 WS7 §17)', () => {
  it('aurora pins textLink/buttonSecondaryText — the generic brandPrimary derivation fails AA', () => {
    const aurora = getCosmeticThemeById('aurora')!;
    const bgApp = pinned(aurora, 'bgApp');
    const brandPrimary = pinned(aurora, 'brandPrimary');
    // Document *why* the pin exists: the raw brand color the generic
    // `deriveSemanticPalette` fallback would otherwise use for these two
    // text roles measures below AA on this dark background.
    expect(contrast(brandPrimary, bgApp)).toBeLessThan(AA_NORMAL_TEXT);
    expect(contrast(pinned(aurora, 'textLink'), bgApp)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    expect(contrast(pinned(aurora, 'buttonSecondaryText'), bgApp)).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT,
    );
  });
});
