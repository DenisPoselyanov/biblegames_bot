/**
 * Job queue composition (Phase 2 §17, ADR-014).
 *
 * `createJobQueue` picks the adapter from config; `registerCoreJobs` wires the
 * platform's own recurring maintenance work. Both the API process and the
 * dedicated worker call `createJobQueue`, but only a process with
 * `jobSchedulesEnabled` registers the recurring sweeps — schedules must run in
 * exactly one place.
 */
import type { ServerConfig } from '../config/env';
import { log } from '../lib/logger';
import { metrics } from '../lib/metrics';
import { JOB_TYPES } from '../domains/jobs/catalog';
import { createInMemoryJobQueue } from '../domains/jobs/inMemoryQueue';
import type { JobQueue } from '../domains/jobs/queue';
import type { ContentRepositories } from '../domains/content/repository';
import type { ObjectStore } from '../domains/storage/objectStore';
import type { AiBudget } from '../domains/ai/budget';
import type { AiProvider } from '../domains/ai/types';
import {
  idempotencySweepHandler,
  rateLimitSweepHandler,
  telemetryRetentionHandler,
  type SweepQuery,
} from './sweeps';
import { contentSnapshotHandler } from './contentSnapshot';
import { contentAiGenerateHandler } from './contentAi';

export function createJobQueue(config: ServerConfig): JobQueue {
  if (config.jobQueueDriver === 'postgres') {
    // WS5 part 1b: the Postgres/pg-boss adapter. Until it lands, fall back to
    // in-memory with a loud warning rather than failing the process.
    log.warn('jobs.driver_unavailable', {
      requested: 'postgres',
      using: 'memory',
      detail: 'the Postgres job adapter is not wired yet (WS5 part 1b)',
    });
  }
  return createInMemoryJobQueue({
    logger: log,
    onEvent: (name, type) => metrics.inc(name, { type }),
  });
}

export interface CoreJobDeps {
  /** Bound to the shared `pg.Pool` in the worker; a pglite query in tests. */
  query: SweepQuery;
  /** Interval between recurring sweeps. Default 6h. */
  everyMs?: number;
  /**
   * Content snapshot wiring (§14). When present, the on-demand
   * `content.snapshot` job type is registered.
   */
  content?: { repos: ContentRepositories; store: ObjectStore };
  /**
   * AI content generation (Phase 4 §7, §8, WS1). Absent when no provider is
   * configured (`createAiProvider()` returned `null`) — `content.ai_generate`
   * is then simply not registered rather than registered with a handler that
   * always fails.
   */
  ai?: { provider: AiProvider; store: ObjectStore; budget: AiBudget };
}

export function registerCoreJobs(queue: JobQueue, deps: CoreJobDeps): void {
  const everyMs = deps.everyMs ?? 6 * 60 * 60 * 1000;
  const sweepDeps = { query: deps.query };

  queue.register(JOB_TYPES.RATE_LIMIT_SWEEP, {
    handler: rateLimitSweepHandler(sweepDeps),
    everyMs,
  });
  queue.register(JOB_TYPES.IDEMPOTENCY_SWEEP, {
    handler: idempotencySweepHandler(sweepDeps),
    everyMs,
  });
  queue.register(JOB_TYPES.TELEMETRY_RETENTION, {
    handler: telemetryRetentionHandler(sweepDeps),
    everyMs,
  });

  if (deps.content) {
    // On demand only — no `everyMs`. Enqueued after a content publish.
    queue.register(JOB_TYPES.CONTENT_SNAPSHOT, {
      handler: contentSnapshotHandler(deps.content),
    });
  }

  if (deps.ai) {
    // On demand only — one job per generation call (§8.3, no batch loop yet).
    queue.register(JOB_TYPES.AI_CONTENT_GENERATE, {
      handler: contentAiGenerateHandler(deps.ai),
    });
  }
}
