/**
 * Process entry point — the ONLY place that binds a port (Phase 2 §4, acc. #10).
 * Composition lives in `server/app/` (`createApp`, `createRealtimeServer`,
 * `createHttpServer`).
 */
import { loadConfig } from './config/env';
import { assertProductionConfig } from './config/productionValidation';
import { createHttpServer } from './app/createHttpServer';
import { isDevIdentityEnabled } from './auth/devIdentityProvider';
import { log } from './lib/logger';
import { getPool, isDatabaseConfigured, useQuestionsSql } from './db/pgPool';
import { createDatabase, type Database } from './infrastructure/database/client';

const { config, warnings } = loadConfig();
for (const warning of warnings) log.warn('config.warning', { warning });

assertProductionConfig(config);

if (isDevIdentityEnabled(config)) {
  log.warn('auth.dev_identity_enabled', {
    detail: 'AUTH_MODE=development — identity is an insecure fixture. Never use this in production.',
  });
}

async function main(): Promise<void> {
  // The persisted RBAC store (and the runtime grant/revoke surface) come online
  // only when a database is configured; otherwise roles stay config-sourced.
  let database: Database | undefined;
  if (isDatabaseConfigured()) {
    try {
      database = createDatabase(await getPool());
    } catch (err) {
      log.error('db.drizzle_init_failed', {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const { httpServer } = createHttpServer({ config, database });

  httpServer.listen(config.port, () => {
    log.info('server.start', {
      nodeEnv: config.nodeEnv,
      port: config.port,
      authMode: config.authMode,
      storageProvider: config.storageProvider,
      questionsProvider: useQuestionsSql() ? 'sql' : 'json',
      rbacStore: database ? 'persisted' : 'config',
      rateLimitStore: database ? 'shared' : 'memory',
      clientOrigins: config.clientOrigins,
      demoRoutesEnabled: config.demoRoutesEnabled,
      rateLimitDisabled: config.rateLimitDisabled,
    });
  });

  httpServer.on('error', (err) => {
    log.error('server.http_error', { message: err.message });
  });
}

void main();
