import { Router } from 'express';
import type { Difficulty, PracticeTrackProgress } from '../../src/types/index';
import { isValidDifficulty } from '../../src/types/index';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  getQuestionCounts,
  getQuestionsByIds,
  getQuestionsMeta,
  pickQuestions,
} from '../services/questionService';

export const questionsRouter = Router();

function parseDifficulty(value: unknown): Difficulty | null {
  if (typeof value === 'string' && isValidDifficulty(value)) return value;
  return null;
}

function parseIds(value: unknown): string[] {
  if (typeof value !== 'string' || !value.trim()) return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

questionsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const difficulty = parseDifficulty(req.query.difficulty);
    if (!difficulty) {
      res.status(400).json({ error: 'invalid_difficulty' });
      return;
    }

    const themeId = typeof req.query.themeId === 'string' ? req.query.themeId : undefined;
    const themeIds = parseIds(req.query.themeIds);
    const topicNodeId =
      typeof req.query.topicNodeId === 'string' ? req.query.topicNodeId : undefined;
    const count = req.query.count != null ? Number(req.query.count) : undefined;
    const excludeIds = parseIds(
      typeof req.query.excludeIds === 'string' ? req.query.excludeIds : '',
    );
    const seed = typeof req.query.seed === 'string' ? req.query.seed : undefined;
    const stageIndex =
      req.query.stageIndex != null ? Number(req.query.stageIndex) : undefined;
    const nodeId = typeof req.query.nodeId === 'string' ? req.query.nodeId : undefined;

    let practiceTrack: PracticeTrackProgress | undefined;
    if (typeof req.query.practiceTrack === 'string') {
      try {
        practiceTrack = JSON.parse(req.query.practiceTrack) as PracticeTrackProgress;
      } catch {
        practiceTrack = undefined;
      }
    }

    const questions = await pickQuestions({
      themeId,
      themeIds: themeIds.length ? themeIds : undefined,
      difficulty,
      topicNodeId: topicNodeId ?? nodeId,
      nodeId,
      count: Number.isFinite(count) ? count : undefined,
      excludeIds: excludeIds.length ? excludeIds : undefined,
      seed,
      stageIndex: Number.isFinite(stageIndex) ? stageIndex : undefined,
      practiceTrack,
    });

    res.json({ questions });
  }),
);

questionsRouter.get(
  '/by-ids',
  asyncHandler(async (req, res) => {
    const ids = parseIds(typeof req.query.ids === 'string' ? req.query.ids : '');
    if (!ids.length) {
      res.status(400).json({ error: 'ids_required' });
      return;
    }
    const questions = await getQuestionsByIds(ids);
    res.json({ questions });
  }),
);

questionsRouter.get(
  '/counts',
  asyncHandler(async (req, res) => {
    const themeId = typeof req.query.themeId === 'string' ? req.query.themeId : undefined;
    const themeIds = parseIds(
      typeof req.query.themeIds === 'string' ? req.query.themeIds : '',
    );
    const topicNodeId =
      typeof req.query.topicNodeId === 'string' ? req.query.topicNodeId : undefined;

    const counts = await getQuestionCounts({
      themeId,
      themeIds: themeIds.length ? themeIds : undefined,
      topicNodeId,
    });
    res.json({ counts });
  }),
);

questionsRouter.get(
  '/meta',
  asyncHandler(async (_req, res) => {
    const themes = await getQuestionsMeta();
    res.json({ themes });
  }),
);
