import {
  DEFAULT_COSMETIC_THEME_ID,
  getCosmeticThemeById,
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

  root.style.colorScheme = isLight ? 'light' : 'dark';

  syncTelegramChromeColors(preview.background);
}

export function clearCosmeticThemeOverrides(): void {
  const root = document.documentElement;
  for (const name of THEME_CSS_VARS) {
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
  const fallback = getCosmeticThemeById(DEFAULT_COSMETIC_THEME_ID);
  if (fallback) applyCosmeticTheme(fallback);
}
