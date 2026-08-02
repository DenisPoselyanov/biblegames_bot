/**
 * Server-side feature flag override, mirrors src/lib/flags.ts's convention
 * (VITE_FLAG_<NAME>) but reads process.env instead of import.meta.env — the
 * two registries are separate because Vite env vars aren't available here.
 */
export function isServerFeatureEnabled(name: string): boolean {
  const envKey = `FEATURE_${name.toUpperCase()}`;
  return process.env[envKey] === 'true';
}
