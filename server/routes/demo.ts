/**
 * Demo / in-memory endpoints (Phase 1 §10).
 *
 * These are unauthenticated fixtures with hardcoded data (`/leaderboard`,
 * `/dashboard`) or process-memory state (`/study/answer`, `/daily/complete`).
 * They are mounted by `createApp` only when `config.demoRoutesEnabled`, which is
 * structurally impossible under `NODE_ENV=production` (see `server/config/env.ts`)
 * — hardcoded players can never appear in a production ranking.
 */

import { Router } from 'express';

export function createDemoRouter(): Router {
  const router = Router();

  const studyAnswers: Array<Record<string, unknown>> = [];
  const dailyCompletions: Array<Record<string, unknown>> = [];

  router.get('/study/path', (_req, res) => {
    res.json({
      generatedAt: new Date().toISOString(),
      nodes: [
        { subthemeId: 'gospels-life', priority: 92, reason: 'weakness' },
        { subthemeId: 'sinai-law', priority: 74, reason: 'scheduled-review' },
        { subthemeId: 'bible-geography', priority: 68, reason: 'new' },
      ],
    });
  });

  router.post('/study/answer', (req, res) => {
    studyAnswers.push({ ...req.body, createdAt: new Date().toISOString() });
    res.json({ ok: true });
  });

  router.post('/daily/complete', (req, res) => {
    dailyCompletions.push({ ...req.body, createdAt: new Date().toISOString() });
    res.json({ ok: true });
  });

  router.get('/dashboard', (_req, res) => {
    res.json({
      streakDays: 0,
      todaysGoal: 'Пройти 2 рівні в Дослідженні',
      completedToday: dailyCompletions.length,
      answeredToday: studyAnswers.length,
    });
  });

  router.get('/leaderboard', (_req, res) => {
    res.json({
      items: [
        { userId: 'u1', displayName: 'Аполлос', points: 2420 },
        { userId: 'u2', displayName: 'Мойсей', points: 2180 },
        { userId: 'u3', displayName: 'Маріам', points: 1740 },
      ],
    });
  });

  return router;
}
