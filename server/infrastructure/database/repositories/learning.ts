/**
 * SQL learning repositories (Phase 3 WS1, ADR-017) — the production adapter for
 * `server/domains/learning/repository.ts`, on Drizzle.
 *
 * The opaque `Transaction` from `ServiceContext` is narrowed to the Drizzle
 * executor here and nowhere else (`asExecutor`), same pattern as `content.ts`.
 */
import { and, asc, desc, eq, gte, sql } from 'drizzle-orm';
import type {
  ContentStatus,
  LessonSessionStatus,
  PracticeSessionMode,
  PracticeSessionStatus,
} from '../../../../contracts/index';
import type { Transaction as OpaqueTx } from '../../../domains/shared/context';
import type {
  LearningModuleRepository,
  LearningObjectiveRepository,
  LearningPlanRepository,
  LearningRepositories,
  LessonBlockRepository,
  LessonRepository,
  LessonSessionRepository,
  PracticeSessionRepository,
} from '../../../domains/learning/repository';
import type {
  LearningModuleRecord,
  LearningObjectiveRecord,
  LearningPlanRecord,
  LessonBlockRecord,
  LessonBlockType,
  LessonRecord,
  LessonSessionRecord,
  PracticeSessionRecord,
} from '../../../domains/learning/types';
import type { Database, Transaction } from '../client';
import { learningModules, learningObjectives, learningPlans, lessonBlocks, lessons } from '../schema/learning';
import { lessonSessions, practiceSessions } from '../schema/learningSessions';

type Executor = Database | Transaction;

function asExecutor(db: Database, tx?: OpaqueTx): Executor {
  return (tx as unknown as Transaction | undefined) ?? db;
}

type PlanRow = typeof learningPlans.$inferSelect;
type ModuleRow = typeof learningModules.$inferSelect;
type ObjectiveRow = typeof learningObjectives.$inferSelect;
type LessonRow = typeof lessons.$inferSelect;
type BlockRow = typeof lessonBlocks.$inferSelect;
type LessonSessionRow = typeof lessonSessions.$inferSelect;
type PracticeSessionRow = typeof practiceSessions.$inferSelect;

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

const toLessonSession = (r: LessonSessionRow): LessonSessionRecord => ({
  id: r.id,
  userId: r.userId,
  lessonId: r.lessonId,
  planId: r.planId,
  moduleId: r.moduleId,
  status: r.status as LessonSessionStatus,
  contentRevision: r.contentRevision,
  checkpointBlockId: r.checkpointBlockId,
  startedAt: r.startedAt,
  lastActivityAt: r.lastActivityAt,
  completedAt: r.completedAt,
});

