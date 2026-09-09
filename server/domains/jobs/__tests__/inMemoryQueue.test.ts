import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInMemoryJobQueue, type InMemoryJobQueue } from '../inMemoryQueue';
import { JOB_TYPES } from '../catalog';

describe('in-memory job queue (§17)', () => {
  let clock: { current: number };
  let now: () => Date;
  let queue: InMemoryJobQueue;
  const events: Array<[string, string]> = [];

  beforeEach(() => {
    clock = { current: Date.parse('2026-09-09T00:00:00.000Z') };
    now = () => new Date(clock.current);
    events.length = 0;
    let seq = 0;
    queue = createInMemoryJobQueue({
      now,
      idGen: () => `job_${++seq}`,
      backoffMs: () => 1_000,
      onEvent: (name, type) => events.push([name, type]),
    });
  });

  const advance = (ms: number): void => {
    clock.current += ms;
  };

  it('runs a registered handler and records the outcome', async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    queue.register(JOB_TYPES.RATE_LIMIT_SWEEP, { handler: run });

    const { id, deduped } = await queue.enqueue(JOB_TYPES.RATE_LIMIT_SWEEP, {});
    expect(deduped).toBe(false);
    await queue.runDue();

    expect(run).toHaveBeenCalledOnce();
    const job = queue.peek(id)!;
    expect(job.status).toBe('completed');
    expect(job.attempts).toBe(1);
    expect(job.startedAt).not.toBeNull();
    expect(job.completedAt).not.toBeNull();
    expect(events).toContainEqual(['jobs_enqueued_total', JOB_TYPES.RATE_LIMIT_SWEEP]);
    expect(events).toContainEqual(['jobs_completed_total', JOB_TYPES.RATE_LIMIT_SWEEP]);
  });

  it('rejects a payload that fails the catalog schema', async () => {
    await expect(
      queue.enqueue(JOB_TYPES.RATE_LIMIT_SWEEP, { olderThanDays: -3 }),
    ).rejects.toThrow(/invalid payload/i);
  });

  it('de-duplicates a live idempotency key', async () => {
    queue.register(JOB_TYPES.IDEMPOTENCY_SWEEP, { handler: vi.fn().mockResolvedValue(undefined) });
    const a = await queue.enqueue(JOB_TYPES.IDEMPOTENCY_SWEEP, {}, { idempotencyKey: 'k1' });
    const b = await queue.enqueue(JOB_TYPES.IDEMPOTENCY_SWEEP, {}, { idempotencyKey: 'k1' });
    expect(b.deduped).toBe(true);
    expect(b.id).toBe(a.id);

    await queue.runDue(); // a completes → key no longer live
    const c = await queue.enqueue(JOB_TYPES.IDEMPOTENCY_SWEEP, {}, { idempotencyKey: 'k1' });
    expect(c.deduped).toBe(false);
    expect(c.id).not.toBe(a.id);
  });

  it('retries with backoff and eventually completes', async () => {
    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom-1'))
      .mockRejectedValueOnce(new Error('boom-2'))
      .mockResolvedValueOnce(undefined);
    queue.register(JOB_TYPES.TELEMETRY_RETENTION, { handler: run, maxAttempts: 3 });
    const { id } = await queue.enqueue(JOB_TYPES.TELEMETRY_RETENTION, {});

    await queue.runDue();
    expect(queue.peek(id)!.status).toBe('retry');
    expect(queue.peek(id)!.error).toBe('boom-1');

    await queue.runDue(); // not due yet (backoff)
    expect(queue.peek(id)!.attempts).toBe(1);

    advance(1_000);
    await queue.runDue();
    expect(queue.peek(id)!.status).toBe('retry');

    advance(1_000);
    await queue.runDue();
    const job = queue.peek(id)!;
    expect(job.status).toBe('completed');
    expect(job.attempts).toBe(3);
    expect(events.filter(([n]) => n === 'jobs_retried_total')).toHaveLength(2);
  });

  it('dead-letters after exhausting maxAttempts', async () => {
    queue.register(JOB_TYPES.RATE_LIMIT_SWEEP, {
      handler: vi.fn().mockRejectedValue(new Error('always')),
      maxAttempts: 2,
    });
    const { id } = await queue.enqueue(JOB_TYPES.RATE_LIMIT_SWEEP, {});

    await queue.runDue();
    advance(1_000);
    await queue.runDue();

    const job = queue.peek(id)!;
    expect(job.status).toBe('failed');
    expect(job.attempts).toBe(2);
    expect(events).toContainEqual(['jobs_failed_total', JOB_TYPES.RATE_LIMIT_SWEEP]);
  });

  it('passes the previous checkpoint to a retry', async () => {
    const seen: Array<Record<string, unknown> | null> = [];
    const run = vi.fn(async (ctx) => {
      seen.push(ctx.job.checkpoint);
      await ctx.checkpoint({ step: (seen.length as number) });
      if (seen.length < 2) throw new Error('again');
    });
    queue.register(JOB_TYPES.TELEMETRY_RETENTION, { handler: run });
    await queue.enqueue(JOB_TYPES.TELEMETRY_RETENTION, {});

    await queue.runDue();
    advance(1_000);
    await queue.runDue();

    expect(seen[0]).toBeNull();
    expect(seen[1]).toEqual({ step: 1 });
  });

  it('honours delayMs', async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    queue.register(JOB_TYPES.RATE_LIMIT_SWEEP, { handler: run });
    await queue.enqueue(JOB_TYPES.RATE_LIMIT_SWEEP, {}, { delayMs: 5_000 });

    await queue.runDue();
    expect(run).not.toHaveBeenCalled();

    advance(5_000);
    await queue.runDue();
    expect(run).toHaveBeenCalledOnce();
  });

  it('enqueues one scheduled job on start and reports it in stats', async () => {
    queue.register(JOB_TYPES.RATE_LIMIT_SWEEP, {
      handler: vi.fn().mockResolvedValue(undefined),
      everyMs: 60_000,
    });
    await queue.start();
    const stats = await queue.stats();
    expect(stats.types).toContain(JOB_TYPES.RATE_LIMIT_SWEEP);
    // started immediately, then completed by start()'s initial drain
    expect(stats.byStatus.completed).toBe(1);
    await queue.stop();
  });

  it('aborts a running handler on stop', async () => {
    let aborted = false;
    queue.register(JOB_TYPES.TELEMETRY_RETENTION, {
      handler: (ctx) =>
        new Promise((resolve) => {
          ctx.signal.addEventListener('abort', () => {
            aborted = true;
            resolve();
          });
        }),
    });
    await queue.enqueue(JOB_TYPES.TELEMETRY_RETENTION, {});
    const running = queue.runDue();
    await queue.stop(1_000);
    await running;
    expect(aborted).toBe(true);
  });

  it('refuses to register a type twice', () => {
    queue.register(JOB_TYPES.RATE_LIMIT_SWEEP, { handler: vi.fn() });
    expect(() => queue.register(JOB_TYPES.RATE_LIMIT_SWEEP, { handler: vi.fn() })).toThrow(
      /already registered/,
    );
  });
});
