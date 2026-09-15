/**
 * Learning domain service (Phase 3 WS2, spec §9, §11, §12).
 *
 * Plain functions over injected deps — same convention as
 * `server/services/progressionService.ts` (methods take `userId` directly, not
 * a full `ServiceContext`; `ServiceContext` is still an opaque, optional slot
 * per `server/domains/shared/context.ts`, not yet the calling convention every
 * service uses).
 *
 * Practice-session answers reuse the *same* mastery/achievement authority as
 * `POST /api/v1/progression/answers` (`progressionService.applyAnswer` /
 * `applyAnswerBlob`) — this service only adds server-computed correctness
 * (§12.1 "no answer key for future questions") on top, it does not fork a
 * parallel reward path.
 */
import { createHash, randomUUID } from 'node:crypto';
import type {
  DailyGoalView,
  LearningSearchResponse,
  LessonDetail,
  LessonResumeCard,
  LessonSessionCompleteResponse,
  LessonSessionProgressResponse,
  LessonSessionStartResponse,
  LessonSessionView,
  LessonSummary,
  ModuleDetail,
  ModuleSummary,
  PlanDetail,
  PlanSummary,
  PracticeSessionAnswerResponse,
  PracticeSessionCreateResponse,
  PracticeSessionView,
  ReviewCard,
  ReviewDueResponse,
  TodayView,
} from '../../contracts/api/learning';
import type { ContentStatus, Difficulty, PracticeSessionMode, Testament } from '../../contracts/index';
import type { MasteryState } from '../../src/types/index';
import type { LearningRepositories } from '../domains/learning/repository';
import type {
  LearningModuleRecord,
  LearningObjectiveRecord,
  LearningPlanRecord,
  LessonBlockRecord,
  LessonRecord,
  LessonSessionRecord,
  PracticeSessionRecord,
} from '../domains/learning/types';
import { computeReviewDue } from '../domains/learning/reviewScheduler';
import type { ContentRepositories } from '../domains/content/repository';
import type { QuestionRevisionRecord } from '../domains/content/types';
import type { ServerStore } from '../db/store';
import type { WalletLedger } from '../wallet';
import { readProfile, type PreferencesCutover, type ProgressionCutover } from './profileService';
import type { ProgressionService } from './progressionService';
import { applyAnswerBlob } from '../progression/applyAnswerBlob';
import { getDailyScripture } from '../scriptureService';
import { AppError } from '../lib/errors';

const PUBLISHED: ContentStatus = 'published';
const DAILY_LESSON_GOAL = 1;
const PRACTICE_SESSION_TTL_MS = 30 * 60 * 1000;
const DEFAULT_ERROR_TAG = 'knowledge-gap';

export interface LearningServiceDeps {
  learningRepos: LearningRepositories;
  contentRepositories?: ContentRepositories;
  dbStore: ServerStore;
  walletLedger: WalletLedger;
  preferences?: PreferencesCutover;
  progression?: ProgressionCutover;
  progressionService?: ProgressionService;
  now?: () => Date;
}

export interface LearningService {
  getToday(userId: string): Promise<TodayView>;
  /** `testament` narrows the published list (§10.3) — omit for the unfiltered browse list. */
  listPlans(testament?: Testament): Promise<PlanSummary[]>;
  getPlan(planId: string): Promise<PlanDetail | null>;
  getModule(moduleId: string): Promise<ModuleDetail | null>;
  getLesson(lessonId: string): Promise<LessonDetail | null>;
  getReviewDue(userId: string, limit?: number): Promise<ReviewDueResponse>;
  startLessonSession(userId: string, lessonId: string): Promise<LessonSessionStartResponse>;
  progressLessonSession(
    userId: string,
    sessionId: string,
    checkpointBlockId: string,
  ): Promise<LessonSessionProgressResponse>;
  completeLessonSession(userId: string, sessionId: string): Promise<LessonSessionCompleteResponse>;
  createPracticeSession(
    userId: string,
    input: { objectiveId: string; mode: PracticeSessionMode; difficulty?: Difficulty; questionCount: number },
  ): Promise<PracticeSessionCreateResponse>;
  answerPracticeSession(
    userId: string,
    sessionId: string,
    input: { chosenIndex: number; idempotencyKey: string },
  ): Promise<PracticeSessionAnswerResponse>;
  /** Bounded text search over published plans/objectives (§10.2/§10.3). */
  search(input: { q: string; testament?: Testament; limit: number }): Promise<LearningSearchResponse>;
}

function eventId(userId: string, sourceId: string): string {
  return createHash('sha256').update(`${userId}\0${sourceId}`).digest('hex').slice(0, 32);
}

function toPlanSummary(r: LearningPlanRecord): PlanSummary {
  return {
    id: r.id,
    themeId: r.themeId,
    title: r.title,
    description: r.description,
    status: r.status,
    position: r.position,
    testament: r.testament,
  };
}

