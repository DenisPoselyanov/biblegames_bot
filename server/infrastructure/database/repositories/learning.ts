/**
 * SQL learning repositories (Phase 3 WS1, ADR-017) — the production adapter for
 * `server/domains/learning/repository.ts`, on Drizzle.
 *
 * The opaque `Transaction` from `ServiceContext` is narrowed to the Drizzle
 * executor here and nowhere else (`asExecutor`), same pattern as `content.ts`.
 */
import { asc, eq, sql } from 'drizzle-orm';
import type { ContentStatus } from '../../../../contracts/index';
import type { Transaction as OpaqueTx } from '../../../domains/shared/context';
import type {
  LearningModuleRepository,
  LearningObjectiveRepository,
  LearningPlanRepository,
  LearningRepositories,
  LessonBlockRepository,
  LessonRepository,
} from '../../../domains/learning/repository';
import type {
  LearningModuleRecord,
  LearningObjectiveRecord,
  LearningPlanRecord,
  LessonBlockRecord,
  LessonBlockType,
  LessonRecord,
} from '../../../domains/learning/types';
import type { Database, Transaction } from '../client';
import { learningModules, learningObjectives, learningPlans, lessonBlocks, lessons } from '../schema/learning';

type Executor = Database | Transaction;

function asExecutor(db: Database, tx?: OpaqueTx): Executor {
  return (tx as unknown as Transaction | undefined) ?? db;
}

type PlanRow = typeof learningPlans.$inferSelect;
type ModuleRow = typeof learningModules.$inferSelect;
type ObjectiveRow = typeof learningObjectives.$inferSelect;
type LessonRow = typeof lessons.$inferSelect;
type BlockRow = typeof lessonBlocks.$inferSelect;

