/**
 * Server-side feature flag override, mirrors src/lib/flags.ts's convention
 * (VITE_FLAG_<NAME>) but reads process.env instead of import.meta.env — the
 * two registries are separate because Vite env vars aren't available here.
 */
export function isServerFeatureEnabled(name: string): boolean {
  const envKey = `FEATURE_${name.toUpperCase()}`;
  return process.env[envKey] === 'true';
}

/**
 * Flag with an explicit default. Phase 1 rollout flags (authV2,
 * secureKahootIdentity) default ON and are only turned off as a deliberate
 * break-glass: `FEATURE_AUTHV2=false`.
 */
export function serverFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[`FEATURE_${name.toUpperCase()}`];
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return defaultValue;
}
