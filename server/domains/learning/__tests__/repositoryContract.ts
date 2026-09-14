/**
 * Shared learning-repository contract (Phase 3 WS1, ADR-017). Run against every
 * adapter (`server/infrastructure/database/repositories/learning.ts` on pglite,
 * and the in-memory peer). Read behaviour must match; the in-memory adapter is
 * exempt only from real transaction support.
 */
import { expect, it } from 'vitest';
import type { LearningRepositories } from '../repository';

export interface ContractHarness {
  repos: LearningRepositories;
  reset: () => Promise<void>;
}

export function runLearningRepositoryContract(makeHarness: () => Promise<ContractHarness>): void {
  const setup = async (): Promise<LearningRepositories> => {
    const h = await makeHarness();
    await h.reset();
    return h.repos;
  };

  it('upserts a plan idempotently by id', async () => {
    const { plans } = await setup();
    const created = await plans.upsert({ id: 'pentateuch', themeId: 'pentateuch', title: 'Пятикнижжя' });
    expect(created.status).toBe('legacy_unreviewed');
    expect(created.source).toBe('topic-tree');

    const updated = await plans.upsert({
      id: 'pentateuch',
      themeId: 'pentateuch',
      title: 'Пятикнижжя (оновлено)',
    });
    expect(updated.title).toBe('Пятикнижжя (оновлено)');
    expect((await plans.listAll()).filter((p) => p.id === 'pentateuch')).toHaveLength(1);
  });

  it('builds a plan → module → objective → lesson chain with a nested module', async () => {
    const { plans, modules, objectives, lessons } = await setup();
    await plans.upsert({ id: 'pentateuch', themeId: 'pentateuch', title: 'Пятикнижжя' });

    const book = await modules.upsert({
      id: 'pentateuch-sub-1',
      planId: 'pentateuch',
      title: 'Буття',
      position: 0,
    });
    expect(book.parentModuleId).toBeNull();

    const period = await modules.upsert({
      id: 'ot-custom-istorychni-periody-sub-1',
      planId: 'pentateuch',
      parentModuleId: book.id,
      title: 'Створення і ранні покоління',
      position: 0,
    });
    expect(period.parentModuleId).toBe('pentateuch-sub-1');

    const objective = await objectives.upsert({
      id: 'pentateuch-sub-1-sub-1',
      planId: 'pentateuch',
      title: 'Створення світу',
      topicPath: 'Пятикнижжя › Буття › Створення і ранні покоління › Створення світу',
      position: 0,
    });

    const lesson = await lessons.upsert({
      id: 'lesson_pentateuch-sub-1-sub-1',
      planId: 'pentateuch',
      moduleId: period.id,
      objectiveId: objective.id,
      title: 'Створення світу',
      position: 0,
    });

    const modulesForPlan = await modules.listByPlan('pentateuch');
    expect(modulesForPlan.map((m) => m.id).sort()).toEqual(
      ['ot-custom-istorychni-periody-sub-1', 'pentateuch-sub-1'].sort(),
    );

    const objectivesForPlan = await objectives.listByPlan('pentateuch');
    expect(objectivesForPlan.map((o) => o.id)).toEqual(['pentateuch-sub-1-sub-1']);

    const lessonsForModule = await lessons.listByModule(period.id);
    expect(lessonsForModule.map((l) => l.id)).toEqual([lesson.id]);
    expect(lessonsForModule[0].objectiveId).toBe(objective.id);
  });

  it('replaceForLesson is a full swap, ordered by position', async () => {
    const { plans, modules, objectives, lessons, blocks } = await setup();
    await plans.upsert({ id: 'judges', themeId: 'judges', title: 'Судді' });
    await modules.upsert({ id: 'judges-sub-1', planId: 'judges', title: 'Гедеон', position: 0 });
    await objectives.upsert({ id: 'judges-sub-1-sub-1', planId: 'judges', title: 'Заклик Гедеона', position: 0 });
    const lesson = await lessons.upsert({
      id: 'lesson_judges-sub-1-sub-1',
      planId: 'judges',
      moduleId: 'judges-sub-1',
      objectiveId: 'judges-sub-1-sub-1',
      title: 'Заклик Гедеона',
      position: 0,
    });

    await blocks.replaceForLesson(lesson.id, [
      { id: 'b1', lessonId: lesson.id, position: 0, blockType: 'heading', payload: { text: 'Заклик Гедеона' } },
      { id: 'b2', lessonId: lesson.id, position: 1, blockType: 'explanation', payload: { text: '...' } },
    ]);
    const first = await blocks.listByLesson(lesson.id);
    expect(first.map((b) => b.blockType)).toEqual(['heading', 'explanation']);

    const second = await blocks.replaceForLesson(lesson.id, [
      { id: 'b3', lessonId: lesson.id, position: 0, blockType: 'scripture', payload: { ref: 'Judg 6:11-14' } },
    ]);
    expect(second.map((b) => b.blockType)).toEqual(['scripture']);
    expect((await blocks.listByLesson(lesson.id)).map((b) => b.id)).toEqual(['b3']);
  });
}
