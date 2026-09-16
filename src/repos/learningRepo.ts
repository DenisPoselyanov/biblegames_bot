/**
 * Client for `/api/v1/learning/*` (Phase 3 WS6), built on the typed API client
 * (`src/lib/apiClient`) — same shape as `src/repos/progressionRepo.ts`. Every
 * method throws `LearningError` on a non-2xx response; get-by-id reads resolve
 * `null` on a 404 instead (§11.1/§11.2 "no content" is a normal, renderable
 * state, not an exceptional one).
 */

import type { ZodType } from 'zod';
import { learningContract } from '@contracts';
import type {
  LearningSearchResponse,
  LessonDetail,
  LessonSessionCompleteResponse,
  LessonSessionProgressResponse,
  LessonSessionStartResponse,
  ModuleDetail,
  PlanDetail,
  PlanSummary,
  PracticeSessionAnswerResponse,
  PracticeSessionCreateResponse,
  ReviewDueResponse,
  TodayView,
} from '../../contracts/api/learning';
import type { Difficulty, PracticeSessionMode, Testament } from '../../contracts/index';
import { ApiError, apiRequest, type ApiRequestOptions } from '../lib/apiClient';

/** A failed learning command/read. Carries the server's §7.5 envelope fields. */
export class LearningError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;
  readonly requestId?: string;
  constructor(source: ApiError) {
    super(source.message);
    this.name = 'LearningError';
    this.code = source.code;
    this.status = source.status;
    this.retryable = source.retryable;
    this.requestId = source.requestId;
  }
}

async function call<T>(path: string, opts?: ApiRequestOptions<T>): Promise<T> {
  try {
    return await apiRequest<T>(path, opts);
  } catch (err) {
    if (err instanceof ApiError) throw new LearningError(err);
    throw err; // network / abort errors propagate untouched
  }
}

function post<T>(path: string, body: unknown, idempotencyKey: string, schema: ZodType<T>): Promise<T> {
  return call<T>(path, { method: 'POST', body, idempotencyKey, schema, onInvalidResponse: 'warn' });
}

function query(params: Record<string, string | number | undefined>): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) usp.set(key, String(value));
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : '';
}

export const learningRepo = {
  getToday(): Promise<TodayView> {
    return call<TodayView>('/learning/today', {
      schema: learningContract.todayView as unknown as ZodType<TodayView>,
      onInvalidResponse: 'warn',
    });
  },

  listPlans(testament?: Testament): Promise<PlanSummary[]> {
    return call<{ plans: PlanSummary[] }>(`/learning/plans${query({ testament })}`).then((r) => r.plans);
  },

  getPlan(planId: string): Promise<PlanDetail | null> {
    return call<PlanDetail | null>(`/learning/plans/${encodeURIComponent(planId)}`, { nullStatuses: [404] });
  },

  getModule(moduleId: string): Promise<ModuleDetail | null> {
    return call<ModuleDetail | null>(`/learning/modules/${encodeURIComponent(moduleId)}`, { nullStatuses: [404] });
  },

  getLesson(lessonId: string): Promise<LessonDetail | null> {
    return call<LessonDetail | null>(`/learning/lessons/${encodeURIComponent(lessonId)}`, { nullStatuses: [404] });
  },

  search(q: string, opts?: { testament?: Testament; limit?: number }): Promise<LearningSearchResponse> {
    return call<LearningSearchResponse>(
      `/learning/search${query({ q, testament: opts?.testament, limit: opts?.limit })}`,
      {
        schema: learningContract.learningSearchResponse as unknown as ZodType<LearningSearchResponse>,
        onInvalidResponse: 'warn',
      },
    );
  },

  startLessonSession(lessonId: string, idempotencyKey: string): Promise<LessonSessionStartResponse> {
    return post(
      `/learning/lessons/${encodeURIComponent(lessonId)}/sessions`,
      { idempotencyKey },
      idempotencyKey,
      learningContract.lessonSessionStartResponse as unknown as ZodType<LessonSessionStartResponse>,
    );
  },

  progressLessonSession(
    sessionId: string,
    checkpointBlockId: string,
    idempotencyKey: string,
  ): Promise<LessonSessionProgressResponse> {
    return post(
      `/learning/lesson-sessions/${encodeURIComponent(sessionId)}/progress`,
      { checkpointBlockId, idempotencyKey },
      idempotencyKey,
      learningContract.lessonSessionProgressResponse as unknown as ZodType<LessonSessionProgressResponse>,
    );
  },

  completeLessonSession(sessionId: string, idempotencyKey: string): Promise<LessonSessionCompleteResponse> {
    return post(
      `/learning/lesson-sessions/${encodeURIComponent(sessionId)}/complete`,
      { idempotencyKey },
      idempotencyKey,
      learningContract.lessonSessionCompleteResponse as unknown as ZodType<LessonSessionCompleteResponse>,
    );
  },

  getReviewDue(): Promise<ReviewDueResponse> {
    return call<ReviewDueResponse>('/learning/review/due', {
      schema: learningContract.reviewDueResponse as unknown as ZodType<ReviewDueResponse>,
      onInvalidResponse: 'warn',
    });
  },

  createPracticeSession(
    input: { objectiveId: string; mode: PracticeSessionMode; difficulty?: Difficulty; questionCount?: number },
    idempotencyKey: string,
  ): Promise<PracticeSessionCreateResponse> {
    return post(
      '/learning/practice-sessions',
      { ...input, idempotencyKey },
      idempotencyKey,
      learningContract.practiceSessionCreateResponse as unknown as ZodType<PracticeSessionCreateResponse>,
    );
  },

  answerPracticeSession(
    sessionId: string,
    chosenIndex: number,
    idempotencyKey: string,
  ): Promise<PracticeSessionAnswerResponse> {
    return post(
      `/learning/practice-sessions/${encodeURIComponent(sessionId)}/answers`,
      { chosenIndex, idempotencyKey },
      idempotencyKey,
      learningContract.practiceSessionAnswerResponse as unknown as ZodType<PracticeSessionAnswerResponse>,
    );
  },
};