const toPlan = (r: PlanRow): LearningPlanRecord => ({
  id: r.id,
  themeId: r.themeId,
  title: r.title,
  description: r.description,
  status: r.status as ContentStatus,
  position: r.position,
  source: r.source as LearningPlanRecord['source'],
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

const toModule = (r: ModuleRow): LearningModuleRecord => ({
  id: r.id,
  planId: r.planId,
  parentModuleId: r.parentModuleId,
  title: r.title,
  description: r.description,
  status: r.status as ContentStatus,
  position: r.position,
  source: r.source as LearningModuleRecord['source'],
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

const toObjective = (r: ObjectiveRow): LearningObjectiveRecord => ({
  id: r.id,
  planId: r.planId,
  title: r.title,
  description: r.description,
  topicPath: r.topicPath,
  status: r.status as ContentStatus,
  position: r.position,
  source: r.source as LearningObjectiveRecord['source'],
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

const toLesson = (r: LessonRow): LessonRecord => ({
  id: r.id,
  planId: r.planId,
  moduleId: r.moduleId,
  objectiveId: r.objectiveId,
  title: r.title,
  description: r.description,
  status: r.status as ContentStatus,
  position: r.position,
  source: r.source as LessonRecord['source'],
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

const toBlock = (r: BlockRow): LessonBlockRecord => ({
  id: r.id,
  lessonId: r.lessonId,
  position: r.position,
  blockType: r.blockType as LessonBlockType,
  schemaVersion: r.schemaVersion,
  payload: r.payload,
  status: r.status as ContentStatus,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

export function createSqlLearningRepositories(db: Database): LearningRepositories {
  const plans: LearningPlanRepository = {
    async upsert(input, tx) {
      const exec = asExecutor(db, tx);
      const [row] = await exec
        .insert(learningPlans)
        .values({
          id: input.id,
          themeId: input.themeId,
          title: input.title,
          description: input.description ?? null,
          status: input.status ?? 'legacy_unreviewed',
          position: input.position ?? 0,
          source: input.source ?? 'topic-tree',
        })
        .onConflictDoUpdate({
          target: learningPlans.id,
          set: {
            themeId: input.themeId,
            title: input.title,
            description: input.description ?? null,
            ...(input.status ? { status: input.status } : {}),
            ...(input.position !== undefined ? { position: input.position } : {}),
            ...(input.source ? { source: input.source } : {}),
            updatedAt: sql`now()`,
          },
        })
        .returning();
      return toPlan(row);
    },
    async getById(id, tx) {
      const [row] = await asExecutor(db, tx)
        .select()
        .from(learningPlans)
        .where(eq(learningPlans.id, id))
        .limit(1);
      return row ? toPlan(row) : null;
    },
    async listAll(tx) {
      const rows = await asExecutor(db, tx).select().from(learningPlans).orderBy(asc(learningPlans.position));
      return rows.map(toPlan);
    },
  };

  const modules: LearningModuleRepository = {
    async upsert(input, tx) {
      const exec = asExecutor(db, tx);
      const [row] = await exec
        .insert(learningModules)
        .values({
          id: input.id,
          planId: input.planId,
          parentModuleId: input.parentModuleId ?? null,
          title: input.title,
          description: input.description ?? null,
          status: input.status ?? 'legacy_unreviewed',
          position: input.position ?? 0,
          source: input.source ?? 'topic-tree',
        })
        .onConflictDoUpdate({
          target: learningModules.id,
          set: {
            planId: input.planId,
            parentModuleId: input.parentModuleId ?? null,
            title: input.title,
            description: input.description ?? null,
            ...(input.status ? { status: input.status } : {}),
            ...(input.position !== undefined ? { position: input.position } : {}),
            ...(input.source ? { source: input.source } : {}),
            updatedAt: sql`now()`,
          },
        })
        .returning();
      return toModule(row);
    },
    async getById(id, tx) {
      const [row] = await asExecutor(db, tx)
        .select()
        .from(learningModules)
        .where(eq(learningModules.id, id))
        .limit(1);
      return row ? toModule(row) : null;
    },
    async listByPlan(planId, tx) {
      const rows = await asExecutor(db, tx)
        .select()
        .from(learningModules)
        .where(eq(learningModules.planId, planId))
        .orderBy(asc(learningModules.position));
      return rows.map(toModule);
    },
  };

  const objectives: LearningObjectiveRepository = {
    async upsert(input, tx) {
      const exec = asExecutor(db, tx);
      const [row] = await exec
        .insert(learningObjectives)
        .values({
          id: input.id,
          planId: input.planId,
          title: input.title,
          description: input.description ?? null,
          topicPath: input.topicPath ?? null,
          status: input.status ?? 'legacy_unreviewed',
          position: input.position ?? 0,
          source: input.source ?? 'topic-tree',
        })
        .onConflictDoUpdate({
          target: learningObjectives.id,
          set: {
            planId: input.planId,
            title: input.title,
            description: input.description ?? null,
            topicPath: input.topicPath ?? null,
            ...(input.status ? { status: input.status } : {}),
            ...(input.position !== undefined ? { position: input.position } : {}),
            ...(input.source ? { source: input.source } : {}),
            updatedAt: sql`now()`,
          },
        })
        .returning();
      return toObjective(row);
    },
    async getById(id, tx) {
      const [row] = await asExecutor(db, tx)
        .select()
        .from(learningObjectives)
        .where(eq(learningObjectives.id, id))
        .limit(1);
      return row ? toObjective(row) : null;
    },
    async listByPlan(planId, tx) {
      const rows = await asExecutor(db, tx)
        .select()
        .from(learningObjectives)
        .where(eq(learningObjectives.planId, planId))
        .orderBy(asc(learningObjectives.position));
      return rows.map(toObjective);
    },
  };

  const lessonRepo: LessonRepository = {
    async upsert(input, tx) {
      const exec = asExecutor(db, tx);
      const [row] = await exec
        .insert(lessons)
        .values({
          id: input.id,
          planId: input.planId,
          moduleId: input.moduleId,
          objectiveId: input.objectiveId,
          title: input.title,
          description: input.description ?? null,
          status: input.status ?? 'legacy_unreviewed',
          position: input.position ?? 0,
          source: input.source ?? 'topic-tree',
        })
        .onConflictDoUpdate({
          target: lessons.id,
          set: {
            planId: input.planId,
            moduleId: input.moduleId,
            objectiveId: input.objectiveId,
            title: input.title,
            description: input.description ?? null,
            ...(input.status ? { status: input.status } : {}),
            ...(input.position !== undefined ? { position: input.position } : {}),
            ...(input.source ? { source: input.source } : {}),
            updatedAt: sql`now()`,
          },
        })
        .returning();
      return toLesson(row);
    },
    async getById(id, tx) {
      const [row] = await asExecutor(db, tx).select().from(lessons).where(eq(lessons.id, id)).limit(1);
      return row ? toLesson(row) : null;
    },
    async listByModule(moduleId, tx) {
      const rows = await asExecutor(db, tx)
        .select()
        .from(lessons)
        .where(eq(lessons.moduleId, moduleId))
        .orderBy(asc(lessons.position));
      return rows.map(toLesson);
    },
  };

  const blocks: LessonBlockRepository = {
    async replaceForLesson(lessonId, drafts, tx) {
      const exec = asExecutor(db, tx);
      await exec.delete(lessonBlocks).where(eq(lessonBlocks.lessonId, lessonId));
      if (drafts.length === 0) return [];
      const rows = await exec
        .insert(lessonBlocks)
        .values(
          drafts.map((d) => ({
            id: d.id,
            lessonId,
            position: d.position,
            blockType: d.blockType,
            schemaVersion: d.schemaVersion ?? 1,
            payload: d.payload ?? {},
            status: d.status ?? 'legacy_unreviewed',
          })),
        )
        .returning();
      return rows.map(toBlock).sort((a, b) => a.position - b.position);
    },
    async listByLesson(lessonId, tx) {
      const rows = await asExecutor(db, tx)
        .select()
        .from(lessonBlocks)
        .where(eq(lessonBlocks.lessonId, lessonId))
        .orderBy(asc(lessonBlocks.position));
      return rows.map(toBlock);
    },
  };

  return { plans, modules, objectives, lessons: lessonRepo, blocks };
}
