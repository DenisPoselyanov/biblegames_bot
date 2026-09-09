/**
 * In-memory `JobQueue` (Phase 2 §17) — the default adapter.
 *
 * Used in every environment that has no database wired, and in tests. It keeps
 * jobs in a `Map`, runs them on a poll loop once `start()` is called, retries
 * with capped exponential backoff, and dead-letters after `maxAttempts`. Jobs
 * do not survive a restart — the Postgres adapter
 * (`server/infrastructure/jobs/`) is the durable option.
 *
 * Tests can bypass the timer with `runDue()`.
 */
import { payloadSchemaFor } from './catalog';
import type { JobQueue, JobQueueStats, EnqueueResult } from './queue';
import type {
  EnqueueOptions,
  JobRecord,
  JobStatus,
  JobTypeRegistration,
} from './types';

export interface InMemoryJobQueueOptions {
  now?: () => Date;
  /** Poll interval once started. Default 250ms. */
  pollMs?: number;
  /** Backoff before retry N (1-based). Default: 1s, 5s, 30s, capped 30s. */
  backoffMs?: (attempt: number) => number;
  idGen?: () => string;
  logger?: {
    info: (msg: string, fields?: Record<string, unknown>) => void;
    warn: (msg: string, fields?: Record<string, unknown>) => void;
    error: (msg: string, fields?: Record<string, unknown>) => void;
  };
  /** `metrics.inc` — counters are `jobs_*_total{type}`. */
  onEvent?: (name: string, type: string) => void;
}

const DEFAULT_BACKOFF = (attempt: number): number =>
  Math.min(30_000, 1_000 * 5 ** (attempt - 1));

const TERMINAL: ReadonlySet<JobStatus> = new Set<JobStatus>(['completed', 'failed']);

function redactError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.length > 300 ? `${msg.slice(0, 297)}...` : msg;
}

interface Registration {
  handler: JobTypeRegistration<unknown>['handler'];
  maxAttempts: number;
  everyMs?: number;
}

export interface InMemoryJobQueue extends JobQueue {
  /** Test hook: run every job that is due now, to completion/retry. Returns the count run. */
  runDue(): Promise<number>;
  /** Test hook: read a job record. */
  peek(id: string): JobRecord | undefined;
}

