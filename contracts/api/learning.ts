import { z } from 'zod';
import {
  contentStatusSchema,
  difficultySchema,
  lessonSessionStatusSchema,
  practiceSessionModeSchema,
  practiceSessionStatusSchema,
} from '../enums/index';
import { entityId, idempotencyKey, isoTimestamp, nonNegativeInt } from '../schemas/primitives';
import { masteryState } from '../schemas/snapshots';
import { scriptureReference } from '../schemas/content';

/**
 * `/api/v1/learning/*` — Learning domain read + session APIs (Phase 3 WS2,
 * spec §9, §11, §12). Session lifecycles reuse `@contracts` primitives
 * (`idempotencyKey`, `entityId`) the same way `progressionContract` does;
 * practice-session answer scoring feeds the *same* mastery/achievement
 * authority as `progressionContract.answerRequest`, it does not fork one.
 */

// --- Plan / module / lesson reads (§11) --------------------------------------

export const planSummary = z.object({
  id: entityId,
  themeId: entityId,
  title: z.string().min(1),
  description: z.string().nullable(),
  status: contentStatusSchema,
  position: z.number().int().min(0),
});
export type PlanSummary = z.infer<typeof planSummary>;

export const moduleSummary = z.object({
  id: entityId,
  planId: entityId,
  parentModuleId: entityId.nullable(),
  title: z.string().min(1),
  description: z.string().nullable(),
  status: contentStatusSchema,
  position: z.number().int().min(0),
});
export type ModuleSummary = z.infer<typeof moduleSummary>;

export const objectiveSummary = z.object({
  id: entityId,
  planId: entityId,
  title: z.string().min(1),
  description: z.string().nullable(),
  topicPath: z.string().nullable(),
  status: contentStatusSchema,
  position: z.number().int().min(0),
});
export type ObjectiveSummary = z.infer<typeof objectiveSummary>;

export const lessonSummary = z.object({
  id: entityId,
  planId: entityId,
  moduleId: entityId,
  objectiveId: entityId,
  title: z.string().min(1),
  description: z.string().nullable(),
  status: contentStatusSchema,
  position: z.number().int().min(0),
});
export type LessonSummary = z.infer<typeof lessonSummary>;

/**
 * `blockType` is intentionally `z.string()`, not the closed
 * `LESSON_BLOCK_TYPES` union — an unfamiliar future block type must still
 * parse so the client can fail safe on just that block (§11.3), not reject
 * the whole lesson.
 */
export const lessonBlock = z.object({
  id: entityId,
  position: z.number().int().min(0),
  blockType: z.string().min(1).max(64),
  schemaVersion: z.number().int().min(1),
  payload: z.record(z.string(), z.unknown()),
});
export type LessonBlock = z.infer<typeof lessonBlock>;

export const lessonDetail = lessonSummary.extend({
  blocks: z.array(lessonBlock),
});
export type LessonDetail = z.infer<typeof lessonDetail>;

export const planDetail = planSummary.extend({
  modules: z.array(moduleSummary),
});
export type PlanDetail = z.infer<typeof planDetail>;

export const moduleDetail = moduleSummary.extend({
  lessons: z.array(lessonSummary),
});
export type ModuleDetail = z.infer<typeof moduleDetail>;

// --- Today (§9) ---------------------------------------------------------------

export const lessonResumeCard = z.object({
  sessionId: entityId,
  lesson: lessonSummary,
  checkpointBlockId: entityId.nullable(),
  startedAt: isoTimestamp,
  lastActivityAt: isoTimestamp,
});
export type LessonResumeCard = z.infer<typeof lessonResumeCard>;

export const reviewCard = z.object({
  objectiveId: entityId,
  lessonId: entityId,
  title: z.string().min(1),
  dueAt: isoTimestamp,
  /** Plain-language reason, not a numeric confidence score (§12.5 "no fake scientific precision"). */
  reason: z.enum(['missed_recently', 'spaced_interval']),
});
export type ReviewCard = z.infer<typeof reviewCard>;

export const dailyGoalView = z.object({
  target: z.number().int().min(1),
  completed: nonNegativeInt,
  unit: z.literal('lesson'),
});
export type DailyGoalView = z.infer<typeof dailyGoalView>;

export const streakView = z.object({
  days: z.number().int().min(0),
  lastActiveAt: isoTimestamp.nullable(),
});
export type StreakView = z.infer<typeof streakView>;

export const publishedVerseCard = z.object({
  reference: z.string().min(1),
  text: z.string().min(1),
  translation: z.string().min(1),
});
export type PublishedVerseCard = z.infer<typeof publishedVerseCard>;

export const progressionSummary = z.object({
  kind: z.enum(['lesson', 'practice']),
  title: z.string().min(1),
  occurredAt: isoTimestamp,
});
export type ProgressionSummary = z.infer<typeof progressionSummary>;

