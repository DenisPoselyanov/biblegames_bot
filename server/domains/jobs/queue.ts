/**
 * `JobQueue` — the abstraction every job producer and the worker depend on
 * (Phase 2 §17). Adapters: `./inMemoryQueue.ts` (default, dev/test) and
 * `server/infrastructure/jobs/` (Postgres/pg-boss, opt-in via config).
 */

import type {
  EnqueueOptions,
  JobHandler,
  JobRecord,
  JobStatus,
  JobTypeRegistration,
} from './types';

export interface EnqueueResult {
  id: string;
  /** True when an existing job with the same live idempotency key was returned. */
  deduped: boolean;
}

export interface JobQueueStats {
  byStatus: Record<JobStatus, number>;
  /** Registered job types. */
  types: string[];
}

export interface JobListFilter {
  status?: JobStatus;
  type?: string;
  /** Default 50, capped by the adapter. */
  limit?: number;
}

export interface JobQueue {
  /**
   * Register the handler for a job type. Must be called before `start()`.
   * Registering a type twice throws — one owner per type.
   */
  register<Payload>(type: string, registration: JobTypeRegistration<Payload>): void;

  /** Enqueue one job. Safe to call before or after `start()`. */
  enqueue<Payload>(
    type: string,
    payload: Payload,
    options?: EnqueueOptions,
  ): Promise<EnqueueResult>;

  /** Begin processing (starts schedule timers and the poll loop). Idempotent. */
  start(): Promise<void>;

  /**
   * Stop processing: cancel timers, signal running handlers via their
   * `AbortSignal`, and wait (up to `graceMs`) for them to settle. Idempotent.
   */
  stop(graceMs?: number): Promise<void>;

  stats(): Promise<JobQueueStats>;

  /**
   * List jobs, newest first (Phase 4 WS8 — Studio Jobs screen). Read-only
   * introspection; adapters may cap `limit`.
   */
  list(filter?: JobListFilter): Promise<JobRecord[]>;

  /** One job by id, or `undefined` if unknown (Phase 4 WS8). */
  get(id: string): Promise<JobRecord | undefined>;

  /**
   * Request cancellation (Phase 4 WS8). A `pending`/`retry` job is cancelled
   * immediately; an `active` job's handler is signalled to abort and is
   * cancelled once it stops (or forcibly, if it never observes the signal).
   * Returns `false` when the job is unknown or already terminal.
   */
  cancel(id: string): Promise<boolean>;
}

export type { JobHandler, JobRecord, JobTypeRegistration, EnqueueOptions };
