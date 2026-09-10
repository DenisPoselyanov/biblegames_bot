/**
 * Shared progression-repository contract (Phase 2 §10, ADR-016). Run against
 * every adapter (`server/infrastructure/database/repositories/progression.ts` on
 * pglite, and the in-memory peer). Read behaviour must match; the in-memory
 * adapter is exempt only from real transaction / row-lock support.
 */
import { expect, it } from 'vitest';
import type { ProgressionRepositories } from '../repository';
import type { ProgressionStatePatch } from '../types';

export interface ProgressionContractHarness {
  repos: ProgressionRepositories;
  /** Ensure a `users` row exists (the SQL adapter has an FK; the peer is a no-op). */
  ensureUser: (id: string) => Promise<void>;
  reset: () => Promise<void>;
}

const fullPatch = (over: Partial<ProgressionStatePatch> = {}): ProgressionStatePatch => ({
  rankTier: 'child',
  rankPlaque: 5,
  wisdomPoints: 12,
  rankUnlockedTier: 'youth',
  streakDays: 3,
  lastActiveAt: '2026-06-01T00:00:00.000Z',
  millionaireWins: 1,
  millionaireMaxLevel: 8,
  survivalHighScore: 42,
  completedLevels: [{ themeId: 'genesis', difficulty: 'baby', score: 5, maxScore: 5 }],
  themePoints: { genesis: 40 },
  practiceTracks: [{ themeId: 'genesis', nodeId: 'n1', highestUnlockedStage: 2, stageResults: [] }],
  studyMastery: { n1: { mastery: 0.8, attempts: 4 } },
  ...over,
});

export function runProgressionRepositoryContract(
  makeHarness: () => Promise<ProgressionContractHarness>,
): void {
  let h: ProgressionContractHarness;

  const setup = async (): Promise<ProgressionRepositories> => {
    h = await makeHarness();
    await h.reset();
    await h.ensureUser('u1');
    return h.repos;
  };

  it('state.get is null until a row exists; ensureRow creates a default row', async () => {
    const { state } = await setup();
    expect(await state.get('u1')).toBeNull();

    await state.ensureRow('u1');
    const row = await state.get('u1');
    expect(row).toMatchObject({
      userId: 'u1',
      schemaVersion: 1,
      rankTier: 'baby',
      rankPlaque: 7,
      wisdomPoints: 0,
      streakDays: 0,
      completedLevels: [],
      themePoints: {},
    });

    // ensureRow is idempotent — it does not clobber
    await state.ensureRow('u1');
    expect((await state.get('u1'))?.rankTier).toBe('baby');
  });

  it('upsert writes every scalar + bag and round-trips, bumping revision on update', async () => {
    const { state } = await setup();

    const created = await state.upsert('u1', fullPatch());
    expect(created).toMatchObject({
      rankTier: 'child',
      wisdomPoints: 12,
      survivalHighScore: 42,
      themePoints: { genesis: 40 },
    });
    expect(created.completedLevels).toHaveLength(1);
    expect(created.practiceTracks[0]).toMatchObject({ nodeId: 'n1', highestUnlockedStage: 2 });
    expect(created.studyMastery.n1).toMatchObject({ mastery: 0.8 });
    expect(created.revision).toBe(0);

    const updated = await state.upsert('u1', fullPatch({ wisdomPoints: 30, streakDays: 4 }));
    expect(updated.wisdomPoints).toBe(30);
    expect(updated.streakDays).toBe(4);
    expect(updated.revision).toBe(1);

    expect(await state.get('u1')).toEqual(updated);
  });

  it('achievements.grant is idempotent on (userId, achievementId) and keeps provenance', async () => {
    const { achievements } = await setup();

    const first = await achievements.grant({
      userId: 'u1',
      achievementId: 'flawless-level',
      sourceType: 'progression.completion',
      sourceId: 'level:run-1',
    });
    expect(first).toMatchObject({
      achievementId: 'flawless-level',
      sourceType: 'progression.completion',
      sourceId: 'level:run-1',
    });

    const replay = await achievements.grant({
      userId: 'u1',
      achievementId: 'flawless-level',
      sourceType: 'progression.answer',
      sourceId: 'other',
    });
    expect(replay.grantedAt).toBe(first.grantedAt);
    expect(replay.sourceType).toBe('progression.completion'); // unchanged

    await achievements.grant({
      userId: 'u1',
      achievementId: 'iron-shield',
      sourceType: 'progression.completion',
      sourceId: 'survival:run-2',
    });
    const list = await achievements.list('u1');
    expect(list.map((g) => g.achievementId).sort()).toEqual(['flawless-level', 'iron-shield']);
  });

  it('themeStats.recordPlay seeds a row then accumulates', async () => {
    const { themeStats } = await setup();

    await themeStats.recordPlay({ userId: 'u1', themeId: 'genesis', points: 10 });
    await themeStats.recordPlay({ userId: 'u1', themeId: 'genesis', points: 15 });
    await themeStats.recordPlay({ userId: 'u1', themeId: 'exodus', points: 5 });

    const stats = await themeStats.listForUser('u1');
    const genesis = stats.find((s) => s.themeId === 'genesis');
    expect(genesis).toMatchObject({ totalPoints: 25, gamesPlayed: 2 });
    expect(stats.find((s) => s.themeId === 'exodus')).toMatchObject({
      totalPoints: 5,
      gamesPlayed: 1,
    });
  });
}
