/**
 * Content Studio quality feedback loop (Phase 4 WS9, spec §14, §18).
 *
 * Mounted at `/api/v1/studio/quality` behind `content:audit:read`:
 *
 * - `GET  /`                                  — accuracy distribution, outliers, first-option bias, open-report count.
 * - `POST /outliers/:questionId/repair`       — `content:ai:run`: enqueue a `content.ai_repair` job for an outlier.
 * - `GET  /reports`                           — player reports grouped per entity (no reporter ids).
 * - `GET  /reports/:type/:entityId`           — one entity's reports (no reporter ids).
 * - `POST /reports/:type/:entityId/resolve`   — `content:review`: close every open report, optionally linking the fixing revision.
 * - `POST /reports/:type/:entityId/repair`    — `content:ai:run`: enqueue a repair job built from the reports.
 *
 * Signals never change content by themselves: an outlier or a report only
 * leads to a repair *suggestion* (an artifact), which a person reviews through
 * the normal draft → review → publish path (§22).
 */
import { Router } from 'express';
import type { RequestHandler } from 'express';
import { buildAuditRecord, type AuditActor, type AuditLog } from '../audit';
import type { Permission } from '../authz/roles';
import type { QuestionRevisionRecord } from '../domains/content/types';
import { JOB_TYPES } from '../domains/jobs/catalog';
import type { JobQueue } from '../domains/jobs/queue';
import { analyzeAccuracy, DEFAULT_MIN_ATTEMPTS, positionBias } from '../domains/quality/analytics';
import { buildRepairPrompt, REPAIR_PROMPT_VERSION, type RepairSignal } from '../domains/quality/repairPrompt';
import type { QualityRepositories } from '../domains/quality/repository';
import type { ContentReport, ReportEntityType } from '../domains/quality/types';
import { AppError } from '../lib/errors';
import { asyncHandler } from '../middleware/asyncHandler';
import type { StudioReviewRepositories } from './studioReview';

export interface StudioQualityRouterDeps {
  auditLog: AuditLog;
  quality?: QualityRepositories;
  review?: StudioReviewRepositories;
  jobQueue?: JobQueue;
  requirePermission: (...permissions: Permission[]) => RequestHandler;
}

const OUTLIER_LIMIT = 50;
const ENTITY_TYPES: readonly ReportEntityType[] = ['question', 'lesson'];

const actorOf = (req: { auth?: { userId: string; authSource: string } }): AuditActor => ({
  userId: req.auth?.userId ?? null,
  authSource: req.auth?.authSource ?? null,
});

const iso = (value: string | null): string | null => (value ? new Date(value).toISOString() : null);

function parseEntityType(raw: string): ReportEntityType {
  if ((ENTITY_TYPES as readonly string[]).includes(raw)) return raw as ReportEntityType;
  throw new AppError('invalid_entity_type', 'type must be question or lesson', 400);
}

/** Reviewer view of one report — everything except who sent it. */
function toReviewerReport(r: ContentReport) {
  return {
    id: r.id,
    category: r.category,
    comment: r.comment,
    revisionId: r.revisionId,
    status: r.status,
    createdAt: iso(r.createdAt),
    resolutionNote: r.resolutionNote,
    resolvedRevisionId: r.resolvedRevisionId,
    resolvedBy: r.resolvedBy,
    resolvedAt: iso(r.resolvedAt),
  };
}

