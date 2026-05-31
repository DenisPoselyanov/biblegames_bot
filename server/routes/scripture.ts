import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  assertTranslation,
  getDailyScripture,
  getScripturePassage,
  getScriptureTranslations,
} from '../scriptureService';

export const scriptureRouter = Router();

scriptureRouter.get(
  '/translations',
  asyncHandler(async (_req, res) => {
    res.json({ translations: getScriptureTranslations() });
  }),
);

scriptureRouter.get(
  '/daily',
  asyncHandler(async (req, res) => {
    const translation = assertTranslation(String(req.query.translation ?? ''));
    const daily = await getDailyScripture(translation);
    res.json(daily);
  }),
);

scriptureRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const ref = String(req.query.ref ?? '').trim();
    if (!ref) {
      res.status(400).json({ error: 'missing_ref' });
      return;
    }
    const translation = assertTranslation(String(req.query.translation ?? ''));
    const passage = await getScripturePassage(ref, translation);
    res.json(passage);
  }),
);
