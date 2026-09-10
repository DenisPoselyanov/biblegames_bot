/**
 * In-memory progression repositories (Phase 2 §10 parity peer).
 *
 * For dev fixtures and as the contract-test peer to the SQL adapter. Writes
 * inside a `tx` are rejected — the in-memory store does not emulate transactions
 * (§10), and the reward hot path is SQL-only (ADR-006). `forUpdate` is a no-op.
 */
import type { Transaction } from '../shared/context';
import type {
  AchievementRepository,
  ProgressionRepositories,
  ProgressionStateRepository,
  ThemeStatsRepository,
} from './repository';
import type {
  AchievementGrantRecord,
  GrantAchievementInput,
  ProgressionStatePatch,
  ProgressionStateRecord,
  RecordThemePlayInput,
  ThemeStatRecord,
} from './types';

function rejectTx(tx?: Transaction): void {
  if (tx) {
    throw new Error('in-memory progression repository does not support transactional writes (§10)');
  }
}

function emptyState(userId: string, ts: string): ProgressionStateRecord {
  return {
    userId,
    schemaVersion: 1,
    rankTier: 'baby',
    rankPlaque: 7,
    wisdomPoints: 0,
    rankUnlockedTier: 'child',
    streakDays: 0,
    lastActiveAt: null,
    millionaireWins: 0,
    millionaireMaxLevel: 0,
    survivalHighScore: 0,
    completedLevels: [],
    themePoints: {},
    practiceTracks: [],
    studyMastery: {},
    revision: 0,
    updatedAt: ts,
  };
}

export function createInMemoryProgressionRepositories(
  now: () => Date = () => new Date(),
): ProgressionRepositories {
  const states = new Map<string, ProgressionStateRecord>();
  const grants = new Map<string, AchievementGrantRecord>(); // `${userId}\0${achievementId}`
  const themeStats = new Map<string, ThemeStatRecord>(); // `${userId}\0${themeId}`
  const iso = (): string => now().toISOString();

  const state: ProgressionStateRepository = {
    async get(userId, tx) {
      rejectTx(tx);
      const row = states.get(userId);
      return row ? structuredClone(row) : null;
    },
    async ensureRow(userId, tx) {
      rejectTx(tx);
      if (!states.has(userId)) states.set(userId, emptyState(userId, iso()));
    },
    async upsert(userId, patch: ProgressionStatePatch, tx) {
      rejectTx(tx);
      const ts = iso();
      const existing = states.get(userId);
      const base = existing ?? emptyState(userId, ts);
      const next: ProgressionStateRecord = {
        ...base,
        ...structuredClone(patch),
        userId,
        schemaVersion: base.schemaVersion,
        revision: existing ? base.revision + 1 : 0,
        updatedAt: ts,
      };
      states.set(userId, next);
      return structuredClone(next);
    },
  };

  const achievements: AchievementRepository = {
    async list(userId, tx) {
      rejectTx(tx);
      return [...grants.values()]
        .filter((g) => g.userId === userId)
        .sort((a, b) => b.grantedAt.localeCompare(a.grantedAt))
        .map((g) => ({ ...g }));
    },
    async grant(input: GrantAchievementInput, tx) {
      rejectTx(tx);
      const key = `${input.userId}\0${input.achievementId}`;
      const existing = grants.get(key);
      if (existing) return { ...existing };
      const row: AchievementGrantRecord = {
        userId: input.userId,
        achievementId: input.achievementId,
        sourceType: input.sourceType,
        sourceId: input.sourceId ?? null,
        grantedAt: iso(),
        metadata: input.metadata ?? {},
      };
      grants.set(key, row);
      return { ...row };
    },
  };

  const themeStatsRepo: ThemeStatsRepository = {
    async listForUser(userId, tx) {
      rejectTx(tx);
      return [...themeStats.values()]
        .filter((s) => s.userId === userId)
        .map((s) => ({ ...s }));
    },
    async recordPlay(input: RecordThemePlayInput, tx) {
      rejectTx(tx);
      const key = `${input.userId}\0${input.themeId}`;
      const ts = iso();
      const existing = themeStats.get(key);
      const row: ThemeStatRecord = existing
        ? {
            ...existing,
            totalPoints: existing.totalPoints + input.points,
            gamesPlayed: existing.gamesPlayed + 1,
            updatedAt: ts,
          }
        : {
            userId: input.userId,
            themeId: input.themeId,
            totalPoints: input.points,
            gamesPlayed: 1,
            firstPlayedAt: ts,
            updatedAt: ts,
          };
      themeStats.set(key, row);
    },
  };

  return { state, achievements, themeStats: themeStatsRepo };
}
