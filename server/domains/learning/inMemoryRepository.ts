/**
 * In-memory learning repositories (Phase 3 WS1 parity peer, ADR-017).
 *
 * For dev fixtures and as the contract-test peer to the SQL adapter. Writes
 * inside a `tx` are rejected — the in-memory store does not emulate transactions
 * for production writes (same rule as `content`/`progression`).
 */
import type { Transaction } from '../shared/context';
import type {
  LearningModuleRepository,
  LearningObjectiveRepository,
  LearningPlanRepository,
  LearningRepositories,
  LessonBlockRepository,
  LessonRepository,
} from './repository';
import type {
  LearningModuleRecord,
  LearningObjectiveRecord,
  LearningPlanRecord,
  LessonBlockRecord,
  LessonRecord,
} from './types';

function rejectTx(tx?: Transaction): void {
  if (tx) {
    throw new Error('in-memory learning repository does not support transactional writes');
  }
}

export function createInMemoryLearningRepositories(
  now: () => Date = () => new Date(),
): LearningRepositories {
  const plans = new Map<string, LearningPlanRecord>();
  const modules = new Map<string, LearningModuleRecord>();
  const objectives = new Map<string, LearningObjectiveRecord>();
  const lessons = new Map<string, LessonRecord>();
  const blocksByLesson = new Map<string, LessonBlockRecord[]>();

  const iso = (): string => now().toISOString();

  const planRepo: LearningPlanRepository = {
    async upsert(input, tx) {
      rejectTx(tx);
      const existing = plans.get(input.id);
      const row: LearningPlanRecord = {
        id: input.id,
        themeId: input.themeId,
        title: input.title,
        description: input.description ?? null,
        status: input.status ?? existing?.status ?? 'legacy_unreviewed',
        position: input.position ?? existing?.position ?? 0,
        source: input.source ?? existing?.source ?? 'topic-tree',
        createdAt: existing?.createdAt ?? iso(),
        updatedAt: iso(),
      };
      plans.set(row.id, row);
      return { ...row };
    },
    async getById(id, tx) {
      rejectTx(tx);
      const r = plans.get(id);
      return r ? { ...r } : null;
    },
    async listAll(tx) {
      rejectTx(tx);
      return [...plans.values()].map((r) => ({ ...r }));
    },
  };

  const moduleRepo: LearningModuleRepository = {
    async upsert(input, tx) {
      rejectTx(tx);
      const existing = modules.get(input.id);
      const row: LearningModuleRecord = {
        id: input.id,
        planId: input.planId,
        parentModuleId: input.parentModuleId ?? existing?.parentModuleId ?? null,
        title: input.title,
        description: input.description ?? null,
        status: input.status ?? existing?.status ?? 'legacy_unreviewed',
        position: input.position ?? existing?.position ?? 0,
        source: input.source ?? existing?.source ?? 'topic-tree',
        createdAt: existing?.createdAt ?? iso(),
        updatedAt: iso(),
      };
      modules.set(row.id, row);
      return { ...row };
    },
    async getById(id, tx) {
      rejectTx(tx);
      const r = modules.get(id);
      return r ? { ...r } : null;
    },
    async listByPlan(planId, tx) {
      rejectTx(tx);
      return [...modules.values()]
        .filter((m) => m.planId === planId)
        .sort((a, b) => a.position - b.position)
        .map((r) => ({ ...r }));
    },
  };

  const objectiveRepo: LearningObjectiveRepository = {
    async upsert(input, tx) {
      rejectTx(tx);
      const existing = objectives.get(input.id);
      const row: LearningObjectiveRecord = {
        id: input.id,
        planId: input.planId,
        title: input.title,
        description: input.description ?? null,
        topicPath: input.topicPath ?? existing?.topicPath ?? null,
        status: input.status ?? existing?.status ?? 'legacy_unreviewed',
        position: input.position ?? existing?.position ?? 0,
        source: input.source ?? existing?.source ?? 'topic-tree',
        createdAt: existing?.createdAt ?? iso(),
        updatedAt: iso(),
      };
      objectives.set(row.id, row);
      return { ...row };
    },
    async getById(id, tx) {
      rejectTx(tx);
      const r = objectives.get(id);
      return r ? { ...r } : null;
    },
    async listByPlan(planId, tx) {
      rejectTx(tx);
      return [...objectives.values()]
        .filter((o) => o.planId === planId)
        .sort((a, b) => a.position - b.position)
        .map((r) => ({ ...r }));
    },
  };

  const lessonRepo: LessonRepository = {
    async upsert(input, tx) {
      rejectTx(tx);
      const existing = lessons.get(input.id);
      const row: LessonRecord = {
        id: input.id,
        planId: input.planId,
        moduleId: input.moduleId,
        objectiveId: input.objectiveId,
        title: input.title,
        description: input.description ?? null,
        status: input.status ?? existing?.status ?? 'legacy_unreviewed',
        position: input.position ?? existing?.position ?? 0,
        source: input.source ?? existing?.source ?? 'topic-tree',
        createdAt: existing?.createdAt ?? iso(),
        updatedAt: iso(),
      };
      lessons.set(row.id, row);
      return { ...row };
    },
    async getById(id, tx) {
      rejectTx(tx);
      const r = lessons.get(id);
      return r ? { ...r } : null;
    },
    async listByModule(moduleId, tx) {
      rejectTx(tx);
      return [...lessons.values()]
        .filter((l) => l.moduleId === moduleId)
        .sort((a, b) => a.position - b.position)
        .map((r) => ({ ...r }));
    },
  };

  const blockRepo: LessonBlockRepository = {
    async replaceForLesson(lessonId, drafts, tx) {
      rejectTx(tx);
      const ts = iso();
      const rows: LessonBlockRecord[] = drafts
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((d) => ({
          id: d.id,
          lessonId,
          position: d.position,
          blockType: d.blockType,
          schemaVersion: d.schemaVersion ?? 1,
          payload: d.payload ?? {},
          status: d.status ?? 'legacy_unreviewed',
          createdAt: ts,
          updatedAt: ts,
        }));
      blocksByLesson.set(lessonId, rows);
      return rows.map((r) => ({ ...r, payload: { ...r.payload } }));
    },
    async listByLesson(lessonId, tx) {
      rejectTx(tx);
      return (blocksByLesson.get(lessonId) ?? []).map((r) => ({ ...r, payload: { ...r.payload } }));
    },
  };

  return {
    plans: planRepo,
    modules: moduleRepo,
    objectives: objectiveRepo,
    lessons: lessonRepo,
    blocks: blockRepo,
  };
}
