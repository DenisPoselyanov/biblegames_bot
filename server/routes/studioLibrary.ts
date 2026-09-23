/**
 * Content Studio library + releases (Phase 4 WS8c).
 *
 * Two routers over the same repositories the WS8b review queue reads
 * (`StudioReviewRepositories`), each mounted at its own prefix in
 * `server/app.ts` behind `content:audit:read`:
 *
 * - `/api/v1/studio/library`  — per-theme question coverage by lifecycle status
 *   (theme titles from the same `src/data/themes.ts` catalog players browse)
 *   and a validation-findings summary. Read-only.
 * - `/api/v1/studio/releases` — every published content-set version, the
 *   revision-level publish/rollback history from the audit log, and set
 *   rollback (`content:rollback`, explicit `confirmSetId` echo — same rule as
 *   the review editor's `confirmRevisionId`).
 *
 * Without repositories (no database) the reads report `available: false`, not
 * an empty library — same honesty rule as the Jobs and Review endpoints.
 */
import { Router } from 'express';
import type { RequestHandler } from 'express';
import { CONTENT_STATUS_VALUES, type ContentStatus } from '../../contracts/index';
import { CATEGORIES } from '../../src/data/categories';
import { THEMES } from '../../src/data/themes';
import type { AuditActor, AuditLog, AuditRecord } from '../audit';
import type { Permission } from '../authz/roles';
import { AppError } from '../lib/errors';
import { asyncHandler } from '../middleware/asyncHandler';
import { createContentPublicationService } from '../services/contentPublicationService';
import { setVersionHead } from '../domains/content/types';
import type { StudioReviewRepositories } from './studioReview';

type StatusCounts = Record<ContentStatus, number>;

const emptyCounts = (): StatusCounts =>
  Object.fromEntries(CONTENT_STATUS_VALUES.map((s) => [s, 0])) as StatusCounts;

export interface LibraryTheme {
  themeId: string;
  title: string;
  /** `null` for a theme id that exists in the database but not in the player-facing catalog. */
  categoryId: string | null;
  categoryTitle: string | null;
  /** False when revisions reference a theme the catalog doesn't know — players can't reach it. */
  inCatalog: boolean;
  counts: StatusCounts;
}

const actorOf = (req: { auth?: { userId: string; authSource: string } }): AuditActor => ({
  userId: req.auth?.userId ?? null,
  authSource: req.auth?.authSource ?? null,
});

function categoryOf(themeId: string): { id: string; title: string } | null {
  const category = CATEGORIES.find((c) => c.themeIds.includes(themeId));
  if (category) return { id: category.id, title: category.title };
  const theme = THEMES.find((t) => t.id === themeId);
  const fallback = theme ? CATEGORIES.find((c) => c.id === theme.categoryId) : undefined;
  return fallback ? { id: fallback.id, title: fallback.title } : null;
}

export function createStudioLibraryRouter({ review }: { review?: StudioReviewRepositories }): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      if (!review) {
        res.json({ available: false, themes: [], findings: [] });
        return;
      }
      const [byTheme, findings] = await Promise.all([
        review.content.revisions.countByTheme(),
        review.findings.summarize(),
      ]);

      const themes = new Map<string, LibraryTheme>();
      const ensure = (themeId: string): LibraryTheme => {
        let row = themes.get(themeId);
        if (!row) {
          const catalog = THEMES.find((t) => t.id === themeId);
          const category = categoryOf(themeId);
          row = {
            themeId,
            title: catalog?.title ?? themeId,
            categoryId: category?.id ?? null,
            categoryTitle: category?.title ?? null,
            inCatalog: Boolean(catalog),
            counts: emptyCounts(),
          };
          themes.set(themeId, row);
        }
        return row;
      };
      // Every catalog theme appears, even with zero revisions — an empty theme
      // players can open is exactly what the library exists to surface.
      for (const theme of THEMES) ensure(theme.id);
      for (const bucket of byTheme) ensure(bucket.themeId).counts[bucket.status] += bucket.count;

      res.json({ available: true, themes: [...themes.values()], findings });
    }),
  );

  return router;
}

