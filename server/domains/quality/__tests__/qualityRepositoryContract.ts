/**
 * Shared quality-repository contract (Phase 4 WS9). Run against the SQL
 * adapter (pglite) and the in-memory peer.
 */
import { expect, it } from 'vitest';
import type { QualityRepositories } from '../repository';
import type { NewContentReport } from '../types';

export interface QualityContractHarness {
  repos: QualityRepositories;
  /** Record one answer in whatever the adapter reads correctness from. */
  seedAnswer: (questionId: string, isCorrect: boolean) => Promise<void>;
  reset: () => Promise<void>;
}

const report = (over: Partial<NewContentReport> = {}): NewContentReport => ({
  entityType: 'question',
  entityId: 'q1',
  revisionId: 'qrev_1',
  reporterUserId: 'u1',
  category: 'wrong_answer',
  comment: 'Варіант Б теж правильний',
  ...over,
});

export function runQualityRepositoryContract(makeHarness: () => Promise<QualityContractHarness>): void {
  let h: QualityContractHarness;
  const setup = async (): Promise<QualityContractHarness> => {
    h = await makeHarness();
    await h.reset();
    return h;
  };

  it('create is idempotent per (reporter, entity, category) while open', async () => {
    const { repos } = await setup();
    const first = await repos.reports.create(report());
    expect(first.kind).toBe('created');
    expect(first.report).toMatchObject({ status: 'open', entityId: 'q1', category: 'wrong_answer' });

    const again = await repos.reports.create(report({ comment: 'ще раз' }));
    expect(again).toMatchObject({ kind: 'duplicate', report: { id: first.report.id } });

    // Another category, or another player, is a separate report.
    expect((await repos.reports.create(report({ category: 'wording' }))).kind).toBe('created');
    expect((await repos.reports.create(report({ reporterUserId: 'u2' }))).kind).toBe('created');
    expect(await repos.reports.countOpen()).toBe(3);
  });

  it('listGroups folds reports per entity, open first, without reporter ids', async () => {
    const { repos } = await setup();
    await repos.reports.create(report());
    await repos.reports.create(report({ reporterUserId: 'u2', revisionId: 'qrev_2' }));
    await repos.reports.create(report({ reporterUserId: 'u3', category: 'reference' }));
    await repos.reports.create(report({ entityId: 'q2', reporterUserId: 'u1' }));
    await repos.reports.create(report({ entityType: 'lesson', entityId: 'l1', revisionId: null }));

    const groups = await repos.reports.listGroups();
    expect(groups).toHaveLength(3);
    const q1 = groups.find((g) => g.entityId === 'q1')!;
    expect(q1).toMatchObject({ openCount: 3, totalCount: 3, categories: { wrong_answer: 2, reference: 1 } });
    expect(groups[0].entityId).toBe('q1');
    expect(JSON.stringify(groups)).not.toContain('u2');
    expect(groups.find((g) => g.entityId === 'l1')?.latestRevisionId).toBeNull();
  });

  it('resolveEntity closes every open report on the entity and links the fixing revision', async () => {
    const { repos } = await setup();
    await repos.reports.create(report());
    await repos.reports.create(report({ reporterUserId: 'u2' }));
    await repos.reports.create(report({ entityId: 'q2' }));

    const closed = await repos.reports.resolveEntity({
      entityType: 'question',
      entityId: 'q1',
      status: 'resolved',
      note: 'Виправлено варіант Б',
      resolvedRevisionId: 'qrev_9',
      resolvedBy: 'reviewer-1',
    });
    expect(closed).toBe(2);
    expect(await repos.reports.countOpen()).toBe(1);

    const q1 = await repos.reports.listForEntity('question', 'q1');
    expect(q1.every((r) => r.status === 'resolved' && r.resolvedRevisionId === 'qrev_9' && r.resolvedAt)).toBe(true);

    expect((await repos.reports.listGroups()).map((g) => g.entityId)).toEqual(['q2']);
    const all = await repos.reports.listGroups({ includeClosed: true });
    expect(all.map((g) => g.entityId)).toEqual(['q2', 'q1']);
    expect(all[1]).toMatchObject({ openCount: 0, totalCount: 2, categories: {} });

    // Once closed, the same player may report again.
    expect((await repos.reports.create(report())).kind).toBe('created');
  });

  it('listByReporter returns only that player’s reports, newest first', async () => {
    const { repos } = await setup();
    await repos.reports.create(report());
    await repos.reports.create(report({ entityId: 'q2' }));
    await repos.reports.create(report({ reporterUserId: 'u2' }));
    const mine = await repos.reports.listByReporter('u1');
    expect(mine).toHaveLength(2);
    expect(mine.every((r) => r.reporterUserId === 'u1')).toBe(true);
    expect(await repos.reports.listByReporter('u1', 1)).toHaveLength(1);
  });

  it('accuracy aggregates recorded answers per question above a threshold', async () => {
    const { repos, seedAnswer } = await setup();
    for (const ok of [true, true, false]) await seedAnswer('qa', ok);
    await seedAnswer('qb', false);
    expect(await repos.signals.accuracy({ minAttempts: 2 })).toEqual([{ questionId: 'qa', attempts: 3, correct: 2 }]);
    expect(await repos.signals.accuracy({ minAttempts: 1 })).toEqual([
      { questionId: 'qa', attempts: 3, correct: 2 },
      { questionId: 'qb', attempts: 1, correct: 0 },
    ]);
  });

  it('recordPick counts picks per revision option; picks() filters by question', async () => {
    const { repos } = await setup();
    const pick = (revisionId: string, questionId: string, optionIndex: number) =>
      repos.signals.recordPick({ revisionId, questionId, optionIndex, optionCount: 4 });
    await pick('r1', 'qa', 0);
    await pick('r1', 'qa', 0);
    await pick('r1', 'qa', 2);
    await pick('r2', 'qb', 1);

    expect(await repos.signals.picks({ questionIds: ['qa'] })).toEqual([
      { revisionId: 'r1', questionId: 'qa', optionIndex: 0, optionCount: 4, picks: 2 },
      { revisionId: 'r1', questionId: 'qa', optionIndex: 2, optionCount: 4, picks: 1 },
    ]);
    expect(await repos.signals.picks()).toHaveLength(3);
    expect(await repos.signals.picks({ questionIds: [] })).toEqual([]);
  });
}
