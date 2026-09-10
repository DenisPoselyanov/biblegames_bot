/**
 * SQL progression repositories (Phase 2 §10, ADR-016) — the production adapter
 * for `server/domains/progression/repository.ts`, on Drizzle.
 *
 * The opaque `Transaction` from `ServiceContext` is narrowed to the Drizzle
 * executor here and nowhere else (`asExecutor`). `state.get({ forUpdate: true })`
 * issues `SELECT … FOR UPDATE`; the reward hot path calls it inside a
 * `db.transaction` so concurrent writers for one user serialise on the row lock.
 */
import { and, desc, eq, sql } from 'drizzle-orm';
import type { Transaction as OpaqueTx } from '../../../domains/shared/context';
import type {
  AchievementRepository,
  AnswerHistoryRepository,
  ProgressionRepositories,
  ProgressionStateRepository,
  ThemeStatsRepository,
} from '../../../domains/progression/repository';
import type {
  AchievementGrantRecord,
  AnswerHistoryEntry,
  GrantAchievementInput,
  ProgressionStatePatch,
  ProgressionStateRecord,
  RecordThemePlayInput,
  ThemeStatRecord,
} from '../../../domains/progression/types';
import type { Database, Transaction } from '../client';
import {
  achievementGrants,
  playerThemeStats,
  progressionState,
  studyAnswers,
} from '../schema/progression';

type Executor = Database | Transaction;

/** Single point where the opaque handle becomes a concrete Drizzle executor. */
function asExecutor(db: Database, tx?: OpaqueTx): Executor {
  return (tx as unknown as Transaction | undefined) ?? db;
}

const toStateRecord = (r: typeof progressionState.$inferSelect): ProgressionStateRecord => ({
  userId: r.userId,
  schemaVersion: r.schemaVersion,
  rankTier: r.rankTier,
  rankPlaque: r.rankPlaque,
  wisdomPoints: r.wisdomPoints,
  rankUnlockedTier: r.rankUnlockedTier,
  streakDays: r.streakDays,
  lastActiveAt: r.lastActiveAt,
  millionaireWins: r.millionaireWins,
  millionaireMaxLevel: r.millionaireMaxLevel,
  survivalHighScore: r.survivalHighScore,
  completedLevels: r.completedLevels,
  themePoints: r.themePoints,
  practiceTracks: r.practiceTracks,
  studyMastery: r.studyMastery,
  revision: r.revision,
  updatedAt: r.updatedAt,
});

const toGrantRecord = (
  r: typeof achievementGrants.$inferSelect,
): AchievementGrantRecord => ({
  userId: r.userId,
  achievementId: r.achievementId,
  sourceType: r.sourceType as AchievementGrantRecord['sourceType'],
  sourceId: r.sourceId,
  grantedAt: r.grantedAt,
  metadata: r.metadata,
});

const toThemeStatRecord = (
  r: typeof playerThemeStats.$inferSelect,
): ThemeStatRecord => ({
  userId: r.userId,
  themeId: r.themeId,
  totalPoints: r.totalPoints,
  gamesPlayed: r.gamesPlayed,
  firstPlayedAt: r.firstPlayedAt,
  updatedAt: r.updatedAt,
});

function patchToColumns(patch: ProgressionStatePatch): Record<string, unknown> {
  return {
    rankTier: patch.rankTier,
    rankPlaque: patch.rankPlaque,
    wisdomPoints: patch.wisdomPoints,
    rankUnlockedTier: patch.rankUnlockedTier,
    streakDays: patch.streakDays,
    lastActiveAt: patch.lastActiveAt,
    millionaireWins: patch.millionaireWins,
    millionaireMaxLevel: patch.millionaireMaxLevel,
    survivalHighScore: patch.survivalHighScore,
    completedLevels: patch.completedLevels,
    themePoints: patch.themePoints,
    practiceTracks: patch.practiceTracks,
    studyMastery: patch.studyMastery,
  };
}

