import type { ServerConfig } from './env';

/** Loopback / wildcard hosts that must never appear in a production origin. */
function isUnsafeProductionOrigin(origin: string): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return true; // unparseable origin is not a valid production allow-list entry
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (url.protocol !== 'https:') return true;
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host === '0.0.0.0' || host === '::1' || host === '::') return true;
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  return false;
}

/**
 * Fail-closed production gate (Phase 1 §5.1, ADR-002 / ADR-006).
 *
 * When `nodeEnv === 'production'` the server must refuse to start unless the
 * security-critical configuration is complete and safe. Non-production is left
 * permissive so local/CI workflows keep working.
 */
export function collectProductionConfigErrors(config: ServerConfig): string[] {
  if (!config.isProduction) return [];

  const errors: string[] = [];

  if (!config.telegramBotToken) {
    errors.push('TELEGRAM_BOT_TOKEN is required in production.');
  }
  if (config.authMode !== 'telegram') {
    errors.push(`AUTH_MODE must be "telegram" in production (got "${config.authMode}").`);
  }
  if (config.storageProvider === 'sql' && !config.databaseUrl) {
    errors.push('DATABASE_URL is required when STORAGE_PROVIDER=sql in production.');
  }
  if (config.clientOrigins.length === 0) {
    errors.push('CLIENT_ORIGIN(S) must list at least one allowed origin in production.');
  }
  const unsafeOrigin = config.clientOrigins.find(isUnsafeProductionOrigin);
  if (unsafeOrigin) {
    errors.push(
      `CLIENT_ORIGIN(S) must be https and non-loopback in production ("${unsafeOrigin}").`,
    );
  }

  return errors;
}

export class ProductionConfigError extends Error {
  readonly errors: string[];
  constructor(errors: string[]) {
    super(
      `Refusing to start: invalid production configuration:\n` +
        errors.map((e) => `  - ${e}`).join('\n'),
    );
    this.name = 'ProductionConfigError';
    this.errors = errors;
  }
}

export function assertProductionConfig(config: ServerConfig): void {
  const errors = collectProductionConfigErrors(config);
  if (errors.length > 0) {
    throw new ProductionConfigError(errors);
  }
}