const toPracticeSession = (r: PracticeSessionRow): PracticeSessionRecord => ({
  id: r.id,
  userId: r.userId,
  mode: r.mode as PracticeSessionMode,
  objectiveId: r.objectiveId,
  questionRevisionIds: r.questionRevisionIds,
  currentIndex: r.currentIndex,
  status: r.status as PracticeSessionStatus,
  createdAt: r.createdAt,
  expiresAt: r.expiresAt,
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
    async getByObjectiveId(objectiveId, tx) {
      const [row] = await asExecutor(db, tx)
        .select()
        .from(lessons)
        .where(eq(lessons.objectiveId, objectiveId))
        .limit(1);
      return row ? toLesson(row) : null;
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

  const lessonSessionRepo: LessonSessionRepository = {
    async start(input, tx) {
      const [row] = await asExecutor(db, tx)
        .insert(lessonSessions)
        .values({
          id: input.id,
          userId: input.userId,
          lessonId: input.lessonId,
          planId: input.planId,
          moduleId: input.moduleId,
          status: 'in_progress',
          contentRevision: input.contentRevision,
          checkpointBlockId: null,
        })
        .returning();
      return toLessonSession(row);
    },
    async getById(id, tx) {
      const [row] = await asExecutor(db, tx)
        .select()
        .from(lessonSessions)
        .where(eq(lessonSessions.id, id))
        .limit(1);
      return row ? toLessonSession(row) : null;
    },
    async getActiveForUser(userId, lessonId, tx) {
      const [row] = await asExecutor(db, tx)
        .select()
        .from(lessonSessions)
        .where(
          and(
            eq(lessonSessions.userId, userId),
            eq(lessonSessions.lessonId, lessonId),
            eq(lessonSessions.status, 'in_progress'),
          ),
        )
        .orderBy(desc(lessonSessions.lastActivityAt))
        .limit(1);
      return row ? toLessonSession(row) : null;
    },
    async getMostRecentActive(userId, tx) {
      const [row] = await asExecutor(db, tx)
        .select()
        .from(lessonSessions)
        .where(and(eq(lessonSessions.userId, userId), eq(lessonSessions.status, 'in_progress')))
        .orderBy(desc(lessonSessions.lastActivityAt))
        .limit(1);
      return row ? toLessonSession(row) : null;
    },
    async getMostRecentCompleted(userId, tx) {
      const [row] = await asExecutor(db, tx)
        .select()
        .from(lessonSessions)
        .where(and(eq(lessonSessions.userId, userId), eq(lessonSessions.status, 'completed')))
        .orderBy(desc(lessonSessions.completedAt))
        .limit(1);
      return row ? toLessonSession(row) : null;
    },
    async updateCheckpoint(id, checkpointBlockId, tx) {
      const [row] = await asExecutor(db, tx)
        .update(lessonSessions)
        .set({ checkpointBlockId, lastActivityAt: sql`now()` })
        .where(eq(lessonSessions.id, id))
        .returning();
      if (!row) throw new Error(`lesson session ${id} not found`);
      return toLessonSession(row);
    },
    async complete(id, tx) {
      const [row] = await asExecutor(db, tx)
        .update(lessonSessions)
        .set({ status: 'completed', lastActivityAt: sql`now()`, completedAt: sql`now()` })
        .where(eq(lessonSessions.id, id))
        .returning();
      if (!row) throw new Error(`lesson session ${id} not found`);
      return toLessonSession(row);
    },
    async countCompletedSince(userId, sinceIso, tx) {
      const rows = await asExecutor(db, tx)
        .select({ count: sql<number>`count(*)::int` })
        .from(lessonSessions)
        .where(
          and(
            eq(lessonSessions.userId, userId),
            eq(lessonSessions.status, 'completed'),
            gte(lessonSessions.completedAt, sinceIso),
          ),
        );
      return rows[0]?.count ?? 0;
    },
  };

  const practiceSessionRepo: PracticeSessionRepository = {
    async create(input, tx) {
      const [row] = await asExecutor(db, tx)
        .insert(practiceSessions)
        .values({
          id: input.id,
          userId: input.userId,
          mode: input.mode,
          objectiveId: input.objectiveId,
          questionRevisionIds: input.questionRevisionIds,
          currentIndex: 0,
          status: 'active',
          expiresAt: input.expiresAt,
        })
        .returning();
      return toPracticeSession(row);
    },
    async getById(id, tx) {
      const [row] = await asExecutor(db, tx)
        .select()
        .from(practiceSessions)
        .where(eq(practiceSessions.id, id))
        .limit(1);
      return row ? toPracticeSession(row) : null;
    },
    async advance(id, tx) {
      const exec = asExecutor(db, tx);
      const [existing] = await exec.select().from(practiceSessions).where(eq(practiceSessions.id, id)).limit(1);
      if (!existing) throw new Error(`practice session ${id} not found`);
      const nextIndex = existing.currentIndex + 1;
      const nextStatus = nextIndex >= existing.questionRevisionIds.length ? 'completed' : existing.status;
      const [row] = await exec
        .update(practiceSessions)
        .set({ currentIndex: nextIndex, status: nextStatus })
        .where(eq(practiceSessions.id, id))
        .returning();
      return toPracticeSession(row);
    },
  };

  return {
    plans,
    modules,
    objectives,
    lessons: lessonRepo,
    blocks,
    lessonSessions: lessonSessionRepo,
    practiceSessions: practiceSessionRepo,
  };
}
