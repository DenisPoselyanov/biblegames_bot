import {
  getCosmeticThemeById,
  resolveDefaultCosmeticThemeId,
  type CosmeticTheme,
} from '../data/cosmetics';
import { syncTelegramChromeColors } from './telegram';

function parseHex(hex: string): [number, number, number] | null {
  const normalized = hex.replace('#', '').trim();
  if (normalized.length === 3) {
    const r = parseInt(normalized[0] + normalized[0], 16);
    const g = parseInt(normalized[1] + normalized[1], 16);
    const b = parseInt(normalized[2] + normalized[2], 16);
    return [r, g, b];
  }
  if (normalized.length === 6) {
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    if ([r, g, b].some((v) => Number.isNaN(v))) return null;
    return [r, g, b];
  }
  return null;
}

function toHex([r, g, b]: [number, number, number]): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`;
}

export function mixColor(a: string, b: string, ratio: number): string {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return a;
  const t = Math.max(0, Math.min(1, ratio));
  return toHex([
    ca[0] + (cb[0] - ca[0]) * t,
    ca[1] + (cb[1] - ca[1]) * t,
    ca[2] + (cb[2] - ca[2]) * t,
  ]);
}

function withAlpha(hex: string, alpha: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function deriveOnPrimary(primary: string, fallback?: string): string {
  if (fallback) return fallback;
  return relativeLuminance(primary) > 0.55 ? '#1a1208' : '#f8f3e7';
}

/**
 * Extended semantic palette (ADR-009, docs/PHASE_3_REBRANDING_AND_THEME_SYSTEM.md §5).
 * One entry per `--kebab-name` custom property consumed by `src/components/ui/*`.
 * Legacy-facing tokens (`--bg`, `--gold`, `--cta-bg`, ...) are untouched —
 * see `applyCosmeticTheme` below, which sets both layers from the same theme.
 */
export interface SemanticPalette {
  bgApp: string;
  bgSurface: string;
  bgSurfaceSubtle: string;
  bgElevated: string;
  bgInverse: string;
  bgScrim: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  textLink: string;
  brandPrimary: string;
  brandPrimaryHover: string;
  brandPrimaryPressed: string;
  onBrandPrimary: string;
  accentSpiritual: string;
  accentSpiritualSoft: string;
  accentSpiritualBg: string;
  onAccentSpiritual: string;
  borderSoft: string;
  borderDefault: string;
  borderStrong: string;
  borderFocus: string;
  focusRing: string;
  cardBg: string;
  cardBorder: string;
  cardShadow: string;
  buttonPrimaryBg: string;
  buttonPrimaryText: string;
  buttonSecondaryBg: string;
  buttonSecondaryText: string;
  buttonSecondaryBorder: string;
  navBg: string;
  navActive: string;
  navInactive: string;
  progressTrack: string;
  progressFill: string;
  inputBg: string;
  inputBorder: string;
  heroOverlayStart: string;
  heroOverlayEnd: string;
  heroImageOpacity: string;
  illustrationTint: string;
  skeletonBase: string;
  skeletonHighlight: string;
}

