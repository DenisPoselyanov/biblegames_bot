/**
 * SQL learning repositories (Phase 3 WS1, ADR-017) — the production adapter for
 * `server/domains/learning/repository.ts`, on Drizzle.
 *
 * The opaque `Transaction` from `ServiceContext` is narrowed to the Drizzle
 * executor here and nowhere else (`asExecutor`), same pattern as `content.ts`.
 */
import { and, asc, desc, eq, gte, ilike, inArray, or, sql } from 'drizzle-orm';
import type {
  ContentStatus,
  LessonSessionStatus,
  PracticeSessionMode,
  PracticeSessionStatus,
  Testament,
} from '../../../../contracts/index';
import type { Transaction as OpaqueTx } from '../../../domains/shared/context';
import { assertAiWriteAllowed } from '../../../domains/shared/contentWriteGuard';
import { hashLessonRevisionBody } from '../../../domains/learning/lessonHash';
import type {
  LearningModuleRepository,
  LearningObjectiveRepository,
  LearningPlanRepository,
  LearningRepositories,
  LessonBlockRepository,
  LessonRepository,
  LessonRevisionRepository,
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
  LessonRevisionBlock,
  LessonRevisionRecord,
  LessonSessionRecord,
  PracticeSessionRecord,
} from '../../../domains/learning/types';
import type { Database, Transaction } from '../client';
import {
  learningModules,
  learningObjectives,
  learningPlans,
  lessonBlocks,
  lessonRevisions,
  lessons,
} from '../schema/learning';
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
type LessonRevisionRow = typeof lessonRevisions.$inferSelect;