export function createSqlProgressionRepositories(db: Database): ProgressionRepositories {
  const state: ProgressionStateRepository = {
    async get(userId, tx, opts) {
      const q = asExecutor(db, tx)
        .select()
        .from(progressionState)
        .where(eq(progressionState.userId, userId))
        .limit(1);
      const [row] = await (opts?.forUpdate ? q.for('update') : q);
      return row ? toStateRecord(row) : null;
    },

    async ensureRow(userId, tx) {
      await asExecutor(db, tx)
        .insert(progressionState)
        .values({ userId })
        .onConflictDoNothing({ target: progressionState.userId });
    },

    async upsert(userId, patch: ProgressionStatePatch, tx) {
      const columns = patchToColumns(patch);
      const [row] = await asExecutor(db, tx)
        .insert(progressionState)
        .values({ userId, ...columns })
        .onConflictDoUpdate({
          target: progressionState.userId,
          set: {
            ...columns,
            revision: sql`${progressionState.revision} + 1`,
            updatedAt: sql`now()`,
          },
        })
        .returning();
      return toStateRecord(row);
    },
  };

  const achievements: AchievementRepository = {
    async list(userId, tx) {
      const rows = await asExecutor(db, tx)
        .select()
        .from(achievementGrants)
        .where(eq(achievementGrants.userId, userId))
        .orderBy(desc(achievementGrants.grantedAt));
      return rows.map(toGrantRecord);
    },

    async grant(input: GrantAchievementInput, tx) {
      const exec = asExecutor(db, tx);
      const [inserted] = await exec
        .insert(achievementGrants)
        .values({
          userId: input.userId,
          achievementId: input.achievementId,
          sourceType: input.sourceType,
          sourceId: input.sourceId ?? null,
          metadata: input.metadata ?? {},
        })
        .onConflictDoNothing({
          target: [achievementGrants.userId, achievementGrants.achievementId],
        })
        .returning();
      if (inserted) return toGrantRecord(inserted);

      const [existing] = await exec
        .select()
        .from(achievementGrants)
        .where(
          and(
            eq(achievementGrants.userId, input.userId),
            eq(achievementGrants.achievementId, input.achievementId),
          ),
        )
        .limit(1);
      return toGrantRecord(existing);
    },
  };

  const themeStats: ThemeStatsRepository = {
    async listForUser(userId, tx) {
      const rows = await asExecutor(db, tx)
        .select()
        .from(playerThemeStats)
        .where(eq(playerThemeStats.userId, userId));
      return rows.map(toThemeStatRecord);
    },

    async recordPlay(input: RecordThemePlayInput, tx) {
      await asExecutor(db, tx)
        .insert(playerThemeStats)
        .values({
          userId: input.userId,
          themeId: input.themeId,
          totalPoints: input.points,
          gamesPlayed: 1,
        })
        .onConflictDoUpdate({
          target: [playerThemeStats.userId, playerThemeStats.themeId],
          set: {
            totalPoints: sql`${playerThemeStats.totalPoints} + ${input.points}`,
            gamesPlayed: sql`${playerThemeStats.gamesPlayed} + 1`,
            updatedAt: sql`now()`,
          },
        });
    },
  };

  const answers: AnswerHistoryRepository = {
    async list(userId, limit, tx) {
      // Most-recent `limit`, returned oldest-first (matches the legacy blob order).
      const rows = await asExecutor(db, tx)
        .select({ payload: studyAnswers.payload })
        .from(studyAnswers)
        .where(eq(studyAnswers.userId, userId))
        .orderBy(desc(studyAnswers.answeredAt))
        .limit(Math.max(0, limit));
      return rows.map((r) => r.payload).reverse();
    },

    async append(entry: AnswerHistoryEntry, tx) {
      await asExecutor(db, tx)
        .insert(studyAnswers)
        .values({
          userId: entry.userId,
          questionId: entry.questionId,
          subthemeId: entry.subthemeId,
          isCorrect: entry.isCorrect,
          answeredAt: entry.answeredAt,
          idempotencyKey: entry.idempotencyKey,
          payload: entry.payload,
        })
        // `uq_study_answers_idem` is a partial index — the conflict target must
        // carry the same predicate for Postgres to infer it.
        .onConflictDoNothing({
          target: [studyAnswers.userId, studyAnswers.idempotencyKey],
          where: sql`${studyAnswers.idempotencyKey} is not null`,
        });
    },
  };

  return { state, achievements, themeStats, answers };
}
