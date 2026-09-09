/**
 * Background job contract (Phase 2 §17).
 *
 * A job is a unit of deferred work with an at-least-once delivery guarantee.
 * The record carries everything §17 asks for: id, type, status, attempts,
 * created/started/completed time, error, checkpoint and idempotency. Long work
 * (content import, snapshot creation, telemetry rollup, cleanup/expiry) runs
 * here — never inside an HTTP request (§17, acc. #13-adjacent).
 *
 * This module is pure: no `pg`, no Express, no Socket.IO. The in-memory adapter
 * (`./inMemoryQueue.ts`) is the default; the Postgres/pg-boss adapter lives in
 * `server/infrastructure/jobs/` and implements the same `JobQueue` interface.
 */

export type JobStatus =
  | 'pending' // enqueued, not yet picked up
  | 'active' // a worker is running the handler
  | 'completed' // handler resolved
  | 'retry' // handler threw, attempts remain — will run again after backoff
  | 'failed'; // handler threw and exhausted `maxAttempts` (dead letter)

export interface JobRecord<Payload = unknown> {
  id: string;
  type: string;
  status: JobStatus;
  payload: Payload;
  /** Completed attempts (0 until the first run finishes or throws). */
  attempts: number;
  maxAttempts: number;
  /**
   * De-duplication token. A second `enqueue` with a live key for the same type
   * is a no-op that returns the existing job id (`deduped: true`).
   */
  idempotencyKey: string | null;
  /**
   * Handler-written progress. A retry receives the last checkpoint so it can
   * resume instead of restarting (§17 "checkpoint").
   */
  checkpoint: Record<string, unknown> | null;
  /** Last failure message (redacted — never a payload dump). */
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  /** Earliest time the job may run — set on enqueue delay and on retry backoff. */
  runAfter: string;
}

export interface EnqueueOptions {
  idempotencyKey?: string;
  /** Total attempts before the job is dead-lettered. Default 3. */
  maxAttempts?: number;
  /** Delay before the job becomes runnable. Default 0. */
  delayMs?: number;
}

export interface JobContext<Payload> {
  readonly job: JobRecord<Payload>;
  /**
   * Persist progress. Merges into the current checkpoint and is visible to the
   * next attempt via `ctx.job.checkpoint`.
   */
  checkpoint(patch: Record<string, unknown>): Promise<void>;
  /** Aborted when the queue is stopping — handlers should bail out promptly. */
  readonly signal: AbortSignal;
}

export type JobHandler<Payload> = (ctx: JobContext<Payload>) => Promise<void>;

export interface JobTypeRegistration<Payload> {
  handler: JobHandler<Payload>;
  /** Default `maxAttempts` for this type when `enqueue` doesn't override it. */
  maxAttempts?: number;
  /** Fixed-interval schedule. The queue enqueues one job per tick (deduped). */
  everyMs?: number;
}