let revSeq = 0;
const nextRevId = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}${(++revSeq).toString(36).padStart(3, '0')}`;

const toLessonRevision = (r: LessonRevisionRow): LessonRevisionRecord => ({
  id: r.id,
  lessonId: r.lessonId,
  revisionNumber: r.revisionNumber,
  status: r.status as ContentStatus,
  planId: r.planId,
  moduleId: r.moduleId,
  objectiveId: r.objectiveId,
  title: r.title,
  description: r.description,
  blocks: r.blocks as LessonRevisionBlock[],
  contentHash: r.contentHash,
  source: r.source,
  createdAt: r.createdAt,
  createdBy: r.createdBy,
  supersededAt: r.supersededAt,
  quarantineReason: r.quarantineReason,
});

const toPlan = (r: PlanRow): LearningPlanRecord => ({
  id: r.id,
  themeId: r.themeId,
  title: r.title,
  description: r.description,
  status: r.status as ContentStatus,
  position: r.position,
  source: r.source as LearningPlanRecord['source'],
  testament: r.testament as Testament | null,
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
  testament: r.testament as Testament | null,
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
          testament: input.testament ?? null,
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
            ...(input.testament !== undefined ? { testament: input.testament } : {}),
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
    async searchPublished(query, tx) {
      const pattern = `%${query.q}%`;
      const rows = await asExecutor(db, tx)
        .select()
        .from(learningPlans)
        .where(
          and(
            eq(learningPlans.status, 'published'),
            or(ilike(learningPlans.title, pattern), ilike(learningPlans.description, pattern)),
            query.testament ? eq(learningPlans.testament, query.testament) : undefined,
          ),
        )
        .orderBy(asc(learningPlans.position))
        .limit(query.limit);
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
          testament: input.testament ?? null,
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
            ...(input.testament !== undefined ? { testament: input.testament } : {}),
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
    async searchPublished(query, tx) {
      const pattern = `%${query.q}%`;
      const rows = await asExecutor(db, tx)
        .select()
        .from(learningObjectives)
        .where(
          and(
            eq(learningObjectives.status, 'published'),
            or(
              ilike(learningObjectives.title, pattern),
              ilike(learningObjectives.description, pattern),
              ilike(learningObjectives.topicPath, pattern),
            ),
            query.testament ? eq(learningObjectives.testament, query.testament) : undefined,
          ),
        )
        .orderBy(asc(learningObjectives.position))
        .limit(query.limit);
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

  const lessonRevisionRepo: LessonRevisionRepository = {
    async getById(id, tx) {
      const [row] = await asExecutor(db, tx)
        .select()
        .from(lessonRevisions)
        .where(eq(lessonRevisions.id, id))
        .limit(1);
      return row ? toLessonRevision(row) : null;
    },
    async getPublished(lessonId, tx) {
      const [row] = await asExecutor(db, tx)
        .select()
        .from(lessonRevisions)
        .where(and(eq(lessonRevisions.lessonId, lessonId), eq(lessonRevisions.status, 'published')))
        .limit(1);
      return row ? toLessonRevision(row) : null;
    },
    async listRevisions(lessonId, tx) {
      const rows = await asExecutor(db, tx)
        .select()
        .from(lessonRevisions)
        .where(eq(lessonRevisions.lessonId, lessonId))
        .orderBy(desc(lessonRevisions.revisionNumber));
      return rows.map(toLessonRevision);
    },
    async appendRevision(draft, tx) {
      assertAiWriteAllowed(draft.source, draft.status);
      const exec = asExecutor(db, tx);
      const contentHash = hashLessonRevisionBody({
        planId: draft.planId,
        moduleId: draft.moduleId,
        objectiveId: draft.objectiveId,
        title: draft.title,
        description: draft.description ?? null,
        blocks: draft.blocks,
      });

      const [latest] = await exec
        .select()
        .from(lessonRevisions)
        .where(eq(lessonRevisions.lessonId, draft.lessonId))
        .orderBy(desc(lessonRevisions.revisionNumber))
        .limit(1);

      if (latest?.contentHash === contentHash) {
        return { kind: 'unchanged', revision: toLessonRevision(latest) };
      }

      const id = nextRevId('lrev');
      const [row] = await exec
        .insert(lessonRevisions)
        .values({
          id,
          lessonId: draft.lessonId,
          revisionNumber: (latest?.revisionNumber ?? 0) + 1,
          status: draft.status ?? 'legacy_unreviewed',
          planId: draft.planId,
          moduleId: draft.moduleId,
          objectiveId: draft.objectiveId,
          title: draft.title,
          description: draft.description ?? null,
          blocks: draft.blocks,
          contentHash,
          source: draft.source ?? 'authored',
          createdBy: draft.createdBy ?? null,
        })
        .returning();
      return { kind: 'created', revision: toLessonRevision(row) };
    },
    async publishRevision(revisionId, tx) {
      const exec = asExecutor(db, tx);
      const [target] = await exec
        .select()
        .from(lessonRevisions)
        .where(eq(lessonRevisions.id, revisionId))
        .limit(1);
      if (!target) throw new Error(`lesson revision ${revisionId} not found`);
      const nowIso = new Date().toISOString();
      await exec
        .update(lessonRevisions)
        .set({ status: 'archived', supersededAt: nowIso })
        .where(
          and(eq(lessonRevisions.lessonId, target.lessonId), eq(lessonRevisions.status, 'published')),
        );
      const [row] = await exec
        .update(lessonRevisions)
        .set({ status: 'published', supersededAt: null, quarantineReason: null })
        .where(eq(lessonRevisions.id, revisionId))
        .returning();

      // Write-through: keep the mutable `lessons`/`lesson_blocks` rows (Learn
      // hub's read path) in sync with the published snapshot (ADR-019 §2).
      const blocksSnapshot = row.blocks as LessonRevisionBlock[];
      await exec
        .insert(lessons)
        .values({
          id: target.lessonId,
          planId: target.planId,
          moduleId: target.moduleId,
          objectiveId: target.objectiveId,
          title: target.title,
          description: target.description,
          status: 'published',
          source: 'authored',
        })
        .onConflictDoUpdate({
          target: lessons.id,
          set: {
            planId: target.planId,
            moduleId: target.moduleId,
            objectiveId: target.objectiveId,
            title: target.title,
            description: target.description,
            status: 'published',
            source: 'authored',
            updatedAt: sql`now()`,
          },
        });
      await exec.delete(lessonBlocks).where(eq(lessonBlocks.lessonId, target.lessonId));
      if (blocksSnapshot.length) {
        await exec.insert(lessonBlocks).values(
          blocksSnapshot.map((b, position) => ({
            id: b.id,
            lessonId: target.lessonId,
            position,
            blockType: b.blockType,
            schemaVersion: b.schemaVersion,
            payload: b.payload,
            status: 'published',
          })),
        );
      }

      return toLessonRevision(row);
    },
    async quarantine(input, tx) {
      const rows = await asExecutor(db, tx)
        .update(lessonRevisions)
        .set({ status: 'quarantined', quarantineReason: input.reason })
        .where(
          and(
            eq(lessonRevisions.lessonId, input.lessonId),
            inArray(lessonRevisions.status, [
              'legacy_unreviewed',
              'draft',
              'ready_for_review',
              'published',
            ]),
          ),
        )
        .returning({ id: lessonRevisions.id });
      return rows.length;
    },
  };

  return {
    plans,
    modules,
    objectives,
    lessons: lessonRepo,
    blocks,
    lessonRevisions: lessonRevisionRepo,
    lessonSessions: lessonSessionRepo,
    practiceSessions: practiceSessionRepo,
  };
}
