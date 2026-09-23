/**
 * Content Studio surface (Phase 4 WS8a) — job introspection + recent activity.
 *
 * Mounted behind `content:audit:read` (any content role) in `server/app.ts`;
 * `POST /jobs/:id/cancel` additionally requires `content:ai:run`. Every
 * response is a redacted DTO, never the raw `JobRecord.payload` — a
 * `content.ai_generate` payload carries the raw prompt text, which does not
 * belong in a list/detail view or an audit-adjacent surface.
 *
 * `jobQueue` is optional: the API process does not run jobs itself (Phase 2
 * §17 split it into its own worker deployable), so in a deployment with no
 * in-process queue wired, these endpoints report `available: false` rather
 * than fabricating an empty list. See `server/app.ts`'s `AppDeps.jobQueue` doc.
 */
import { Router } from 'express';
import type { RequestHandler } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { AppError } from '../lib/errors';
import { buildAuditRecord, type AuditLog } from '../audit';
import { JOB_TYPES, labelForJobType } from '../domains/jobs/catalog';
import type { JobQueue } from '../domains/jobs/queue';
import type { JobRecord, JobStatus } from '../domains/jobs/types';
import type { AiBudget } from '../domains/ai/budget';

export interface StudioJobSummary {
  id: string;
  type: string;
  typeLabel: string;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  label: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
}

export interface StudioJobDetail extends StudioJobSummary {
  usage: { requests: number; tokens: number; costUsd: number } | null;
  budget: AiBudget | null;
  artifactKey: string | null;
}

function payloadLabel(payload: unknown): string | null {
  if (payload && typeof payload === 'object' && 'label' in payload) {
    const label = (payload as { label?: unknown }).label;
    return typeof label === 'string' ? label : null;
  }
  return null;
}

function toSummary(job: JobRecord): StudioJobSummary {
  return {
    id: job.id,
    type: job.type,
    typeLabel: labelForJobType(job.type),
    status: job.status,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    label: payloadLabel(job.payload),
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    error: job.error,
  };
}

function toDetail(job: JobRecord, aiJobBudget: AiBudget | undefined): StudioJobDetail {
  const checkpoint = job.checkpoint ?? {};
  const usage = checkpoint.usage as
    | { requests: number; tokens: number; costUsd: number }
    | undefined;
  const artifactKey = typeof checkpoint.artifactKey === 'string' ? checkpoint.artifactKey : null;
  return {
    ...toSummary(job),
    usage: usage ?? null,
    budget: job.type === 'content.ai_generate' ? (aiJobBudget ?? null) : null,
    artifactKey,
  };
}

export interface StudioRouterDeps {
  auditLog: AuditLog;
  /** Absent when this process runs no in-process job queue — see module doc. */
  jobQueue?: JobQueue;
  aiJobBudget?: AiBudget;
  requireAiRun: RequestHandler;
}

export function createStudioRouter({
  auditLog,
  jobQueue,
  aiJobBudget,
  requireAiRun,
}: StudioRouterDeps): Router {
  const router = Router();

  const actor = (req: { auth?: { userId: string; authSource: string } }) => ({
    userId: req.auth?.userId ?? null,
    authSource: req.auth?.authSource ?? null,
  });

  router.get(
    '/jobs',
    asyncHandler(async (req, res) => {
      if (!jobQueue) {
        res.json({ available: false, jobs: [] });
        return;
      }
      const status =
        typeof req.query.status === 'string' ? (req.query.status as JobStatus) : undefined;
      const type = typeof req.query.type === 'string' ? req.query.type : undefined;
      const jobs = await jobQueue.list({ status, type, limit: 100 });
      res.json({ available: true, jobs: jobs.map(toSummary) });
    }),
  );

  router.get(
    '/jobs/:id',
    asyncHandler(async (req, res) => {
      if (!jobQueue) {
        res.json({ available: false, job: null });
        return;
      }
      const job = await jobQueue.get(req.params.id);
      if (!job) throw new AppError('job_not_found', 'No such job', 404);
      res.json({ available: true, job: toDetail(job, aiJobBudget) });
    }),
  );

  router.post(
    '/jobs',
    requireAiRun,
    asyncHandler(async (req, res) => {
      if (!jobQueue) {
        res.status(409).json({ error: 'queue_unavailable' });
        return;
      }
      const { promptVersion, prompt, label } = req.body ?? {};
      if (typeof promptVersion !== 'string' || typeof prompt !== 'string') {
        throw new AppError('invalid_body', 'promptVersion and prompt are required', 400);
      }
      const { id } = await jobQueue.enqueue(JOB_TYPES.AI_CONTENT_GENERATE, {
        promptVersion,
        prompt,
        label: typeof label === 'string' && label.trim() ? label.trim() : undefined,
      });
      await auditLog.append(
        buildAuditRecord({
          actor: actor(req),
          action: 'content.job_create',
          target: id,
          result: 'ok',
          requestId: req.id,
          metadata: { promptVersion, label: label ?? null },
        }),
      );
      res.status(201).json({ ok: true, id });
    }),
  );

  router.post(
    '/jobs/:id/cancel',
    requireAiRun,
    asyncHandler(async (req, res) => {
      if (!jobQueue) {
        res.status(409).json({ error: 'queue_unavailable' });
        return;
      }
      const cancelled = await jobQueue.cancel(req.params.id);
      await auditLog.append(
        buildAuditRecord({
          actor: actor(req),
          action: 'content.job_cancel',
          target: req.params.id,
          result: cancelled ? 'ok' : 'error',
          requestId: req.id,
        }),
      );
      if (!cancelled) throw new AppError('job_not_cancellable', 'Job is unknown or already finished', 409);
      const job = await jobQueue.get(req.params.id);
      res.json({ ok: true, job: job ? toDetail(job, aiJobBudget) : null });
    }),
  );

  router.get(
    '/activity',
    asyncHandler(async (req, res) => {
      const limit = Math.max(1, Math.min(Number(req.query.limit) || 10, 100));
      const records = await auditLog.query({ limit });
      res.json({ activity: records });
    }),
  );

  router.get(
    '/dashboard',
    asyncHandler(async (req, res) => {
      const [jobStats, activity] = await Promise.all([
        jobQueue ? jobQueue.stats() : Promise.resolve(null),
        auditLog.query({ limit: 4 }),
      ]);
      res.json({ jobs: jobStats, activity });
    }),
  );

  return router;
}