export function createStudioQualityRouter({
  auditLog,
  quality,
  review,
  jobQueue,
  requirePermission,
}: StudioQualityRouterDeps): Router {
  const router = Router();

  const requireQuality: RequestHandler = (_req, res, next) => {
    if (!quality || !review) {
      res.status(409).json({ error: 'quality_unavailable' });
      return;
    }
    next();
  };

  /** The revision players currently see, else the newest one — what a repair should start from. */
  async function currentQuestionRevision(questionId: string): Promise<QuestionRevisionRecord | null> {
    const published = await review!.content.revisions.getPublished(questionId);
    if (published) return published;
    const [latest] = await review!.content.revisions.listRevisions(questionId);
    return latest ?? null;
  }

  async function titleOf(type: ReportEntityType, entityId: string, revisionId: string | null): Promise<string | null> {
    if (type === 'question') {
      const revision = revisionId
        ? await review!.content.revisions.getById(revisionId)
        : await currentQuestionRevision(entityId);
      return revision?.text ?? null;
    }
    const lesson = await review!.learning.lessons.getById(entityId);
    return lesson?.title ?? null;
  }

  async function enqueueRepair(
    req: Parameters<RequestHandler>[0],
    questionId: string,
    signal: RepairSignal,
    signalLabel: string,
  ) {
    if (!jobQueue) throw new AppError('queue_unavailable', 'No job queue in this process', 409);
    const revision = await currentQuestionRevision(questionId);
    if (!revision) throw new AppError('question_not_found', 'No revision for this question', 404);
    const { id } = await jobQueue.enqueue(JOB_TYPES.AI_CONTENT_REPAIR, {
      promptVersion: REPAIR_PROMPT_VERSION,
      prompt: buildRepairPrompt(revision, signal),
      label: `repair:${questionId}`,
      questionId,
      revisionId: revision.id,
      signal: signalLabel,
    });
    await auditLog.append(
      buildAuditRecord({
        actor: actorOf(req),
        action: 'content.repair_request',
        target: questionId,
        result: 'ok',
        requestId: req.id,
        metadata: { jobId: id, revisionId: revision.id, signal: signalLabel },
      }),
    );
    return { jobId: id, revisionId: revision.id };
  }

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      if (!quality || !review) {
        res.json({ available: false, analysis: null, positionBias: null, openReports: 0 });
        return;
      }
      const minAttempts = Math.max(1, Math.min(Number(req.query.minAttempts) || DEFAULT_MIN_ATTEMPTS, 1000));
      const [stats, picks, openReports] = await Promise.all([
        quality.signals.accuracy({ minAttempts }),
        quality.signals.picks(),
        quality.reports.countOpen(),
      ]);
      const analysis = analyzeAccuracy(stats, minAttempts);
      const outliers = await Promise.all(
        analysis.outliers.slice(0, OUTLIER_LIMIT).map(async (o) => {
          const revision = await currentQuestionRevision(o.questionId);
          return {
            ...o,
            revisionId: revision?.id ?? null,
            text: revision?.text ?? null,
            themeId: revision?.themeId ?? null,
            status: revision?.status ?? null,
          };
        }),
      );
      res.json({
        available: true,
        analysis: { ...analysis, outliers, outlierTotal: analysis.outliers.length },
        positionBias: positionBias(picks),
        openReports,
      });
    }),
  );

  router.post(
    '/outliers/:questionId/repair',
    requirePermission('content:ai:run'),
    requireQuality,
    asyncHandler(async (req, res) => {
      const { questionId } = req.params;
      const [stat] = (await quality!.signals.accuracy({ minAttempts: 1 })).filter((s) => s.questionId === questionId);
      const outlier = stat ? analyzeAccuracy([stat], 1).outliers[0] : undefined;
      if (!stat || !outlier) {
        throw new AppError('not_an_outlier', 'This question is not an accuracy outlier', 409);
      }
      const result = await enqueueRepair(
        req,
        questionId,
        { kind: 'accuracy', issue: outlier.issue, accuracy: outlier.accuracy, attempts: outlier.attempts },
        `accuracy:${outlier.issue}`,
      );
      res.status(201).json({ ok: true, ...result });
    }),
  );

  router.get(
    '/reports',
    asyncHandler(async (req, res) => {
      if (!quality || !review) {
        res.json({ available: false, groups: [] });
        return;
      }
      const groups = await quality.reports.listGroups({ includeClosed: req.query.closed === '1', limit: 200 });
      const enriched = await Promise.all(
        groups.map(async (g) => ({
          ...g,
          firstAt: iso(g.firstAt),
          latestAt: iso(g.latestAt),
          title: await titleOf(g.entityType, g.entityId, g.latestRevisionId),
        })),
      );
      res.json({ available: true, groups: enriched });
    }),
  );

  router.get(
    '/reports/:type/:entityId',
    requireQuality,
    asyncHandler(async (req, res) => {
      const type = parseEntityType(req.params.type);
      const reports = await quality!.reports.listForEntity(type, req.params.entityId);
      if (reports.length === 0) throw new AppError('reports_not_found', 'No reports for this entity', 404);
      res.json({
        entityType: type,
        entityId: req.params.entityId,
        title: await titleOf(type, req.params.entityId, reports.find((r) => r.revisionId)?.revisionId ?? null),
        reports: reports.map(toReviewerReport),
      });
    }),
  );

  router.post(
    '/reports/:type/:entityId/resolve',
    requirePermission('content:review'),
    requireQuality,
    asyncHandler(async (req, res) => {
      const type = parseEntityType(req.params.type);
      const { entityId } = req.params;
      const status = req.body?.status;
      if (status !== 'resolved' && status !== 'dismissed') {
        throw new AppError('invalid_status', 'status must be resolved or dismissed', 400);
      }
      const note = typeof req.body?.note === 'string' && req.body.note.trim() ? req.body.note.trim().slice(0, 1000) : null;
      const revisionId =
        typeof req.body?.revisionId === 'string' && req.body.revisionId.trim() ? req.body.revisionId.trim() : null;
      if (revisionId) {
        const owner =
          type === 'question'
            ? (await review!.content.revisions.getById(revisionId))?.questionId
            : (await review!.learning.lessonRevisions.getById(revisionId))?.lessonId;
        if (owner !== entityId) {
          throw new AppError('revision_mismatch', 'revisionId does not belong to this entity', 400);
        }
      }
      const actor = actorOf(req);
      const closed = await quality!.reports.resolveEntity({
        entityType: type,
        entityId,
        status,
        note,
        resolvedRevisionId: revisionId,
        resolvedBy: actor.userId,
      });
      if (closed === 0) throw new AppError('no_open_reports', 'Nothing open to resolve here', 409);
      await auditLog.append(
        buildAuditRecord({
          actor,
          action: 'content.report_resolve',
          target: entityId,
          result: 'ok',
          requestId: req.id,
          metadata: { entityType: type, status, closed, resolvedRevisionId: revisionId },
        }),
      );
      res.json({ ok: true, closed });
    }),
  );

  router.post(
    '/reports/:type/:entityId/repair',
    requirePermission('content:ai:run'),
    requireQuality,
    asyncHandler(async (req, res) => {
      const type = parseEntityType(req.params.type);
      if (type !== 'question') {
        throw new AppError('repair_unsupported', 'AI repair is available for questions only', 400);
      }
      const open = (await quality!.reports.listForEntity(type, req.params.entityId)).filter((r) => r.status === 'open');
      if (open.length === 0) throw new AppError('no_open_reports', 'Nothing open to repair from', 409);
      const categories: Extract<RepairSignal, { kind: 'reports' }>['categories'] = {};
      for (const r of open) categories[r.category] = (categories[r.category] ?? 0) + 1;
      const comments = open.map((r) => r.comment).filter((c): c is string => Boolean(c));
      const result = await enqueueRepair(req, req.params.entityId, { kind: 'reports', categories, comments }, 'reports');
      res.status(201).json({ ok: true, ...result });
    }),
  );

  return router;
}
