/**
 * Single typed view of the server's environment (Phase 1 §5.1).
 *
 * Parse `process.env` exactly once via `loadConfig()` and inject the resulting
 * frozen `ServerConfig` — do not read `process.env` ad hoc in domain modules.
 * `loadConfig()` never throws; production hard-fails via
 * `assertProductionConfig()` (see ./productionValidation.ts) so unit tests stay
 * hermetic.
 */

export type NodeEnv = 'development' | 'test' | 'production';
export type AuthMode = 'telegram' | 'development';
export type StorageProvider = 'json' | 'sql';

export interface ServerConfig {
  nodeEnv: NodeEnv;
  isProduction: boolean;
  port: number;
  /** Allowed browser origins for CORS (HTTP + Socket.IO). */
  clientOrigins: string[];
  telegramBotToken: string;
  authMode: AuthMode;
  /** Max accepted age of Telegram `auth_date`, seconds. Default 24h. */
  authInitDataMaxAgeSec: number;
  storageProvider: StorageProvider;
  databaseUrl: string;
  questionAdminEnabled: boolean;
}

export interface LoadConfigResult {
  config: ServerConfig;
  /** Non-fatal parse notes (unknown values coerced to defaults). */
  warnings: string[];
}

const DEFAULT_MAX_AGE_SEC = 86_400;

function parseNodeEnv(raw: string | undefined, warnings: string[]): NodeEnv {
  if (raw === 'production' || raw === 'test' || raw === 'development') return raw;
  if (raw && raw.trim()) {
    // Unrecognized non-empty NODE_ENV: fail closed. Treating it as
    // `development` would silently skip the production config gate and could
    // enable dev identity. `production` is the safe interpretation.
    warnings.push(`Unrecognized NODE_ENV "${raw}", treating as "production" (fail-closed)`);
    return 'production';
  }
  return 'development';
}

function parseOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseIntOr(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): LoadConfigResult {
  const warnings: string[] = [];
  const nodeEnv = parseNodeEnv(env.NODE_ENV, warnings);

  let authMode: AuthMode = 'telegram';
  if (env.AUTH_MODE === 'development') {
    authMode = 'development';
  } else if (env.AUTH_MODE && env.AUTH_MODE !== 'telegram') {
    warnings.push(`Unknown AUTH_MODE "${env.AUTH_MODE}", falling back to "telegram"`);
  }

  let storageProvider: StorageProvider = 'json';
  if (env.STORAGE_PROVIDER === 'sql') {
    storageProvider = 'sql';
  } else if (env.STORAGE_PROVIDER && env.STORAGE_PROVIDER !== 'json') {
    warnings.push(`Unknown STORAGE_PROVIDER "${env.STORAGE_PROVIDER}", falling back to "json"`);
  }

  // Accept both CLIENT_ORIGIN (legacy, singular) and CLIENT_ORIGINS (plural).
  const originsRaw = env.CLIENT_ORIGINS ?? env.CLIENT_ORIGIN;
  const clientOrigins = parseOrigins(originsRaw);
  if (clientOrigins.length === 0) {
    clientOrigins.push('http://localhost:5173', 'http://127.0.0.1:5173');
  }

  const config: ServerConfig = Object.freeze({
    nodeEnv,
    isProduction: nodeEnv === 'production',
    port: parseIntOr(env.PORT, 3001),
    clientOrigins,
    telegramBotToken: env.TELEGRAM_BOT_TOKEN ?? '',
    authMode,
    authInitDataMaxAgeSec: parseIntOr(env.AUTH_INITDATA_MAX_AGE_SEC, DEFAULT_MAX_AGE_SEC),
    storageProvider,
    databaseUrl: env.DATABASE_URL ?? '',
    questionAdminEnabled: env.QUESTION_ADMIN_ENABLED === 'true',
  });

  return { config, warnings };
}
