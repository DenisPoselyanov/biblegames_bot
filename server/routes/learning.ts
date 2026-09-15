/**
 * `/api/v1/learning/*` — Learning domain read + session APIs (Phase 3 WS2,
 * spec §9, §11, §12). Idempotency on every mutating endpoint reuses the same
 * `IdempotencyStore` `recall`/`remember` wrapper `server/routes/progression.ts`
 * uses — a retried request replays the stored outcome rather than re-running
 * the command (so a lesson session isn't double-started, a practice answer
 * isn't double-scored).
 */
import { Router, type Request } from 'express';
import { learningContract } from '../../contracts/index';
import type {
  LessonSessionCompleteRequest,
  LessonSessionProgressRequest,
  LessonSessionStartRequest,
  PracticeSessionAnswerRequest,
  PracticeSessionCreateRequest,
} from '../../contracts/api/learning';
import { asyncHandler } from '../middleware/asyncHandler';
import { validateBody } from '../middleware/validate';
import { AppError, UnauthorizedError } from '../lib/errors';
import { metrics } from '../lib/metrics';
import type { IdempotencyStore } from '../lib/idempotency';
import type { LearningService } from '../services/learningService';

export interface LearningRouterDeps {
  service: LearningService;
  idempotency: IdempotencyStore;
}

function principal(req: Request): { userId: string } {
  if (!req.auth) throw new UnauthorizedError('missing_credentials', 'Authentication required');
  return { userId: req.auth.userId };
}

export function createLearningRouter({ service, idempotency }: LearningRouterDeps): Router {
  const router = Router();

  async function withIdempotency<T>(
    scope: string,
    userId: string,
    idempotencyKey: string,
    run: () => Promise<T>,
  ): Promise<T> {
    const key = `learning.${scope}:${userId}:${idempotencyKey}`;
    const cached = await idempotency.recall(key);
    if (cached) {
      metrics.inc('idempotency_replay_total', { surface: 'learning' });
      return cached.result as T;
    }
    const result = await run();
    await idempotency.remember(key, result);
    return result;
  }

  router.get(
    '/today',
    asyncHandler(async (req, res) => {
      const { userId } = principal(req);
      res.json(await service.getToday(userId));
    }),
  );

  router.get(
    '/plans',
    asyncHandler(async (_req, res) => {
      res.json({ plans: await service.listPlans() });
    }),
  );

  router.get(
    '/plans/:id',
    asyncHandler(async (req, res) => {
      const plan = await service.getPlan(req.params.id);
      if (!plan) throw new AppError('plan_not_found', 'Plan not found', 404);
      res.json(plan);
    }),
  );

  router.get(
    '/modules/:id',
    asyncHandler(async (req, res) => {
      const module_ = await service.getModule(req.params.id);
      if (!module_) throw new AppError('module_not_found', 'Module not found', 404);
      res.json(module_);
    }),
  );

  router.get(
    '/lessons/:id',
    asyncHandler(async (req, res) => {
      const lesson = await service.getLesson(req.params.id);
      if (!lesson) throw new AppError('lesson_not_found', 'Lesson not found', 404);
      res.json(lesson);
    }),
  );

  router.get(
    '/review/due',
    asyncHandler(async (req, res) => {
      const { userId } = principal(req);
      res.json(await service.getReviewDue(userId));
    }),
  );

  router.post(
    '/lessons/:lessonId/sessions',
    validateBody(learningContract.lessonSessionStartRequest, 'invalid_lesson_session_start'),
    asyncHandler(async (req, res) => {
      const { userId } = principal(req);
      const { idempotencyKey } = req.body as LessonSessionStartRequest;
      const result = await withIdempotency('lessonSession.start', userId, idempotencyKey, () =>
        service.startLessonSession(userId, req.params.lessonId),
      );
      res.json(result);
    }),
  );

  router.post(
    '/lesson-sessions/:id/progress',
    validateBody(learningContract.lessonSessionProgressRequest, 'invalid_lesson_session_progress'),
    asyncHandler(async (req, res) => {
      const { userId } = principal(req);
      const { checkpointBlockId, idempotencyKey } = req.body as LessonSessionProgressRequest;
      const result = await withIdempotency('lessonSession.progress', userId, idempotencyKey, () =>
        service.progressLessonSession(userId, req.params.id, checkpointBlockId),
      );
      res.json(result);
    }),
  );

  router.post(
    '/lesson-sessions/:id/complete',
    validateBody(learningContract.lessonSessionCompleteRequest, 'invalid_lesson_session_complete'),
    asyncHandler(async (req, res) => {
      const { userId } = principal(req);
      const { idempotencyKey } = req.body as LessonSessionCompleteRequest;
      const result = await withIdempotency('lessonSession.complete', userId, idempotencyKey, () =>
        service.completeLessonSession(userId, req.params.id),
      );
      res.json(result);
    }),
  );

  router.post(
    '/practice-sessions',
    validateBody(learningContract.practiceSessionCreateRequest, 'invalid_practice_session_create'),
    asyncHandler(async (req, res) => {
      const { userId } = principal(req);
      const { objectiveId, mode, difficulty, questionCount, idempotencyKey } = req.body as PracticeSessionCreateRequest;
      const result = await withIdempotency('practiceSession.create', userId, idempotencyKey, () =>
        service.createPracticeSession(userId, { objectiveId, mode, difficulty, questionCount }),
      );
      res.json(result);
    }),
  );

  router.post(
    '/practice-sessions/:id/answers',
    validateBody(learningContract.practiceSessionAnswerRequest, 'invalid_practice_session_answer'),
    asyncHandler(async (req, res) => {
      const { userId } = principal(req);
      const { chosenIndex, idempotencyKey } = req.body as PracticeSessionAnswerRequest;
      const result = await withIdempotency('practiceSession.answer', userId, idempotencyKey, () =>
        service.answerPracticeSession(userId, req.params.id, { chosenIndex, idempotencyKey }),
      );
      res.json(result);
    }),
  );

  return router;
}