export interface StudioReleasesRouterDeps {
  auditLog: AuditLog;
  review?: StudioReviewRepositories;
  requirePermission: (...permissions: Permission[]) => RequestHandler;
}

/** Audit actions that changed what players get — the revision-level publication history. */
const PUBLICATION_ACTIONS = ['content.publish', 'content.rollback', 'content.publish_denied'] as const;
const HISTORY_LIMIT = 50;
const ITEM_PREVIEW_LIMIT = 100;

export function createStudioReleasesRouter({
  auditLog,
  review,
  requirePermission,
}: StudioReleasesRouterDeps): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      const perAction = await Promise.all(
        PUBLICATION_ACTIONS.map((action) => auditLog.query({ action, limit: HISTORY_LIMIT })),
      );
      const history = perAction
        .flat()
        .sort((a: AuditRecord, b: AuditRecord) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
        .slice(0, HISTORY_LIMIT);
      if (!review) {
        res.json({ available: false, sets: [], history });
        return;
      }
      const sets = await review.content.sets.listVersions({ limit: 100 });
      res.json({ available: true, sets, history });
    }),
  );

  router.get(
    '/:setId/versions/:version',
    asyncHandler(async (req, res) => {
      if (!review) {
        res.json({ available: false, version: null, items: [] });
        return;
      }
      const version = Number(req.params.version);
      if (!Number.isInteger(version) || version < 1) {
        throw new AppError('invalid_version', 'version must be a positive integer', 400);
      }
      const [record, latest] = await Promise.all([
        review.content.sets.getVersion(req.params.setId, version),
        review.content.sets.getLatest(req.params.setId),
      ]);
      if (!record) throw new AppError('content_set_version_not_found', 'No such set version', 404);
      const preview = await Promise.all(
        record.items.slice(0, ITEM_PREVIEW_LIMIT).map(async (item) => {
          const revision = await review.content.revisions.getById(item.revisionId);
          return {
            ...item,
            text: revision?.text ?? null,
            status: revision?.status ?? null,
            themeId: revision?.themeId ?? null,
          };
        }),
      );
      res.json({
        available: true,
        version: { ...setVersionHead(record), isLatest: latest?.version === record.version, latestVersion: latest?.version ?? null },
        items: preview,
        truncated: record.items.length > preview.length,
      });
    }),
  );

  router.post(
    '/:setId/rollback',
    requirePermission('content:rollback'),
    asyncHandler(async (req, res) => {
      if (!review) {
        res.status(409).json({ error: 'releases_unavailable' });
        return;
      }
      const { setId } = req.params;
      // Explicit confirmation: the client echoes the set it is looking at, so a
      // stale tab or a replayed request can't roll back a set nobody opened.
      if (req.body?.confirmSetId !== setId) {
        throw new AppError('confirmation_required', 'Confirm the exact set to roll back', 400);
      }
      const toVersion = Number(req.body?.toVersion);
      if (!Number.isInteger(toVersion) || toVersion < 1) {
        throw new AppError('invalid_version', 'toVersion must be a positive integer', 400);
      }
      const latest = await review.content.sets.getLatest(setId);
      if (!latest) throw new AppError('content_set_not_found', 'No such set', 404);
      if (toVersion >= latest.version) {
        throw new AppError('rollback_not_older', 'Roll back only to a version older than the active one', 409);
      }
      const actor = actorOf(req);
      const publication = createContentPublicationService({
        content: review.content,
        learning: review.learning,
        gates: { findings: review.findings, scripture: review.scripture },
        audit: { log: auditLog, actor, requestId: req.id },
      });
      const version = await publication.rollbackQuestionSet(setId, toVersion, actor.userId);
      res.json({ ok: true, version: setVersionHead(version) });
    }),
  );

  return router;
}
