/**
 * Learning domain repository contracts (Phase 3 WS1, ADR-017).
 *
 * Interfaces only — implementations live in `server/infrastructure/database/`
 * (SQL, production) and `./inMemoryRepository.ts` (dev/test parity peer). Both
 * pass `__tests__/repositoryContract.ts`.
 *
 * `tx` is the opaque `Transaction` from `ServiceContext` (§11); a call with no
 * `tx` runs on the pooled connection. The SQL adapter narrows it internally.
 */
import type { Testament } from '../../../contracts/index';
import type { Transaction } from '../shared/context';
import type {
  LearningModuleRecord,
  LearningObjectiveRecord,
  LearningPlanRecord,
  LessonBlockRecord,
  LessonBlockUpsert,
  LessonRecord,
  LessonSessionRecord,
  LessonSessionStart,
  LessonUpsert,
  ModuleUpsert,
  ObjectiveUpsert,
  PlanUpsert,
  PracticeSessionCreate,
  PracticeSessionRecord,
} from './types';

/** Bounded text search over published content (§10.2/§10.3) — `q` is matched against title/description (and, for objectives, `topicPath`) case-insensitively. */
export interface LearningSearchQuery {
  q: string;
  testament?: Testament | null;
  limit: number;
}

export interface LearningPlanRepository {
  /** Insert or update by `id` — the mapping script's idempotency boundary. */
  upsert(input: PlanUpsert, tx?: Transaction): Promise<LearningPlanRecord>;
  getById(id: string, tx?: Transaction): Promise<LearningPlanRecord | null>;
  /** Every plan regardless of status — mapping-script reporting and future admin use. */
  listAll(tx?: Transaction): Promise<LearningPlanRecord[]>;
  /** Published plans matching `query.q` (§10.2), optionally narrowed by testament. */
  searchPublished(query: LearningSearchQuery, tx?: Transaction): Promise<LearningPlanRecord[]>;
}

export interface LearningModuleRepository {
  upsert(input: ModuleUpsert, tx?: Transaction): Promise<LearningModuleRecord>;
  getById(id: string, tx?: Transaction): Promise<LearningModuleRecord | null>;
  /** All modules of a plan, any depth — callers group by `parentModuleId` themselves. */
  listByPlan(planId: string, tx?: Transaction): Promise<LearningModuleRecord[]>;
}

export interface LearningObjectiveRepository {
  upsert(input: ObjectiveUpsert, tx?: Transaction): Promise<LearningObjectiveRecord>;
  getById(id: string, tx?: Transaction): Promise<LearningObjectiveRecord | null>;
  listByPlan(planId: string, tx?: Transaction): Promise<LearningObjectiveRecord[]>;
  /** Published objectives matching `query.q` (§10.2), optionally narrowed by testament. */
  searchPublished(query: LearningSearchQuery, tx?: Transaction): Promise<LearningObjectiveRecord[]>;
}

export interface LessonRepository {
  upsert(input: LessonUpsert, tx?: Transaction): Promise<LessonRecord>;
  getById(id: string, tx?: Transaction): Promise<LessonRecord | null>;
  listByModule(moduleId: string, tx?: Transaction): Promise<LessonRecord[]>;
  /** The 1:1 lesson for an objective (schema comment on `lessons` documents this assumption for WS1/WS2). */
  getByObjectiveId(objectiveId: string, tx?: Transaction): Promise<LessonRecord | null>;
}

export interface LessonBlockRepository {
  /**
   * Replace every block of `lessonId` with `blocks` (delete-then-insert in one
   * statement pair). The mapping script regenerates a lesson's blocks wholesale
   * each run from the topic node + its published questions, so replace-all keeps
   * re-runs idempotent without diffing individual block positions.
   */
  replaceForLesson(
    lessonId: string,
    blocks: LessonBlockUpsert[],
    tx?: Transaction,
  ): Promise<LessonBlockRecord[]>;
  listByLesson(lessonId: string, tx?: Transaction): Promise<LessonBlockRecord[]>;
}

/**
 * A resumable lesson-session lifecycle (§11.4): one row per lesson attempt,
 * `status`/`checkpointBlockId` tracked server-side so a client reload resumes
 * instead of restarting. `tx` support is required (WS2 completion may run
 * inside a caller's transaction later); the in-memory adapter still rejects it,
 * same rule as every other repository here.
 */
export interface LessonSessionRepository {
  start(input: LessonSessionStart, tx?: Transaction): Promise<LessonSessionRecord>;
  getById(id: string, tx?: Transaction): Promise<LessonSessionRecord | null>;
  /** The caller's own in-progress session for this lesson, if any — resume instead of duplicating. */
  getActiveForUser(userId: string, lessonId: string, tx?: Transaction): Promise<LessonSessionRecord | null>;
  /** Most recently active in-progress session across any lesson — Today's `activeLesson` (§9.1). */
  getMostRecentActive(userId: string, tx?: Transaction): Promise<LessonSessionRecord | null>;
  /** Most recently completed session across any lesson — Today's `recentOutcome` (§9.1). */
  getMostRecentCompleted(userId: string, tx?: Transaction): Promise<LessonSessionRecord | null>;
  updateCheckpoint(id: string, checkpointBlockId: string, tx?: Transaction): Promise<LessonSessionRecord>;
  complete(id: string, tx?: Transaction): Promise<LessonSessionRecord>;
  /** Count of sessions completed at/after `sinceIso` — the daily-goal counter (§9.4, authoritative completion events only). */
  countCompletedSince(userId: string, sinceIso: string, tx?: Transaction): Promise<number>;
}

/**
 * A server-tracked practice/review session (§12.1): pins the ordered question
 * revisions shown so a reload doesn't re-roll the set, and tracks
 * `currentIndex` so "no answer key for future questions" is enforceable.
 */
export interface PracticeSessionRepository {
  create(input: PracticeSessionCreate, tx?: Transaction): Promise<PracticeSessionRecord>;
  getById(id: string, tx?: Transaction): Promise<PracticeSessionRecord | null>;
  /** Bumps `currentIndex`; flips to `completed` once every pinned question has been answered. */
  advance(id: string, tx?: Transaction): Promise<PracticeSessionRecord>;
}

export interface LearningRepositories {
  plans: LearningPlanRepository;
  modules: LearningModuleRepository;
  objectives: LearningObjectiveRepository;
  lessons: LessonRepository;
  blocks: LessonBlockRepository;
  lessonSessions: LessonSessionRepository;
  practiceSessions: PracticeSessionRepository;
}
