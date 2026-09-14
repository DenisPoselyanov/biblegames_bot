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
import type { Transaction } from '../shared/context';
import type {
  LearningModuleRecord,
  LearningObjectiveRecord,
  LearningPlanRecord,
  LessonBlockRecord,
  LessonBlockUpsert,
  LessonRecord,
  LessonUpsert,
  ModuleUpsert,
  ObjectiveUpsert,
  PlanUpsert,
} from './types';

export interface LearningPlanRepository {
  /** Insert or update by `id` — the mapping script's idempotency boundary. */
  upsert(input: PlanUpsert, tx?: Transaction): Promise<LearningPlanRecord>;
  getById(id: string, tx?: Transaction): Promise<LearningPlanRecord | null>;
  /** Every plan regardless of status — mapping-script reporting and future admin use. */
  listAll(tx?: Transaction): Promise<LearningPlanRecord[]>;
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
}

export interface LessonRepository {
  upsert(input: LessonUpsert, tx?: Transaction): Promise<LessonRecord>;
  getById(id: string, tx?: Transaction): Promise<LessonRecord | null>;
  listByModule(moduleId: string, tx?: Transaction): Promise<LessonRecord[]>;
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

export interface LearningRepositories {
  plans: LearningPlanRepository;
  modules: LearningModuleRepository;
  objectives: LearningObjectiveRepository;
  lessons: LessonRepository;
  blocks: LessonBlockRepository;
}
