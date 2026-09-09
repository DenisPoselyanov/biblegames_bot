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
import { loadConfig } from './config/env';
import { assertProductionConfig } from './config/productionValidation';
import { log } from './lib/logger';
import { getPool, isDatabaseConfigured } from './db/pgPool';
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
      registerCoreJobs(queue, { query: poolQuery });
      log.info('worker.schedules_registered', { types: (await queue.stats()).types });
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