function toModuleSummary(r: LearningModuleRecord): ModuleSummary {
  return {
    id: r.id,
    planId: r.planId,
    parentModuleId: r.parentModuleId,
    title: r.title,
    description: r.description,
    status: r.status,
    position: r.position,
  };
}

function toLessonSummary(r: LessonRecord): LessonSummary {
  return {
    id: r.id,
    planId: r.planId,
    moduleId: r.moduleId,
    objectiveId: r.objectiveId,
    title: r.title,
    description: r.description,
    status: r.status,
    position: r.position,
  };
}

function toLessonDetail(lesson: LessonRecord, blocks: LessonBlockRecord[]): LessonDetail {
  return {
    ...toLessonSummary(lesson),
    blocks: blocks
      .filter((b) => b.status === PUBLISHED)
      .map((b) => ({
        id: b.id,
        position: b.position,
        blockType: b.blockType,
        schemaVersion: b.schemaVersion,
        payload: b.payload,
      })),
  };
}

function toLessonSessionView(s: LessonSessionRecord): LessonSessionView {
  return {
    id: s.id,
    lessonId: s.lessonId,
    status: s.status,
    contentRevision: s.contentRevision,
    checkpointBlockId: s.checkpointBlockId,
    startedAt: s.startedAt,
    lastActivityAt: s.lastActivityAt,
    completedAt: s.completedAt,
  };
}

function toPracticeSessionView(s: PracticeSessionRecord): PracticeSessionView {
  return {
    id: s.id,
    mode: s.mode,
    objectiveId: s.objectiveId,
    status: s.status,
    currentIndex: s.currentIndex,
    questionCount: s.questionRevisionIds.length,
    expiresAt: s.expiresAt,
  };
}

function toReviewCard(objectiveId: string, lesson: LessonRecord, dueAt: string, reason: ReviewCard['reason']): ReviewCard {
  return { objectiveId, lessonId: lesson.id, title: lesson.title, dueAt, reason };
}

function toSearchPlanResult(r: LearningPlanRecord): LearningSearchResponse['items'][number] {
  return { kind: 'plan', id: r.id, title: r.title, description: r.description, testament: r.testament };
}

function toSearchObjectiveResult(r: LearningObjectiveRecord): LearningSearchResponse['items'][number] {
  return {
    kind: 'objective',
    id: r.id,
    planId: r.planId,
    title: r.title,
    description: r.description,
    topicPath: r.topicPath,
    testament: r.testament,
  };
}