export function createInMemoryJobQueue(
  options: InMemoryJobQueueOptions = {},
): InMemoryJobQueue {
  const now = options.now ?? (() => new Date());
  const pollMs = options.pollMs ?? 250;
  const backoffMs = options.backoffMs ?? DEFAULT_BACKOFF;
  const idGen =
    options.idGen ?? (() => `job_${Math.random().toString(36).slice(2, 12)}`);
  const log = options.logger;
  const emit = options.onEvent ?? (() => {});

  const registrations = new Map<string, Registration>();
  const jobs = new Map<string, JobRecord>();
  const running = new Map<string, Promise<void>>();
  const controllers = new Map<string, AbortController>();

  let pollTimer: ReturnType<typeof setInterval> | null = null;
  const scheduleTimers: ReturnType<typeof setInterval>[] = [];
  let started = false;
  let stopping = false;

  function register<Payload>(
    type: string,
    registration: JobTypeRegistration<Payload>,
  ): void {
    if (registrations.has(type)) {
      throw new Error(`job type "${type}" is already registered`);
    }
    registrations.set(type, {
      handler: registration.handler as Registration['handler'],
      maxAttempts: Math.max(1, registration.maxAttempts ?? 3),
      everyMs: registration.everyMs,
    });
  }

  function liveDuplicate(type: string, key: string): JobRecord | undefined {
    for (const job of jobs.values()) {
      if (job.type === type && job.idempotencyKey === key && !TERMINAL.has(job.status)) {
        return job;
      }
    }
    return undefined;
  }

  async function enqueue<Payload>(
    type: string,
    payload: Payload,
    opts: EnqueueOptions = {},
  ): Promise<EnqueueResult> {
    const parsed = payloadSchemaFor(type).safeParse(payload);
    if (!parsed.success) {
      throw new Error(`invalid payload for job "${type}": ${parsed.error.message}`);
    }
    const key = opts.idempotencyKey ?? null;
    if (key) {
      const existing = liveDuplicate(type, key);
      if (existing) return { id: existing.id, deduped: true };
    }
    const at = now();
    const registration = registrations.get(type);
    const job: JobRecord = {
      id: idGen(),
      type,
      status: 'pending',
      payload: parsed.data,
      attempts: 0,
      maxAttempts: Math.max(1, opts.maxAttempts ?? registration?.maxAttempts ?? 3),
      idempotencyKey: key,
      checkpoint: null,
      error: null,
      createdAt: at.toISOString(),
      startedAt: null,
      completedAt: null,
      runAfter: new Date(at.getTime() + Math.max(0, opts.delayMs ?? 0)).toISOString(),
    };
    jobs.set(job.id, job);
    emit('jobs_enqueued_total', type);
    return { id: job.id, deduped: false };
  }

  function dueJobs(): JobRecord[] {
    const nowMs = now().getTime();
    return [...jobs.values()].filter(
      (j) =>
        (j.status === 'pending' || j.status === 'retry') &&
        Date.parse(j.runAfter) <= nowMs &&
        !running.has(j.id) &&
        registrations.has(j.type),
    );
  }

  async function runJob(job: JobRecord): Promise<void> {
    const registration = registrations.get(job.type);
    if (!registration) return;

    const controller = new AbortController();
    controllers.set(job.id, controller);
    job.status = 'active';
    job.startedAt = now().toISOString();
    emit('jobs_started_total', job.type);

    const ctx = {
      job,
      signal: controller.signal,
      async checkpoint(patch: Record<string, unknown>): Promise<void> {
        job.checkpoint = { ...(job.checkpoint ?? {}), ...patch };
      },
    };

    try {
      await registration.handler(ctx);
      job.attempts += 1;
      job.status = 'completed';
      job.completedAt = now().toISOString();
      job.error = null;
      emit('jobs_completed_total', job.type);
      log?.info('job.completed', { jobId: job.id, type: job.type, attempts: job.attempts });
    } catch (err) {
      job.attempts += 1;
      job.error = redactError(err);
      if (job.attempts < job.maxAttempts) {
        job.status = 'retry';
        job.runAfter = new Date(
          now().getTime() + backoffMs(job.attempts),
        ).toISOString();
        emit('jobs_retried_total', job.type);
        log?.warn('job.retry', {
          jobId: job.id,
          type: job.type,
          attempts: job.attempts,
          maxAttempts: job.maxAttempts,
          error: job.error,
        });
      } else {
        job.status = 'failed';
        job.completedAt = now().toISOString();
        emit('jobs_failed_total', job.type);
        log?.error('job.failed', {
          jobId: job.id,
          type: job.type,
          attempts: job.attempts,
          error: job.error,
        });
      }
    } finally {
      controllers.delete(job.id);
    }
  }

  function kick(job: JobRecord): void {
    const p = runJob(job).finally(() => running.delete(job.id));
    running.set(job.id, p);
  }

  async function runDue(): Promise<number> {
    const due = dueJobs();
    for (const job of due) kick(job);
    await Promise.all([...running.values()]);
    return due.length;
  }

  async function start(): Promise<void> {
    if (started) return;
    started = true;
    stopping = false;

    for (const [type, registration] of registrations) {
      if (!registration.everyMs) continue;
      // one immediately, deduped against any in-flight run
      void enqueue(type, {}, { idempotencyKey: `schedule:${type}` });
      const timer = setInterval(() => {
        void enqueue(type, {}, { idempotencyKey: `schedule:${type}` });
      }, registration.everyMs);
      if (typeof timer.unref === 'function') timer.unref();
      scheduleTimers.push(timer);
    }

    pollTimer = setInterval(() => {
      if (stopping) return;
      void runDue();
    }, pollMs);
    if (pollTimer && typeof pollTimer.unref === 'function') pollTimer.unref();

    await runDue();
  }

  async function stop(graceMs = 5_000): Promise<void> {
    stopping = true;
    started = false;
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    for (const t of scheduleTimers.splice(0)) clearInterval(t);
    for (const c of controllers.values()) c.abort();

    const inflight = [...running.values()];
    if (inflight.length === 0) return;
    await Promise.race([
      Promise.allSettled(inflight),
      new Promise<void>((resolve) => {
        const t = setTimeout(resolve, graceMs);
        if (typeof t.unref === 'function') t.unref();
      }),
    ]);
  }

  async function stats(): Promise<JobQueueStats> {
    const byStatus: Record<JobStatus, number> = {
      pending: 0,
      active: 0,
      completed: 0,
      retry: 0,
      failed: 0,
    };
    for (const job of jobs.values()) byStatus[job.status] += 1;
    return { byStatus, types: [...registrations.keys()].sort() };
  }

  return {
    register,
    enqueue,
    start,
    stop,
    stats,
    runDue,
    peek: (id) => jobs.get(id),
  };
}