/** camelCase key -> `--kebab-case` custom property name, in declaration order. */
const SEMANTIC_CSS_VAR_ENTRIES: Array<[keyof SemanticPalette, string]> = [
  ['bgApp', '--bg-app'],
  ['bgSurface', '--bg-surface'],
  ['bgSurfaceSubtle', '--bg-surface-subtle'],
  ['bgElevated', '--bg-elevated'],
  ['bgInverse', '--bg-inverse'],
  ['bgScrim', '--bg-scrim'],
  ['textPrimary', '--text-primary'],
  ['textSecondary', '--text-secondary'],
  ['textMuted', '--text-muted'],
  ['textInverse', '--text-inverse'],
  ['textLink', '--text-link'],
  ['brandPrimary', '--brand-primary'],
  ['brandPrimaryHover', '--brand-primary-hover'],
  ['brandPrimaryPressed', '--brand-primary-pressed'],
  ['onBrandPrimary', '--on-brand-primary'],
  ['accentSpiritual', '--accent-spiritual'],
  ['accentSpiritualSoft', '--accent-spiritual-soft'],
  ['accentSpiritualBg', '--accent-spiritual-bg'],
  ['onAccentSpiritual', '--on-accent-spiritual'],
  ['borderSoft', '--border-soft'],
  ['borderDefault', '--border-default'],
  ['borderStrong', '--border-strong'],
  ['borderFocus', '--border-focus'],
  ['focusRing', '--focus-ring'],
  ['cardBg', '--card-bg'],
  ['cardBorder', '--card-border'],
  ['cardShadow', '--card-shadow'],
  ['buttonPrimaryBg', '--button-primary-bg'],
  ['buttonPrimaryText', '--button-primary-text'],
  ['buttonSecondaryBg', '--button-secondary-bg'],
  ['buttonSecondaryText', '--button-secondary-text'],
  ['buttonSecondaryBorder', '--button-secondary-border'],
  ['navBg', '--nav-bg'],
  ['navActive', '--nav-active'],
  ['navInactive', '--nav-inactive'],
  ['progressTrack', '--progress-track'],
  ['progressFill', '--progress-fill'],
  ['inputBg', '--input-bg'],
  ['inputBorder', '--input-border'],
  ['heroOverlayStart', '--hero-overlay-start'],
  ['heroOverlayEnd', '--hero-overlay-end'],
  ['heroImageOpacity', '--hero-image-opacity'],
  ['illustrationTint', '--illustration-tint'],
  ['skeletonBase', '--skeleton-base'],
  ['skeletonHighlight', '--skeleton-highlight'],
];

const SEMANTIC_CSS_VAR_NAMES = SEMANTIC_CSS_VAR_ENTRIES.map(([, name]) => name);

/**
 * Derives the full semantic palette from a theme's 5-color `preview` (plus
 * `isLight`), then overlays any pinned `theme.semantic` values. Every
 * existing/legacy theme gets a reasonable generic derivation; only themes
 * that ship an owner-approved `semantic` block (currently just `light`)
 * hit exact pinned values for the tokens that need them.
 */
export function deriveSemanticPalette(theme: CosmeticTheme): SemanticPalette {
  const { preview, isLight } = theme;
  const onPrimary = deriveOnPrimary(preview.primary, theme.onPrimary);

  const textSecondary = isLight
    ? mixColor(preview.text, preview.background, 0.45)
    : mixColor(preview.text, preview.background, 0.55);
  const textMuted = isLight
    ? mixColor(preview.text, preview.background, 0.65)
    : mixColor(preview.text, preview.background, 0.72);

  const borderSoft = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)';
  const borderDefault = isLight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.12)';
  const borderStrong = isLight ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.2)';

  const ctaHighlight = mixColor(preview.primary, '#ffffff', isLight ? 0.22 : 0.14);
  const ctaDepth = mixColor(preview.primary, '#000000', isLight ? 0.1 : 0.18);
  const ctaGradient = `linear-gradient(135deg, ${ctaHighlight} 0%, ${preview.primary} 52%, ${ctaDepth} 100%)`;

  const cardShadow = isLight
    ? '0 8px 24px rgba(35, 43, 57, 0.07)'
    : '0 4px 12px rgba(0, 0, 0, 0.35)';

  const generic: SemanticPalette = {
    bgApp: preview.background,
    bgSurface: preview.surface,
    bgSurfaceSubtle: mixColor(preview.surface, preview.background, 0.5),
    bgElevated: mixColor(preview.surface, '#ffffff', isLight ? 0.08 : 0.04),
    bgInverse: isLight ? preview.text : mixColor(preview.background, '#ffffff', 0.92),
    bgScrim: isLight ? 'rgba(20, 20, 20, 0.45)' : 'rgba(0, 0, 0, 0.6)',

    textPrimary: preview.text,
    textSecondary,
    textMuted,
    textInverse: onPrimary,
    textLink: preview.primary,

    brandPrimary: preview.primary,
    brandPrimaryHover: mixColor(preview.primary, '#ffffff', 0.14),
    brandPrimaryPressed: mixColor(preview.primary, '#000000', 0.18),
    onBrandPrimary: onPrimary,

    accentSpiritual: preview.accent,
    accentSpiritualSoft: mixColor(preview.accent, '#ffffff', 0.25),
    accentSpiritualBg: withAlpha(preview.accent, isLight ? 0.1 : 0.12),
    onAccentSpiritual: deriveOnPrimary(preview.accent),

    borderSoft,
    borderDefault,
    borderStrong,
    borderFocus: preview.primary,
    focusRing: withAlpha(preview.primary, isLight ? 0.35 : 0.4),

    cardBg: preview.surface,
    cardBorder: borderSoft,
    cardShadow,

    // Light theme: flat navy fill, no gradient (§9.1). Every other theme
    // keeps its existing gradient CTA look (identical to `--cta-bg` today).
    buttonPrimaryBg: isLight ? preview.primary : ctaGradient,
    buttonPrimaryText: onPrimary,
    buttonSecondaryBg: preview.surface,
    buttonSecondaryText: preview.primary,
    buttonSecondaryBorder: borderSoft,

    navBg: preview.surface,
    navActive: preview.primary,
    navInactive: textSecondary,

    progressTrack: withAlpha(preview.text, isLight ? 0.1 : 0.12),
    progressFill: preview.accent,

    inputBg: preview.surface,
    inputBorder: borderDefault,

    heroOverlayStart: withAlpha(preview.background, 0.92),
    heroOverlayEnd: withAlpha(preview.background, 0),
    heroImageOpacity: '1',
    illustrationTint: withAlpha(preview.accent, 0.12),

    skeletonBase: mixColor(preview.surface, preview.text, isLight ? 0.06 : 0.08),
    skeletonHighlight: mixColor(preview.surface, preview.background, isLight ? 0.4 : 0.3),
  };

  return theme.semantic ? { ...generic, ...theme.semantic } : generic;
}

