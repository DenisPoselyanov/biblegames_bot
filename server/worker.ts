/**
 * Background job worker (Phase 2 §17, §19).
 *
 * A separate deployable process: it runs the job queue and the recurring
 * maintenance schedules, and never binds a port. On one VPS it is its own
 * `node` process (own logs, own restart) alongside the API — see
 * `docs/DEPLOYMENT.md`.
 *
 *   NODE_ENV=production STORAGE_PROVIDER=sql DATABASE_URL=… \
 *     JOB_SCHEDULES_ENABLED=true npm run worker --prefix server
 */
import { createAuditLog } from './audit';
import { loadConfig } from './config/env';
import { assertProductionConfig } from './config/productionValidation';
import { log } from './lib/logger';
import { getPool, isDatabaseConfigured } from './db/pgPool';
import { createDatabase } from './infrastructure/database/client';
import { createSqlContentRepositories } from './infrastructure/database/repositories/content';
import { createObjectStore } from './infrastructure/storage';
import { createAiProvider } from './infrastructure/ai';
import { createJobQueue, registerCoreJobs } from './jobs';
import type { SweepQuery } from './jobs/sweeps';

const { config, warnings } = loadConfig();
for (const warning of warnings) log.warn('config.warning', { warning });
assertProductionConfig(config);

const poolQuery: SweepQuery = async (sql, params) => {
  const pool = await getPool();
  const result = await pool.query(sql, params);
  return { rowCount: result.rowCount };
};

async function main(): Promise<void> {
  const queue = createJobQueue(config);

  if (config.jobSchedulesEnabled) {
    if (!isDatabaseConfigured()) {
      log.warn('worker.schedules_skipped', {
        detail: 'JOB_SCHEDULES_ENABLED=true but no DATABASE_URL — retention sweeps need SQL',
      });
    } else {
      const db = createDatabase(await getPool());
      const aiProvider = createAiProvider(config);
      const auditLog = createAuditLog(config);
      registerCoreJobs(queue, {
        query: poolQuery,
        content: {
          repos: createSqlContentRepositories(db),
          store: createObjectStore(config),
        },
        ai: aiProvider
          ? { provider: aiProvider, store: createObjectStore(config), budget: config.aiJobBudget, auditLog }
          : undefined,
      });
      if (config.aiProvider !== 'off' && !aiProvider) {
        log.warn('worker.ai_provider_unconfigured', {
          detail: `CONTENT_AI_PROVIDER=${config.aiProvider} but its API key is missing — content.ai_generate not registered`,
        });
      }
      log.info('worker.schedules_registered', {
        types: (await queue.stats()).types,
        objectStorage: config.objectStorageDriver,
        aiProvider: aiProvider?.name ?? 'none',
      });
    }
  }

  await queue.start();
  log.info('worker.start', {
    nodeEnv: config.nodeEnv,
    jobQueueDriver: config.jobQueueDriver,
    schedulesEnabled: config.jobSchedulesEnabled,
  });

  const shutdown = (signal: string): void => {
    log.info('worker.stopping', { signal });
    void queue.stop().then(() => {
      log.info('worker.stopped');
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

void main().catch((err: unknown) => {
  log.error('worker.boot_failed', {
    message: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
