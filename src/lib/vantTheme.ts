import type { CosmeticTheme } from '../data/cosmetics';
import { mixColor } from './cosmeticTheme';

export type VantThemeVars = Record<string, string>;

function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '').trim();
  if (normalized.length !== 6) return hex;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return hex;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function toKebabCase(key: string): string {
  return key.replace(/([A-Z])/g, '-$1').toLowerCase();
}

export function themeMode(theme: CosmeticTheme): 'light' | 'dark' {
  return theme.isLight ? 'light' : 'dark';
}

export function cosmeticThemeToVantVars(theme: CosmeticTheme): VantThemeVars {
  const { preview, isLight } = theme;
  const textMuted = isLight
    ? mixColor(preview.text, preview.background, 0.45)
    : mixColor(preview.text, preview.background, 0.55);
  const border = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)';
  const active = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.08)';

  return {
    primaryColor: preview.primary,
    successColor: '#4a9c5d',
    dangerColor: '#9c4a4a',
    warningColor: preview.primary,
    textColor: preview.text,
    textColor2: textMuted,
    textColor3: textMuted,
    activeColor: active,
    backgroundColor: preview.background,
    backgroundColorLight: preview.surface,
    background2: preview.surface,
    borderColor: border,
    gray1: preview.background,
    gray2: preview.surface,
    gray3: border,
    gray8: preview.text,
    buttonPrimaryColor: preview.primary,
    buttonPrimaryBackground: preview.primary,
    buttonPrimaryBorderColor: preview.primary,
    buttonDefaultBackground: preview.surface,
    buttonDefaultColor: preview.text,
    tabbarBackgroundColor: preview.surface,
    tabbarItemActiveColor: preview.primary,
    tabbarItemInactiveColor: textMuted,
    popupBackground: preview.surface,
    dialogBackground: preview.surface,
    toastBackground: preview.surface,
    toastTextColor: preview.text,
    skeletonParagraphBackground: isLight
      ? mixColor(preview.surface, preview.text, 0.04)
      : mixColor(preview.surface, preview.text, 0.08),
    skeletonAvatarBackground: isLight
      ? mixColor(preview.surface, preview.text, 0.06)
      : mixColor(preview.surface, preview.text, 0.12),
    loadingSpinnerColor: preview.primary,
    emptyDescriptionColor: textMuted,
    overlayBackground: withAlpha('#000000', isLight ? 0.45 : 0.55),
  };
}

export function applyVantThemeToDocument(vars: VantThemeVars): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(vars)) {
    const cssKey = key.startsWith('--rv-') ? key : `--rv-${toKebabCase(key)}`;
    root.style.setProperty(cssKey, String(value));
  }
}

export function clearVantThemeFromDocument(vars: VantThemeVars): void {
  const root = document.documentElement;
  for (const key of Object.keys(vars)) {
    const cssKey = key.startsWith('--rv-') ? key : `--rv-${toKebabCase(key)}`;
    root.style.removeProperty(cssKey);
  }
}