const THEME_CSS_VARS = [
  '--bg',
  '--surface',
  '--surface-hover',
  '--border',
  '--border-light',
  '--text',
  '--text-muted',
  '--text-dim',
  '--gold',
  '--gold-light',
  '--gold-dark',
  '--gold-glow',
  '--glass-bg',
  '--glass-border',
  '--glass-shadow',
  '--accent-bg',
  '--accent-bg-strong',
  '--accent-border',
  '--accent-border-strong',
  '--on-primary',
  '--warning',
  '--warning-bg',
  '--shadow-gold',
  '--heading',
  '--nested-surface',
  '--overlay-bg',
  '--overlay-bg-strong',
  '--cta-bg',
  '--cta-shadow',
] as const;

export function applyCosmeticTheme(theme: CosmeticTheme): void {
  const { preview, isLight } = theme;
  const root = document.documentElement;

  const goldDark = mixColor(preview.primary, '#000000', 0.35);
  const surfaceHover = mixColor(preview.surface, preview.text, isLight ? 0.06 : 0.08);
  const onPrimary = deriveOnPrimary(preview.primary, theme.onPrimary);

  const textMuted = isLight
    ? mixColor(preview.text, preview.background, 0.45)
    : mixColor(preview.text, preview.background, 0.55);
  const textDim = isLight
    ? mixColor(preview.text, preview.background, 0.65)
    : mixColor(preview.text, preview.background, 0.72);

  const border = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)';
  const borderLight = isLight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.12)';

  const glassTop = mixColor(preview.surface, preview.text, isLight ? 0.04 : 0.06);
  const glassBottom = mixColor(preview.surface, preview.background, isLight ? 0.12 : 0.18);
  const glassBg = `linear-gradient(145deg, ${withAlpha(glassTop, isLight ? 0.92 : 0.88)}, ${withAlpha(glassBottom, isLight ? 0.78 : 0.65)})`;
  const glassBorder = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.06)';
  const glassShadow = isLight
    ? '0 8px 32px rgba(0, 0, 0, 0.08)'
    : '0 8px 32px rgba(0, 0, 0, 0.3)';

  const goldGlow = withAlpha(preview.primary, isLight ? 0.25 : 0.35);
  const headingColor = isLight ? preview.primary : preview.accent;
  const nestedSurface = isLight
    ? mixColor(preview.background, preview.text, 0.05)
    : mixColor(preview.surface, preview.text, 0.1);
  const overlayBg = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.06)';
  const overlayBgStrong = isLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';

  const ctaHighlight = mixColor(preview.primary, '#ffffff', isLight ? 0.22 : 0.14);
  const ctaDepth = mixColor(preview.primary, '#000000', isLight ? 0.1 : 0.18);
  const ctaBg = `linear-gradient(135deg, ${ctaHighlight} 0%, ${preview.primary} 52%, ${ctaDepth} 100%)`;
  const ctaShadow = isLight
    ? `0 8px 28px ${withAlpha(preview.primary, 0.28)}, 0 2px 8px ${withAlpha(preview.primary, 0.12)}`
    : `0 8px 28px ${withAlpha(preview.primary, 0.38)}, 0 2px 8px rgba(0, 0, 0, 0.2)`;

  root.style.setProperty('--bg', preview.background);
  root.style.setProperty('--surface', preview.surface);
  root.style.setProperty('--surface-hover', surfaceHover);
  root.style.setProperty('--border', border);
  root.style.setProperty('--border-light', borderLight);
  root.style.setProperty('--text', preview.text);
  root.style.setProperty('--text-muted', textMuted);
  root.style.setProperty('--text-dim', textDim);
  root.style.setProperty('--gold', preview.primary);
  root.style.setProperty('--gold-light', preview.accent);
  root.style.setProperty('--gold-dark', goldDark);
  root.style.setProperty('--gold-glow', goldGlow);
  root.style.setProperty('--glass-bg', glassBg);
  root.style.setProperty('--glass-border', glassBorder);
  root.style.setProperty('--glass-shadow', glassShadow);
  root.style.setProperty('--accent-bg', withAlpha(preview.primary, isLight ? 0.1 : 0.08));
  root.style.setProperty('--accent-bg-strong', withAlpha(preview.primary, isLight ? 0.16 : 0.15));
  root.style.setProperty('--accent-border', withAlpha(preview.primary, isLight ? 0.28 : 0.25));
  root.style.setProperty('--accent-border-strong', withAlpha(preview.primary, isLight ? 0.42 : 0.38));
  root.style.setProperty('--on-primary', onPrimary);
  root.style.setProperty('--warning', preview.primary);
  root.style.setProperty('--warning-bg', withAlpha(preview.primary, isLight ? 0.12 : 0.15));
  root.style.setProperty('--shadow-gold', `0 4px 16px ${goldGlow}`);
  root.style.setProperty('--heading', headingColor);
  root.style.setProperty('--nested-surface', nestedSurface);
  root.style.setProperty('--overlay-bg', overlayBg);
  root.style.setProperty('--overlay-bg-strong', overlayBgStrong);
  root.style.setProperty('--cta-bg', ctaBg);
  root.style.setProperty('--cta-shadow', ctaShadow);

  const semantic = deriveSemanticPalette(theme);
  for (const [key, cssName] of SEMANTIC_CSS_VAR_ENTRIES) {
    root.style.setProperty(cssName, semantic[key]);
  }

  root.style.colorScheme = isLight ? 'light' : 'dark';

  syncTelegramChromeColors(preview.background);
}

export function clearCosmeticThemeOverrides(): void {
  const root = document.documentElement;
  for (const name of THEME_CSS_VARS) {
    root.style.removeProperty(name);
  }
  for (const name of SEMANTIC_CSS_VAR_NAMES) {
    root.style.removeProperty(name);
  }
  root.style.removeProperty('color-scheme');
}

export function applyCosmeticThemeById(themeId: string): void {
  const theme = getCosmeticThemeById(themeId);
  if (theme) {
    applyCosmeticTheme(theme);
    return;
  }
  const fallback = getCosmeticThemeById(resolveDefaultCosmeticThemeId());
  if (fallback) applyCosmeticTheme(fallback);
}
