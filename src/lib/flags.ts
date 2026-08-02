export type FlagName = 'learning_first_navigation';

const FLAG_DEFAULTS: Record<FlagName, boolean> = {
  learning_first_navigation: false,
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
