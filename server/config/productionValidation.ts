import type { ServerConfig } from './env';

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
  const localOrigin = config.clientOrigins.find(
    (o) => o.includes('localhost') || o.includes('127.0.0.1'),
  );
  if (localOrigin) {
    errors.push(`CLIENT_ORIGIN(S) must not contain a localhost origin in production ("${localOrigin}").`);
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
