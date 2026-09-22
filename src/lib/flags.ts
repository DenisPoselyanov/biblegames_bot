export type FlagName =
  | 'learning_first_navigation'
  | 'today_dashboard'
  | 'daily_plan_v2'
  | 'learning_plans'
  | 'lesson_experience_v2'
  | 'review_scheduler_v2'
  | 'progress_dashboard_v2'
  | 'learningShellV2'
  | 'practiceSessionV2'
  | 'profileSettingsV2'
  | 'lightThemeDefault'
  | 'designSystemV2';

// Phase 3 full rollout (2026-09-21, WS10 §20 close-out): the v2 shell and every
// screen that ships behind it are the sole production path now — the legacy
// `Layout`/`Home`/`ThemeDetail`/`Profile` tree is unreachable once
// `learningShellV2` is on (see `App.tsx`'s route-tree switch) and is kept only
// as the rollback target (flip these back to `false` to restore it instantly,
// per §26). `learning_first_navigation`/`daily_plan_v2`/`review_scheduler_v2`
// only gate sections of that now-unreachable legacy tree, so they stay `false`
// — flipping them would have no effect and would only add rollback surface.
const FLAG_DEFAULTS: Record<FlagName, boolean> = {
  learning_first_navigation: false,
  today_dashboard: true,
  daily_plan_v2: false,
  learning_plans: true,
  lesson_experience_v2: true,
  review_scheduler_v2: false,
  progress_dashboard_v2: true,
  learningShellV2: true,
  practiceSessionV2: true,
  profileSettingsV2: true,
  lightThemeDefault: true,
  // Phase 3.5 full rollout (2026-09-22, WS7 close-out): design-v2
  // (`aurora`/`aurora-light`) is the sole production visual identity now —
  // re-audited for WCAG AA contrast (§17, src/lib/paletteContrast.test.ts)
  // and performance budget (§18, unchanged bundle — no new dependencies per
  // ADR-018) before flipping. Flip back to `false` to restore Phase 3's
  // `light`/`classic` default instantly (rollback target; every screen
  // gated on this flag falls back to its pre-migration render, per §5 step
  // 6 of docs/phases/PHASE_3_5_DESIGN_V2_VISUAL_MIGRATION.md).
  designSystemV2: true,
};

/**
 * Dev/QA override: set VITE_FLAG_<NAME> (e.g. VITE_FLAG_LEARNING_FIRST_NAVIGATION=true)
 * in .env.local. Falls back to the registry default when unset.
 */
export function isFeatureEnabled(name: FlagName): boolean {
  const envKey = `VITE_FLAG_${name.toUpperCase()}`;
  const override = import.meta.env[envKey];
  if (override === 'true' || override === '1') return true;
  if (override === 'false' || override === '0') return false;
  return FLAG_DEFAULTS[name];
}
