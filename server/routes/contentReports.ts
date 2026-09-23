/**
 * Player content-error reports (Phase 4 WS9, spec §14).
 *
 * `POST /api/v1/content-reports` — any authenticated player; tightly rate
 * limited in `server/app.ts`. A report is stored and audited, nothing else:
 * it never changes content (§22) and never reveals other players' reports.
 * `GET /api/v1/content-reports/mine` — the player's own reports and their
 * status ("optional user acknowledgement").
 *
 * Without a database there is nowhere durable to put a report, so the
 * endpoints answer 503 rather than accepting reports into memory and losing
 * them on restart.
 */
import { Router } from 'express';
import { contentReportsContract } from '../../contracts/index';
import { buildAuditRecord, type AuditLog } from '../audit';
import type { ContentRepositories } from '../domains/content/repository';
import type { ContentReportRepository } from '../domains/quality/repository';
import type { ContentReport } from '../domains/quality/types';
import { AppError } from '../lib/errors';
import { asyncHandler } from '../middleware/asyncHandler';
import { validateBody } from '../middleware/validate';

export interface ContentReportsRouterDeps {
  auditLog: AuditLog;
  reports?: ContentReportRepository;
  /** When present, a question report's `revisionId` is checked against its `entityId`. */
  content?: ContentRepositories;
}

const iso = (value: string | null): string | null => (value ? new Date(value).toISOString() : null);

/** The player's own view — no reviewer note, no resolver id, no other players. */
export function toMyReport(r: ContentReport): contentReportsContract.MyContentReport {
  return {
    id: r.id,
    entityType: r.entityType,
    entityId: r.entityId,
    category: r.category,
    status: r.status,
    createdAt: iso(r.createdAt)!,
    resolvedAt: iso(r.resolvedAt),
  };
}

export function createContentReportsRouter({ auditLog, reports, content }: ContentReportsRouterDeps): Router {
  const router = Router();

  const requireReports = (): ContentReportRepository => {
    if (!reports) throw new AppError('reports_unavailable', 'Content reports need a database', 503);
    return reports;
  };

  router.post(
    '/',
    validateBody(contentReportsContract.contentReportCreateRequest, 'invalid_content_report'),
    asyncHandler(async (req, res) => {
      const repo = requireReports();
      const userId = req.auth!.userId;
      const body = req.body as contentReportsContract.ContentReportCreateRequest;

      if (body.entityType === 'question' && body.revisionId && content) {
        const revision = await content.revisions.getById(body.revisionId);
        if (!revision || revision.questionId !== body.entityId) {
          throw new AppError('revision_mismatch', 'revisionId does not belong to this question', 400);
        }
      }

      const outcome = await repo.create({
        entityType: body.entityType,
        entityId: body.entityId,
        revisionId: body.revisionId ?? null,
        reporterUserId: userId,
        category: body.category,
        comment: body.comment?.trim() ? body.comment.trim() : null,
        sessionId: body.sessionId ?? null,
      });

      if (outcome.kind === 'created') {
        // The comment stays out of the audit log — it may contain anything a player typed.
        await auditLog.append(
          buildAuditRecord({
            actor: { userId, authSource: req.auth?.authSource ?? null },
            action: 'content.report_create',
            target: body.entityId,
            result: 'ok',
            requestId: req.id,
            metadata: {
              reportId: outcome.report.id,
              entityType: body.entityType,
              category: body.category,
              revisionId: body.revisionId ?? null,
            },
          }),
        );
      }

      res.status(outcome.kind === 'created' ? 201 : 200).json({
        report: toMyReport(outcome.report),
        duplicate: outcome.kind === 'duplicate',
      });
    }),
  );

  router.get(
    '/mine',
    asyncHandler(async (req, res) => {
      const mine = await requireReports().listByReporter(req.auth!.userId, 20);
      res.json({ reports: mine.map(toMyReport) });
    }),
  );

  return router;
}
