/**
 * Optional pinned overrides for the extended semantic palette (ADR-009,
 * docs/PHASE_3_REBRANDING_AND_THEME_SYSTEM.md §5). Keys are the camelCase
 * names of `SemanticPalette` (see `../lib/cosmeticTheme`); values here win
 * over the generic per-theme derivation. Only the canonical `light` theme
 * needs this today — its palette is owner-approved and must hit the exact
 * pinned hex values, not a generic mix formula. Other themes derive their
 * whole semantic palette from the 5-color `preview` below.
 */
export type SemanticPaletteOverrides = Partial<Record<
  | 'bgApp' | 'bgSurface' | 'bgSurfaceSubtle' | 'bgElevated' | 'bgInverse' | 'bgScrim'
  | 'textPrimary' | 'textSecondary' | 'textMuted' | 'textInverse' | 'textLink'
  | 'brandPrimary' | 'brandPrimaryHover' | 'brandPrimaryPressed' | 'onBrandPrimary'
  | 'accentSpiritual' | 'accentSpiritualText' | 'accentSpiritualSoft' | 'accentSpiritualBg' | 'onAccentSpiritual'
  | 'borderSoft' | 'borderDefault' | 'borderStrong' | 'borderFocus' | 'focusRing'
  | 'cardBg' | 'cardBorder' | 'cardShadow'
  | 'buttonPrimaryBg' | 'buttonPrimaryText'
  | 'buttonSecondaryBg' | 'buttonSecondaryText' | 'buttonSecondaryBorder'
  | 'navBg' | 'navActive' | 'navInactive'
  | 'progressTrack' | 'progressFill'
  | 'inputBg' | 'inputBorder'
  | 'heroOverlayStart' | 'heroOverlayEnd' | 'heroImageOpacity' | 'illustrationTint'
  | 'skeletonBase' | 'skeletonHighlight',
  string
>>;

export interface CosmeticTheme {
  id: string;
  title: string;
  description: string;
  price: number;
  isLight: boolean;
  onPrimary?: string;
  preview: {
    background: string;
    surface: string;
    primary: string;
    accent: string;
    text: string;
  };
  /** Pinned semantic-palette overrides — see `SemanticPaletteOverrides`. */
  semantic?: SemanticPaletteOverrides;
}

export const DEFAULT_COSMETIC_THEME_ID = 'classic';

export const COSMETIC_THEMES: CosmeticTheme[] = [
  {
    id: DEFAULT_COSMETIC_THEME_ID,
    title: 'Класичний стиль',
    description: 'Строгі золоті акценти на спокійному темному фоні.',
    price: 0,
    isLight: false,
    preview: {
      background: '#101820',
      surface: '#182430',
      primary: '#d8a84e',
      accent: '#f1d28a',
      text: '#f8f3e7',
    },
  },
  {
    id: 'gennesaret-sea',
    title: 'Генісаретське море',
    description: 'Глибокий синій колір води й теплі піщані береги Галилеї.',
    price: 300,
    isLight: false,
    onPrimary: '#0f2f3f',
    preview: {
      background: '#0f2f3f',
      surface: '#174b61',
      primary: '#62b6cb',
      accent: '#f2cc8f',
      text: '#f7fbff',
    },
  },
  {
    id: 'eden-garden',
    title: 'Едемський сад',
    description: 'Оливково-зелені відтінки із золотавими квітковими акцентами.',
    price: 500,
    isLight: false,
    onPrimary: '#18251a',
    preview: {
      background: '#18251a',
      surface: '#2c432e',
      primary: '#8fb56f',
      accent: '#e0b95a',
      text: '#f7f5e8',
    },
  },
  {
    id: 'sinai-revelation',
    title: 'Синайське одкровення',
    description: 'Вечірні фіолетово-багряні тони з вогненними акцентами.',
    price: 700,
    isLight: false,
    onPrimary: '#fff6ef',
    preview: {
      background: '#21162f',
      surface: '#3a244a',
      primary: '#c8553d',
      accent: '#f28c28',
      text: '#fff6ef',
    },
  },
  {
    id: 'heavenly-jerusalem',
    title: 'Небесний Єрусалим',
    description: 'Перлинно-біла основа та яскраве королівське золото.',
    price: 1000,
    isLight: true,
    onPrimary: '#1a1208',
    preview: {
      background: '#f7f4ea',
      surface: '#ffffff',
      primary: '#c9a227',
      accent: '#6c63ff',
      text: '#24242e',
    },
  },
  {
    // Canonical Phase 3 default theme (ADR-009). Free, always-available,
    // cannot be removed from the catalog. NOT yet wired as
    // `DEFAULT_COSMETIC_THEME_ID` — that flip is WS8's rollout, gated on
    // migration/fallback/rollback testing. See
    // docs/PHASE_3_REBRANDING_AND_THEME_SYSTEM.md §4.
    id: 'light',
    title: 'Світло',
    description: 'Теплий ivory canvas, глибокий navy і стримане золото.',
    price: 0,
    isLight: true,
    onPrimary: '#ffffff',
    preview: {
      background: '#f7f4ee',
      surface: '#fffefc',
      primary: '#132f57',
      accent: '#c59a3d',
      text: '#13294b',
    },
    semantic: {
      bgApp: '#F7F4EE',
      bgSurface: '#FFFEFC',
      bgSurfaceSubtle: '#F1EDE6',
      bgElevated: '#FFFFFF',
      textPrimary: '#13294B',
      textSecondary: '#667085',
      textMuted: '#8A8F98',
      brandPrimary: '#132F57',
      accentSpiritual: '#C59A3D',
      // Darkened for text/icon glyph roles — the raw accent above is
      // ~2.4:1 against the ivory canvas, well under WCAG AA (§17 audit,
      // Phase 3 WS10). ~5.1:1 against bgApp/bgElevated. Background/border
      // uses keep `accentSpiritual` unchanged.
      accentSpiritualText: '#816322',
      accentSpiritualSoft: '#D8B96B',
      borderSoft: '#E7E1D8',
      borderStrong: '#D8D0C4',
      cardShadow: '0 8px 24px rgba(35, 43, 57, 0.07)',
    },
  },
];

export function getCosmeticThemeById(id: string): CosmeticTheme | undefined {
  return COSMETIC_THEMES.find((theme) => theme.id === id);
}

export interface Avatar {
  id: string;
  title: string;
  emoji: string;
  price: number;
}

export const AVATARS: Avatar[] = [
  { id: 'fish', title: 'Риба (Іхтіс)', emoji: '🐟', price: 50 },
  { id: 'dove', title: 'Голуб миру', emoji: '🕊️', price: 150 },
  { id: 'lion', title: 'Лев Юди', emoji: '🦁', price: 200 },
  { id: 'crown', title: 'Корона життя', emoji: '👑', price: 250 },
  { id: 'shield', title: 'Щит віри', emoji: '🛡️', price: 300 },
  { id: 'sword', title: 'Меч Духа', emoji: '⚔️', price: 350 },
];

export function getAvatarById(id: string): Avatar | undefined {
  return AVATARS.find(a => a.id === id);
}
