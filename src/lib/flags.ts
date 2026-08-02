export type FlagName =
  | 'learning_first_navigation'
  | 'today_dashboard'
  | 'daily_plan_v2'
  | 'server_streak'
  | 'learning_plans'
  | 'lesson_experience_v2'
  | 'review_scheduler_v2'
  | 'progress_dashboard_v2';

const FLAG_DEFAULTS: Record<FlagName, boolean> = {
  learning_first_navigation: false,
  today_dashboard: false,
  daily_plan_v2: false,
  server_streak: false,
  learning_plans: false,
  lesson_experience_v2: false,
  review_scheduler_v2: false,
  progress_dashboard_v2: false,
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