/** Fisher-Yates — freshness matters here, not reproducibility (unlike the seeded quiz picker). */
function shuffled<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function createLearningService(deps: LearningServiceDeps): LearningService {
  const { learningRepos, contentRepositories, dbStore, walletLedger, preferences, progression, progressionService } = deps;
  const now = deps.now ?? (() => new Date());

  function requireContentRepositories(): ContentRepositories {
    if (!contentRepositories) {
      throw new AppError('content_unavailable', 'Content repository not wired', 503);
    }
    return contentRepositories;
  }

  async function readMastery(userId: string): Promise<{ mastery: Record<string, MasteryState>; translation: string; streakDays: number; lastActiveAt: string | null }> {
    const profile = await readProfile(dbStore, userId, walletLedger, preferences, progression);
    const mastery =
      profile.studyMastery && typeof profile.studyMastery === 'object'
        ? (profile.studyMastery as Record<string, MasteryState>)
        : {};
    return {
      mastery,
      translation: typeof profile.bibleTranslation === 'string' ? profile.bibleTranslation : 'UTT',
      streakDays: typeof profile.streakDays === 'number' ? profile.streakDays : 0,
      lastActiveAt: typeof profile.lastActiveAt === 'string' ? profile.lastActiveAt : null,
    };
  }

  async function reviewDueCards(userId: string, limit: number): Promise<{ dueCount: number; items: ReviewCard[] }> {
    const { mastery } = await readMastery(userId);
    const entries = computeReviewDue(mastery, now());
    const items: ReviewCard[] = [];
    for (const entry of entries) {
      if (items.length >= limit) break;
      const lesson = await learningRepos.lessons.getByObjectiveId(entry.objectiveId);
      if (!lesson || lesson.status !== PUBLISHED) continue;
      items.push(toReviewCard(entry.objectiveId, lesson, entry.dueAt, entry.reason));
    }
    return { dueCount: entries.length, items };
  }

  return {
    async getToday(userId) {
      const nowDate = now();
      const [{ mastery, translation, streakDays, lastActiveAt }, activeSession, mostRecentCompleted] =
        await Promise.all([
          readMastery(userId),
          learningRepos.lessonSessions.getMostRecentActive(userId),
          learningRepos.lessonSessions.getMostRecentCompleted(userId),
        ]);

      let activeLesson: LessonResumeCard | undefined;
      if (activeSession) {
        const lesson = await learningRepos.lessons.getById(activeSession.lessonId);
        if (lesson) {
          activeLesson = {
            sessionId: activeSession.id,
            lesson: toLessonSummary(lesson),
            checkpointBlockId: activeSession.checkpointBlockId,
            startedAt: activeSession.startedAt,
            lastActivityAt: activeSession.lastActivityAt,
          };
        }
      }

      const dueEntries = computeReviewDue(mastery, nowDate);
      let dueReview: ReviewCard | undefined;
      for (const entry of dueEntries) {
        const lesson = await learningRepos.lessons.getByObjectiveId(entry.objectiveId);
        if (lesson && lesson.status === PUBLISHED) {
          dueReview = toReviewCard(entry.objectiveId, lesson, entry.dueAt, entry.reason);
          break;
        }
      }

      const todayStart = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate()));
      const completedToday = await learningRepos.lessonSessions.countCompletedSince(userId, todayStart.toISOString());
      const dailyGoal: DailyGoalView = { target: DAILY_LESSON_GOAL, completed: completedToday, unit: 'lesson' };

      let recentOutcome: TodayView['recentOutcome'];
      if (mostRecentCompleted) {
        const lesson = await learningRepos.lessons.getById(mostRecentCompleted.lessonId);
        if (lesson) {
          recentOutcome = { kind: 'lesson', title: lesson.title, occurredAt: mostRecentCompleted.completedAt ?? mostRecentCompleted.lastActivityAt };
        }
      }

      const daily = await getDailyScripture(translation);

      return {
        date: nowDate.toISOString().slice(0, 10),
        // No per-user timezone is stored anywhere yet (checked identity/preferences) — UTC until one is.
        timezone: 'UTC',
        activeLesson,
        dueReview,
        dailyGoal,
        streak: { days: streakDays, lastActiveAt },
        verseOfDay: { reference: daily.reference, text: daily.text, translation: daily.translation },
        recentOutcome,
        generatedAt: nowDate.toISOString(),
      };
    },

    async listPlans(testament) {
      const plans = await learningRepos.plans.listAll();
      return plans
        .filter((p) => p.status === PUBLISHED && (!testament || p.testament === testament))
        .map(toPlanSummary);
    },

    async getPlan(planId) {
      const plan = await learningRepos.plans.getById(planId);
      if (!plan || plan.status !== PUBLISHED) return null;
      const modules = await learningRepos.modules.listByPlan(planId);
      return { ...toPlanSummary(plan), modules: modules.filter((m) => m.status === PUBLISHED).map(toModuleSummary) };
    },

    async getModule(moduleId) {
      const module_ = await learningRepos.modules.getById(moduleId);
      if (!module_ || module_.status !== PUBLISHED) return null;
      const lessons = await learningRepos.lessons.listByModule(moduleId);
      return { ...toModuleSummary(module_), lessons: lessons.filter((l) => l.status === PUBLISHED).map(toLessonSummary) };
    },

    async getLesson(lessonId) {
      const lesson = await learningRepos.lessons.getById(lessonId);
      if (!lesson || lesson.status !== PUBLISHED) return null;
      const blocks = await learningRepos.blocks.listByLesson(lessonId);
      return toLessonDetail(lesson, blocks);
    },

    async getReviewDue(userId, limit = 10) {
      return reviewDueCards(userId, limit);
    },

    async startLessonSession(userId, lessonId) {
      const lesson = await learningRepos.lessons.getById(lessonId);
      if (!lesson || lesson.status !== PUBLISHED) {
        throw new AppError('lesson_not_found', 'Lesson not found', 404);
      }

      const existing = await learningRepos.lessonSessions.getActiveForUser(userId, lessonId);
      const session =
        existing ??
        (await learningRepos.lessonSessions.start({
          id: randomUUID(),
          userId,
          lessonId,
          planId: lesson.planId,
          moduleId: lesson.moduleId,
          contentRevision: lesson.updatedAt,
        }));

      const blocks = await learningRepos.blocks.listByLesson(lessonId);
      return { session: toLessonSessionView(session), lesson: toLessonDetail(lesson, blocks) };
    },

    async progressLessonSession(userId, sessionId, checkpointBlockId) {
      const session = await learningRepos.lessonSessions.getById(sessionId);
      if (!session || session.userId !== userId) throw new AppError('session_not_found', 'Session not found', 404);
      if (session.status !== 'in_progress') {
        throw new AppError('session_not_active', 'Session is not in progress', 409);
      }
      const updated = await learningRepos.lessonSessions.updateCheckpoint(sessionId, checkpointBlockId);
      return { session: toLessonSessionView(updated) };
    },

    async completeLessonSession(userId, sessionId) {
      const session = await learningRepos.lessonSessions.getById(sessionId);
      if (!session || session.userId !== userId) throw new AppError('session_not_found', 'Session not found', 404);
      if (session.status !== 'in_progress') {
        throw new AppError('session_not_active', 'Session is not in progress', 409);
      }
      const completed = await learningRepos.lessonSessions.complete(sessionId);
      return { session: toLessonSessionView(completed) };
    },

    async createPracticeSession(userId, input) {
      const objective = await learningRepos.objectives.getById(input.objectiveId);
      if (!objective) throw new AppError('objective_not_found', 'Objective not found', 404);

      const revisions = await requireContentRepositories().revisions.listPublished({
        topicNodeId: input.objectiveId,
        difficulty: input.difficulty ?? null,
        limit: 200,
      });
      if (revisions.length === 0) {
        throw new AppError('no_questions_available', 'No published questions for this objective', 404);
      }
      const picked = shuffled(revisions).slice(0, input.questionCount);

      const expiresAt = new Date(now().getTime() + PRACTICE_SESSION_TTL_MS).toISOString();
      const session = await learningRepos.practiceSessions.create({
        id: randomUUID(),
        userId,
        mode: input.mode,
        objectiveId: input.objectiveId,
        questionRevisionIds: picked.map((r) => r.id),
        expiresAt,
      });

      return {
        session: toPracticeSessionView(session),
        currentQuestion: toPracticeQuestionView(picked[0]),
      };
    },

    async answerPracticeSession(userId, sessionId, input) {
      const session = await learningRepos.practiceSessions.getById(sessionId);
      if (!session || session.userId !== userId) throw new AppError('session_not_found', 'Session not found', 404);
      if (session.status !== 'active') throw new AppError('session_not_active', 'Session is not active', 409);
      if (new Date(session.expiresAt).getTime() < now().getTime()) {
        throw new AppError('session_expired', 'Session has expired', 410);
      }
      const revisionId = session.questionRevisionIds[session.currentIndex];
      if (!revisionId) throw new AppError('session_already_completed', 'Session already completed', 409);

      const revision = await requireContentRepositories().revisions.getById(revisionId);
      if (!revision) throw new AppError('question_not_found', 'Question revision not found', 404);

      const isCorrect = input.chosenIndex === revision.correctIndex;
      const answerOutcome = progressionService
        ? await progressionService.applyAnswer(userId, {
            questionId: revision.questionId,
            idempotencyKey: input.idempotencyKey,
            isCorrect,
            nodeId: session.objectiveId,
            subthemeId: session.objectiveId,
            errorTag: DEFAULT_ERROR_TAG,
          })
        : await applyAnswerBlob({
            dbStore,
            userId,
            body: {
              questionId: revision.questionId,
              idempotencyKey: input.idempotencyKey,
              isCorrect,
              nodeId: session.objectiveId,
              errorTag: DEFAULT_ERROR_TAG,
            },
          });

      const advanced = await learningRepos.practiceSessions.advance(sessionId);

      let nextQuestion: PracticeSessionAnswerResponse['nextQuestion'];
      if (advanced.status === 'active') {
        const nextRevisionId = advanced.questionRevisionIds[advanced.currentIndex];
        const nextRevision = nextRevisionId
          ? await requireContentRepositories().revisions.getById(nextRevisionId)
          : null;
        if (nextRevision) nextQuestion = toPracticeQuestionView(nextRevision);
      }

      return {
        isCorrect,
        correctIndex: revision.correctIndex,
        explanationShort: revision.explanationShort,
        explanationDeep: revision.explanationDeep,
        reference: revision.reference,
        scriptureRefs: revision.scriptureRefs,
        session: toPracticeSessionView(advanced),
        nextQuestion,
        mastery: answerOutcome.mastery,
        achievementsGranted: answerOutcome.achievementsGranted,
        eventId: eventId(userId, `learning.practice-answer:${sessionId}:${input.idempotencyKey}`),
      };
    },

    async search(input) {
      const query = { q: input.q, testament: input.testament ?? null, limit: input.limit };
      const [planRows, objectiveRows] = await Promise.all([
        learningRepos.plans.searchPublished(query),
        learningRepos.objectives.searchPublished(query),
      ]);
      const items = [...planRows.map(toSearchPlanResult), ...objectiveRows.map(toSearchObjectiveResult)].slice(
        0,
        input.limit,
      );
      return { items };
    },
  };
}

function toPracticeQuestionView(revision: QuestionRevisionRecord): {
  questionId: string;
  revisionId: string;
  text: string;
  options: string[];
} {
  return { questionId: revision.questionId, revisionId: revision.id, text: revision.text, options: revision.options };
}