/** `GET /api/v1/learning/today` response (§9.1). `optionalChallenge` is typed, never populated in WS2 — no data source is specified anywhere in the spec. */
export const todayView = z.object({
  date: z.string(),
  timezone: z.string(),
  activeLesson: lessonResumeCard.optional(),
  dueReview: reviewCard.optional(),
  dailyGoal: dailyGoalView,
  optionalChallenge: z.undefined().optional(),
  streak: streakView,
  verseOfDay: publishedVerseCard.optional(),
  recentOutcome: progressionSummary.optional(),
  generatedAt: isoTimestamp,
});
export type TodayView = z.infer<typeof todayView>;

// --- Lesson sessions (§11.4) ---------------------------------------------------

export const lessonSessionView = z.object({
  id: entityId,
  lessonId: entityId,
  status: lessonSessionStatusSchema,
  contentRevision: z.string(),
  checkpointBlockId: entityId.nullable(),
  startedAt: isoTimestamp,
  lastActivityAt: isoTimestamp,
  completedAt: isoTimestamp.nullable(),
});
export type LessonSessionView = z.infer<typeof lessonSessionView>;

/** `POST /api/v1/learning/lessons/:lessonId/sessions` */
export const lessonSessionStartRequest = z.object({ idempotencyKey }).strict();
export type LessonSessionStartRequest = z.infer<typeof lessonSessionStartRequest>;
export const lessonSessionStartResponse = z.object({ session: lessonSessionView, lesson: lessonDetail });
export type LessonSessionStartResponse = z.infer<typeof lessonSessionStartResponse>;

/** `POST /api/v1/learning/lesson-sessions/:id/progress` */
export const lessonSessionProgressRequest = z
  .object({ checkpointBlockId: entityId, idempotencyKey })
  .strict();
export type LessonSessionProgressRequest = z.infer<typeof lessonSessionProgressRequest>;
export const lessonSessionProgressResponse = z.object({ session: lessonSessionView });
export type LessonSessionProgressResponse = z.infer<typeof lessonSessionProgressResponse>;

/** `POST /api/v1/learning/lesson-sessions/:id/complete` */
export const lessonSessionCompleteRequest = z.object({ idempotencyKey }).strict();
export type LessonSessionCompleteRequest = z.infer<typeof lessonSessionCompleteRequest>;
export const lessonSessionCompleteResponse = z.object({ session: lessonSessionView });
export type LessonSessionCompleteResponse = z.infer<typeof lessonSessionCompleteResponse>;

// --- Practice / review sessions (§12) ------------------------------------------

/** Presentation-safe question — no `correctIndex`, no explanation (§12.1 "no answer key for future questions"). */
export const practiceQuestionView = z.object({
  questionId: entityId,
  revisionId: entityId,
  text: z.string().min(1),
  options: z.array(z.string()).min(2),
});
export type PracticeQuestionView = z.infer<typeof practiceQuestionView>;

export const practiceSessionView = z.object({
  id: entityId,
  mode: practiceSessionModeSchema,
  objectiveId: entityId,
  status: practiceSessionStatusSchema,
  currentIndex: nonNegativeInt,
  questionCount: z.number().int().min(1),
  expiresAt: isoTimestamp,
});
export type PracticeSessionView = z.infer<typeof practiceSessionView>;

/** `POST /api/v1/learning/practice-sessions` */
export const practiceSessionCreateRequest = z
  .object({
    objectiveId: entityId,
    mode: practiceSessionModeSchema,
    difficulty: difficultySchema.optional(),
    questionCount: z.number().int().min(1).max(50).default(10),
    idempotencyKey,
  })
  .strict();
export type PracticeSessionCreateRequest = z.infer<typeof practiceSessionCreateRequest>;
export const practiceSessionCreateResponse = z.object({
  session: practiceSessionView,
  currentQuestion: practiceQuestionView,
});
export type PracticeSessionCreateResponse = z.infer<typeof practiceSessionCreateResponse>;

/** `POST /api/v1/learning/practice-sessions/:id/answers` */
export const practiceSessionAnswerRequest = z
  .object({ chosenIndex: z.number().int().min(0).max(9), idempotencyKey })
  .strict();
export type PracticeSessionAnswerRequest = z.infer<typeof practiceSessionAnswerRequest>;
export const practiceSessionAnswerResponse = z.object({
  isCorrect: z.boolean(),
  correctIndex: z.number().int().min(0),
  explanationShort: z.string().nullable(),
  explanationDeep: z.string().nullable(),
  reference: z.string().nullable(),
  scriptureRefs: z.array(scriptureReference),
  session: practiceSessionView,
  nextQuestion: practiceQuestionView.optional(),
  mastery: masteryState,
  achievementsGranted: z.array(z.string().max(64)),
  eventId: entityId,
});
export type PracticeSessionAnswerResponse = z.infer<typeof practiceSessionAnswerResponse>;

// --- Review scheduler (§12.5) --------------------------------------------------

/** `GET /api/v1/learning/review/due` */
export const reviewDueResponse = z.object({
  dueCount: nonNegativeInt,
  items: z.array(reviewCard),
});
export type ReviewDueResponse = z.infer<typeof reviewDueResponse>;
