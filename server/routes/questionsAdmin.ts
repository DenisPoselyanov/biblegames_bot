import { Router } from 'express';
import type { Question } from '../../src/types/index';
import { asyncHandler } from '../middleware/asyncHandler';
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

export const questionsAdminRouter = Router();

questionsAdminRouter.use((req, res, next) => {
  if (!isAdminEnabled()) {
    res.status(403).json({ error: 'question_admin_disabled' });
    return;
  }
  next();
});

questionsAdminRouter.put(
  '/:questionId',
  asyncHandler(async (req, res) => {
    const patch = sanitizeQuestionPatch(req.body);
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: 'empty_patch' });
      return;
    }
    const updated = updateQuestionPermanently(req.params.questionId, patch);
    res.json({ ok: true, question: updated });
  }),
);

questionsAdminRouter.delete(
  '/:questionId',
  asyncHandler(async (req, res) => {
    const result = deleteQuestionPermanently(req.params.questionId);
    res.json({ ok: true, ...result });
  }),
);
