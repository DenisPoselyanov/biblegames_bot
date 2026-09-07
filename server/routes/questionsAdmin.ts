import { Router, type Request } from 'express';
import type { Question } from '../../src/types/index';
import type { ServerConfig } from '../config/env';
import { asyncHandler } from '../middleware/asyncHandler';
import { AppError, ForbiddenError } from '../lib/errors';
import { buildAuditRecord, type AuditLog } from '../audit';
import { deleteQuestionPermanently, updateQuestionPermanently } from '../questionAdmin';

function isAdminEnabled(): boolean {
  if (process.env.QUESTION_ADMIN_ENABLED === 'false') return false;
  if (process.env.NODE_ENV === 'production' && process.env.QUESTION_ADMIN_ENABLED !== 'true') {
    return false;
  }
  return true;
}

function sanitizeQuestionPatch(body: unknown): Partial<Question> {
  if (!body || typeof body !== 'object') return {};
  const src = body as Partial<Question>;
  const patch: Partial<Question> = {};

  if (typeof src.text === 'string' && src.text.trim()) patch.text = src.text.trim();
  if (Array.isArray(src.options) && src.options.length === 4) {
    patch.options = src.options.map((opt) => String(opt).trim());
  }
  if (typeof src.correctIndex === 'number') patch.correctIndex = src.correctIndex;
  if (typeof src.reference === 'string') patch.reference = src.reference.trim() || undefined;
  if (typeof src.explanationShort === 'string') {
    patch.explanationShort = src.explanationShort.trim() || undefined;
  }
  if (typeof src.difficulty === 'string') patch.difficulty = src.difficulty;
  if (typeof src.themeId === 'string') patch.themeId = src.themeId;

  return patch;
}

export interface QuestionsAdminRouterDeps {
  auditLog: AuditLog;
  config: ServerConfig;
}

/**
 * Admin question mutation router (Phase 1 §6.3).
 *
 * Authentication + `questions:admin` permission are enforced by the caller
 * (see server/app.ts) before this router runs. This router adds:
 * - a `QUESTION_ADMIN_ENABLED` defense-in-depth gate;
 * - a production guard against direct JSON file writes;
 * - an audit record for every mutation, success or handled failure.
 */
export function createQuestionsAdminRouter({ auditLog, config }: QuestionsAdminRouterDeps): Router {
  const router = Router();

  router.use((req, res, next) => {
    if (!isAdminEnabled()) {
      res.status(403).json({ error: 'question_admin_disabled' });
      return;
    }
    if (config.isProduction && !config.questionAdminFsWrites) {
      // Phase 1 §6.3 / ADR-004: no direct production content writes until the
      // Phase 4 Content Studio lifecycle exists. Opt in with QUESTION_ADMIN_FS_WRITES=true.
      next(
        new ForbiddenError(
          'question_admin_fs_write_disabled',
          'Direct question edits are disabled in production',
        ),
      );
      return;
    }
    next();
  });

  const actor = (req: Request) => ({
    userId: req.auth?.userId ?? null,
    authSource: req.auth?.authSource ?? null,
  });

  /** Map the domain layer's bare errors onto the stable HTTP envelope (§12). */
  const asHttpError = (err: unknown): unknown => {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'question_not_found') return new AppError('question_not_found', 'No such question', 404);
    return err;
  };

  router.put(
    '/:questionId',
    asyncHandler(async (req, res) => {
      const patch = sanitizeQuestionPatch(req.body);
      if (Object.keys(patch).length === 0) {
        res.status(400).json({ error: 'empty_patch' });
        return;
      }
      try {
        const updated = updateQuestionPermanently(req.params.questionId, patch);
        await auditLog.append(
          buildAuditRecord({
            actor: actor(req),
            action: 'question.update',
            target: req.params.questionId,
            result: 'ok',
            requestId: req.id,
            metadata: { fields: Object.keys(patch) },
          }),
        );
        res.json({ ok: true, question: updated });
      } catch (err) {
        await auditLog.append(
          buildAuditRecord({
            actor: actor(req),
            action: 'question.update',
            target: req.params.questionId,
            result: 'error',
            requestId: req.id,
            metadata: { fields: Object.keys(patch), error: (err as Error).message },
          }),
        );
        throw asHttpError(err);
      }
    }),
  );

  router.delete(
    '/:questionId',
    asyncHandler(async (req, res) => {
      try {
        const result = deleteQuestionPermanently(req.params.questionId);
        await auditLog.append(
          buildAuditRecord({
            actor: actor(req),
            action: 'question.delete',
            target: req.params.questionId,
            result: 'ok',
            requestId: req.id,
            metadata: { source: result.source },
          }),
        );
        res.json({ ok: true, ...result });
      } catch (err) {
        await auditLog.append(
          buildAuditRecord({
            actor: actor(req),
            action: 'question.delete',
            target: req.params.questionId,
            result: 'error',
            requestId: req.id,
            metadata: { error: (err as Error).message },
          }),
        );
        throw asHttpError(err);
      }
    }),
  );

  return router;
}
