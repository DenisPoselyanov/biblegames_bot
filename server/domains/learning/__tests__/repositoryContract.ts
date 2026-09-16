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

  it('resolves a lesson by its objective id (§11.1, 1:1 for now)', async () => {
    const { plans, modules, objectives, lessons } = await setup();
    await plans.upsert({ id: 'ruth', themeId: 'ruth', title: 'Рут' });
    await modules.upsert({ id: 'ruth-sub-1', planId: 'ruth', title: 'Наомі', position: 0 });
    await objectives.upsert({ id: 'ruth-sub-1-sub-1', planId: 'ruth', title: 'Повернення', position: 0 });
    const lesson = await lessons.upsert({
      id: 'lesson_ruth-sub-1-sub-1',
      planId: 'ruth',
      moduleId: 'ruth-sub-1',
      objectiveId: 'ruth-sub-1-sub-1',
      title: 'Повернення',
      position: 0,
    });

    const found = await lessons.getByObjectiveId('ruth-sub-1-sub-1');
    expect(found?.id).toBe(lesson.id);
    expect(await lessons.getByObjectiveId('does-not-exist')).toBeNull();
  });

  it('starts, resumes, checkpoints, completes and counts a lesson session (§11.4)', async () => {
    const { plans, modules, objectives, lessons, lessonSessions } = await setup();
    await plans.upsert({ id: 'exodus', themeId: 'exodus', title: 'Вихід' });
    await modules.upsert({ id: 'exodus-sub-1', planId: 'exodus', title: 'Мойсей', position: 0 });
    await objectives.upsert({ id: 'exodus-sub-1-sub-1', planId: 'exodus', title: 'Палаючий кущ', position: 0 });
    const lesson = await lessons.upsert({
      id: 'lesson_exodus-sub-1-sub-1',
      planId: 'exodus',
      moduleId: 'exodus-sub-1',
      objectiveId: 'exodus-sub-1-sub-1',
      title: 'Палаючий кущ',
      position: 0,
    });

    expect(await lessonSessions.getActiveForUser('user-1', lesson.id)).toBeNull();
    expect(await lessonSessions.getMostRecentActive('user-1')).toBeNull();

    const started = await lessonSessions.start({
      id: 'lsess-1',
      userId: 'user-1',
      lessonId: lesson.id,
      planId: 'exodus',
      moduleId: 'exodus-sub-1',
      contentRevision: lesson.updatedAt,
    });
    expect(started.status).toBe('in_progress');
    expect(started.checkpointBlockId).toBeNull();

    expect((await lessonSessions.getActiveForUser('user-1', lesson.id))?.id).toBe(started.id);
    expect((await lessonSessions.getMostRecentActive('user-1'))?.id).toBe(started.id);

    const checkpointed = await lessonSessions.updateCheckpoint(started.id, 'block-2');
    expect(checkpointed.checkpointBlockId).toBe('block-2');

    expect(await lessonSessions.countCompletedSince('user-1', new Date(0).toISOString())).toBe(0);
    expect(await lessonSessions.getMostRecentCompleted('user-1')).toBeNull();
    const completed = await lessonSessions.complete(started.id);
    expect(completed.status).toBe('completed');
    expect(completed.completedAt).not.toBeNull();
    expect(await lessonSessions.countCompletedSince('user-1', new Date(0).toISOString())).toBe(1);
    expect(await lessonSessions.getActiveForUser('user-1', lesson.id)).toBeNull();
    expect((await lessonSessions.getMostRecentCompleted('user-1'))?.id).toBe(started.id);
  });

  it('creates and advances a practice session to completion (§12.1)', async () => {
    const { plans, modules, objectives, practiceSessions } = await setup();
    await plans.upsert({ id: 'psalms', themeId: 'psalms', title: 'Псалми' });
    await modules.upsert({ id: 'psalms-sub-1', planId: 'psalms', title: 'Хвала', position: 0 });
    await objectives.upsert({ id: 'psalms-sub-1-sub-1', planId: 'psalms', title: 'Псалом 23', position: 0 });

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const session = await practiceSessions.create({
      id: 'psess-1',
      userId: 'user-1',
      mode: 'practice',
      objectiveId: 'psalms-sub-1-sub-1',
      questionRevisionIds: ['rev-1', 'rev-2'],
      expiresAt,
    });
    expect(session.currentIndex).toBe(0);
    expect(session.status).toBe('active');

    const afterFirst = await practiceSessions.advance(session.id);
    expect(afterFirst.currentIndex).toBe(1);
    expect(afterFirst.status).toBe('active');

    const afterSecond = await practiceSessions.advance(session.id);
    expect(afterSecond.currentIndex).toBe(2);
    expect(afterSecond.status).toBe('completed');

    expect((await practiceSessions.getById(session.id))?.status).toBe('completed');
  });

  it('searches published plans and objectives, gated by status/testament/limit (§10.2/§10.3)', async () => {
    const { plans, objectives } = await setup();
    await plans.upsert({
      id: 'genesis',
      themeId: 'genesis',
      title: 'Буття',
      description: 'Початок творіння',
      status: 'published',
      testament: 'old_testament',
    });
    await plans.upsert({
      id: 'matthew',
      themeId: 'matthew',
      title: 'Матвія',
      description: 'Євангеліє від Матвія',
      status: 'published',
      testament: 'new_testament',
    });
    await plans.upsert({
      id: 'unreviewed-genesis-like',
      themeId: 'unreviewed',
      title: 'Буття (чернетка)',
      status: 'legacy_unreviewed',
    });
    await objectives.upsert({
      id: 'genesis-creation',
      planId: 'genesis',
      title: 'Створення світу',
      topicPath: 'Буття › Створення',
      status: 'published',
      testament: 'old_testament',
    });

    const byTitle = await plans.searchPublished({ q: 'Буття', limit: 10 });
    expect(byTitle.map((p) => p.id)).toEqual(['genesis']);

    const byDescription = await plans.searchPublished({ q: 'Євангеліє', limit: 10 });
    expect(byDescription.map((p) => p.id)).toEqual(['matthew']);

    const testamentFiltered = await plans.searchPublished({ q: 'Буття', testament: 'new_testament', limit: 10 });
    expect(testamentFiltered).toEqual([]);

    const objectiveMatches = await objectives.searchPublished({ q: 'Створення', limit: 10 });
    expect(objectiveMatches.map((o) => o.id)).toEqual(['genesis-creation']);

    const limited = await plans.searchPublished({ q: '', limit: 1 });
    expect(limited.length).toBeLessThanOrEqual(1);
  });
}
