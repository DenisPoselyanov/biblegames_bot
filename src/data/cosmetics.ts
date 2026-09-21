import { isFeatureEnabled } from '../lib/flags';

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
  | 'progressTrack' | 'progressFill' | 'progressRampEnd'
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

/** Canonical Phase 3 default (ADR-009) — id of the `light`/"Світло" theme below. */
const REBRAND_DEFAULT_COSMETIC_THEME_ID = 'light';

/**
 * Canonical Phase 3.5 default (ADR-018) — id of the `aurora` theme below.
 * Only takes effect once `designSystemV2` flips to `true` (WS7 full rollout);
 * see `resolveDefaultCosmeticThemeId()`.
 */
const DESIGN_V2_DEFAULT_COSMETIC_THEME_ID = 'aurora';

/**
 * The theme id to fall back to when a profile has no stored `activeTheme`
 * (WS8, `docs/phases/PHASE_3_LEARNING_PRODUCT_REBRAND_AND_MOTION.md` §7.3).
 * Only ever consulted when nothing is stored — an existing user's saved
 * choice, including one that was itself defaulted to `classic` or `light` in
 * the past, is never touched by this flag. Lazily reads the flags (not
 * module-level) so `.env.local` overrides and tests can flip them without a
 * reload. `designSystemV2` (Phase 3.5) takes precedence over
 * `lightThemeDefault` (Phase 3) — the two are never both live in production,
 * but layering them this way means flipping `designSystemV2` off falls back
 * exactly to today's Phase 3 behavior, not a fresh decision.
 */
export function resolveDefaultCosmeticThemeId(): string {
  if (isFeatureEnabled('designSystemV2')) return DESIGN_V2_DEFAULT_COSMETIC_THEME_ID;
  return isFeatureEnabled('lightThemeDefault')
    ? REBRAND_DEFAULT_COSMETIC_THEME_ID
    : DEFAULT_COSMETIC_THEME_ID;
}

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
  {
    // Canonical Phase 3.5 default theme (ADR-018,
    // docs/phases/PHASE_3_5_DESIGN_V2_VISUAL_MIGRATION.md §4). Free,
    // always-available, cannot be removed from the catalog — same status
    // `light` has for Phase 3. NOT yet wired as `DEFAULT_COSMETIC_THEME_ID`;
    // see `resolveDefaultCosmeticThemeId()`. Values pinned from the
    // `proto/design-v2` branch's `src/proto/proto.css` (`.proto-root`,
    // dark block) — the owner-approved locked palette, not a fresh pick.
    id: 'aurora',
    title: 'Небесна аврора',
    description: 'Індиго та фіолет нічного неба з теплим золотим сяйвом.',
    price: 0,
    isLight: false,
    onPrimary: '#ffffff',
    preview: {
      background: '#0a0918',
      surface: '#17162a',
      primary: '#6366f1',
      accent: '#f0c05a',
      text: '#f6f4ff',
    },
    semantic: {
      bgApp: '#0A0918',
      bgSurface: 'rgba(255, 255, 255, 0.055)',
      bgElevated: 'rgba(255, 255, 255, 0.1)',
      textPrimary: '#F6F4FF',
      textSecondary: 'rgba(246, 244, 255, 0.64)',
      textMuted: 'rgba(246, 244, 255, 0.4)',
      brandPrimary: '#6366F1',
      onBrandPrimary: '#FFFFFF',
      accentSpiritual: '#F0C05A',
      // Brighter "ink" variant for text/icon glyph roles, same distinction
      // `proto.css` draws between `--p-gold` and `--p-gold-ink` — on this
      // dark canvas the base gold already passes contrast, this is the
      // prototype's own chosen glyph tone, not a contrast workaround.
      accentSpiritualText: '#F7D896',
      borderSoft: 'rgba(255, 255, 255, 0.09)',
      borderStrong: 'rgba(255, 255, 255, 0.18)',
      borderFocus: '#F0C05A',
      focusRing: 'rgba(240, 192, 90, 0.4)',
      cardBg: 'rgba(255, 255, 255, 0.055)',
      cardBorder: 'rgba(255, 255, 255, 0.09)',
      cardShadow: '0 18px 40px -18px rgba(3, 2, 12, 0.85)',
      // One primary button per screen, indigo→violet (§4 locked decision).
      buttonPrimaryBg: 'linear-gradient(135deg, #6366F1 0%, #A855F7 100%)',
      buttonPrimaryText: '#FFFFFF',
      navBg: 'rgba(255, 255, 255, 0.055)',
      progressFill: '#6366F1',
      // Gold ramp end is a dark-theme-only locked rule (§4) — the light
      // variant below overrides this to a non-gold value.
      progressRampEnd: '#F0C05A',
    },
  },
  {
    // Light companion of `aurora` — same identity, lit from above (§4: "dark
    // by default, light available, switch lives in Profile"). Values pinned
    // from `proto.css`'s `.proto-root[data-proto-theme='light']` block.
    id: 'aurora-light',
    title: 'Небесна аврора · Світла',
    description: 'Та сама духовна преміум-палітра, освітлена вдень.',
    price: 0,
    isLight: true,
    onPrimary: '#ffffff',
    preview: {
      background: '#f7f5ff',
      surface: '#fdfcff',
      primary: '#4f46e5',
      accent: '#9a6b0f',
      text: '#1a1430',
    },
    semantic: {
      bgApp: '#F7F5FF',
      bgSurface: 'rgba(255, 255, 255, 0.82)',
      bgElevated: 'rgba(255, 255, 255, 0.96)',
      textPrimary: '#1A1430',
      textSecondary: 'rgba(26, 20, 48, 0.66)',
      textMuted: 'rgba(26, 20, 48, 0.44)',
      brandPrimary: '#4F46E5',
      onBrandPrimary: '#FFFFFF',
      accentSpiritual: '#9A6B0F',
      // Darkened further for text/icon glyph roles — same contrast-driven
      // pattern as `light`'s `accentSpiritualText` (§17 audit precedent).
      accentSpiritualText: '#7D560B',
      borderSoft: 'rgba(26, 20, 48, 0.09)',
      borderStrong: 'rgba(26, 20, 48, 0.16)',
      borderFocus: '#9A6B0F',
      focusRing: 'rgba(154, 107, 15, 0.35)',
      cardBg: 'rgba(255, 255, 255, 0.82)',
      cardBorder: 'rgba(26, 20, 48, 0.09)',
      cardShadow: '0 18px 40px -18px rgba(76, 56, 140, 0.22)',
      buttonPrimaryBg: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
      buttonPrimaryText: '#FFFFFF',
      navBg: 'rgba(255, 255, 255, 0.82)',
      progressFill: '#4F46E5',
      // Locked rule (§4): the light theme's ramp does NOT get the gold
      // endpoint — deep violet instead, exactly as `proto.css` pins it.
      progressRampEnd: '#4C1D95',
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
