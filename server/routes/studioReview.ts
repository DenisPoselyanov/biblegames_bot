/**
 * Content Studio review queue + review editor (Phase 4 WS8b).
 *
 * Mounted at `/api/v1/studio/review` behind `content:audit:read` (any content
 * role may read the queue) in `server/app.ts`. Each write is gated by its own
 * permission from WS5's vocabulary, fail-closed via `requirePermission`:
 *
 * - `POST /:type/:id/approve`         — `content:approve`
 * - `POST /:type/:id/request-changes` — `content:review`
 * - `POST /:type/:id/publish`         — `content:publish` (+ standing approval, + WS6 gate)
 * - `POST /scripture/:evidenceId/decision` — `content:review`
 *
 * `review` is optional: without a database (and no injected in-memory peer)
 * there are no revision repositories to read, so the endpoints report
 * `available: false` instead of an empty queue that looks like "nothing to
 * review" — same honesty rule as the Jobs endpoints in `./studio.ts`.
 */
import { Router } from 'express';
import type { RequestHandler } from 'express';
import { CONTENT_STATUS_VALUES, type ContentStatus } from '../../contracts/index';
import type { AuditActor, AuditLog } from '../audit';
import type { Permission } from '../authz/roles';
import type { ContentRepositories } from '../domains/content/repository';
import type { LearningRepositories } from '../domains/learning/repository';
import type { ScriptureEvidenceRepository } from '../domains/shared/scriptureEvidenceRepository';
import type { ValidationFindingRepository } from '../domains/shared/validationFindingsRepository';
import { AppError } from '../lib/errors';
import { asyncHandler } from '../middleware/asyncHandler';
import { createContentReviewService } from '../services/contentReviewService';
import {
  createContentReviewWorkflow,
  type ReviewRevisionType,
} from '../services/contentReviewWorkflow';

export interface StudioReviewRepositories {
  content: ContentRepositories;
  learning: LearningRepositories;
  findings: ValidationFindingRepository;
  scripture: ScriptureEvidenceRepository;
}

export interface StudioReviewRouterDeps {
  auditLog: AuditLog;
  /** Absent without a database — see module doc. */
  review?: StudioReviewRepositories;
  requirePermission: (...permissions: Permission[]) => RequestHandler;
}

const REVISION_TYPES: readonly ReviewRevisionType[] = ['question', 'lesson'];

function parseType(raw: unknown): ReviewRevisionType {
  if (typeof raw === 'string' && (REVISION_TYPES as readonly string[]).includes(raw)) {
    return raw as ReviewRevisionType;
  }
  throw new AppError('invalid_revision_type', 'type must be question or lesson', 400);
}

function parseStatuses(raw: unknown): ContentStatus[] | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  const values = raw.split(',').map((s) => s.trim());
  const invalid = values.filter((v) => !(CONTENT_STATUS_VALUES as readonly string[]).includes(v));
  if (invalid.length) {
    throw new AppError('invalid_status', `Unknown status: ${invalid.join(', ')}`, 400);
  }
  return values as ContentStatus[];
}

const actorOf = (req: { auth?: { userId: string; authSource: string } }): AuditActor => ({
  userId: req.auth?.userId ?? null,
  authSource: req.auth?.authSource ?? null,
});

export function createStudioReviewRouter({
  auditLog,
  review,
  requirePermission,
}: StudioReviewRouterDeps): Router {
  const router = Router();

  const workflow = review
    ? createContentReviewWorkflow({
        content: review.content,
        learning: review.learning,
        gates: { findings: review.findings, scripture: review.scripture },
        auditLog,
      })
    : undefined;
  const reviewService = review
    ? createContentReviewService({ scripture: review.scripture, auditLog })
    : undefined;

  /** Every write needs the repositories; a read degrades to `available: false` instead. */
  const requireAvailable: RequestHandler = (_req, res, next) => {
    if (!workflow) {
      res.status(409).json({ error: 'review_unavailable' });
      return;
    }
    next();
  };

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      if (!workflow) {
        res.json({ available: false, items: [], counts: null });
        return;
      }
      const type = req.query.type ? parseType(req.query.type) : undefined;
      const statuses = parseStatuses(req.query.status);
      const limit = Math.max(1, Math.min(Number(req.query.limit) || 100, 500));
      const queue = await workflow.listQueue({ type, statuses, limit });
      res.json({ available: true, ...queue });
    }),
  );

  router.get(
    '/:type/:revisionId',
    asyncHandler(async (req, res) => {
      if (!workflow) {
        res.json({ available: false, detail: null });
        return;
      }
      const detail = await workflow.getDetail(parseType(req.params.type), req.params.revisionId);
      if (!detail) throw new AppError('revision_not_found', 'No such revision', 404);
      res.json({ available: true, detail });
    }),
  );

  router.post(
    '/:type/:revisionId/approve',
    requirePermission('content:approve'),
    requireAvailable,
    asyncHandler(async (req, res) => {
      const decision = await workflow!.decide(
        parseType(req.params.type),
        req.params.revisionId,
        'approved',
        actorOf(req),
        { comment: typeof req.body?.comment === 'string' ? req.body.comment : null, requestId: req.id },
      );
      res.json({ ok: true, decision });
    }),
  );

  router.post(
    '/:type/:revisionId/request-changes',
    requirePermission('content:review'),
    requireAvailable,
    asyncHandler(async (req, res) => {
      const decision = await workflow!.decide(
        parseType(req.params.type),
        req.params.revisionId,
        'changes_requested',
        actorOf(req),
        { comment: typeof req.body?.comment === 'string' ? req.body.comment : null, requestId: req.id },
      );
      res.json({ ok: true, decision });
    }),
  );

  router.post(
    '/:type/:revisionId/publish',
    requirePermission('content:publish'),
    requireAvailable,
    asyncHandler(async (req, res) => {
      // Explicit confirmation (spec §10 "approval with explicit confirmation"):
      // the client must echo the revision id it is looking at, so a stale tab
      // or a replayed request can't publish something the publisher never saw.
      if (req.body?.confirmRevisionId !== req.params.revisionId) {
        throw new AppError('confirmation_required', 'Confirm the exact revision to publish', 400);
      }
      const revision = await workflow!.publish(
        parseType(req.params.type),
        req.params.revisionId,
        actorOf(req),
        req.id,
      );
      res.json({ ok: true, revisionId: revision.id, status: revision.status });
    }),
  );

  router.post(
    '/scripture/:evidenceId/decision',
    requirePermission('content:review'),
    requireAvailable,
    asyncHandler(async (req, res) => {
      const decision = req.body?.decision;
      if (decision !== 'accepted' && decision !== 'rejected') {
        throw new AppError('invalid_decision', 'decision must be accepted or rejected', 400);
      }
      try {
        const evidence = await reviewService!.recordScriptureReviewerDecision(
          req.params.evidenceId,
          decision,
          actorOf(req),
          req.id,
        );
        res.json({ ok: true, evidence });
      } catch (err) {
        // Both evidence adapters throw a plain `Error` for an unknown id (WS4).
        if (err instanceof Error && !(err instanceof AppError) && /not found/.test(err.message)) {
          throw new AppError('evidence_not_found', 'No such Scripture evidence', 404);
        }
        throw err;
      }
    }),
  );

  return router;
}
