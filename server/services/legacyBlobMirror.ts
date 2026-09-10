/**
 * Dual-write mirror for the progression decomposition (Phase 2 §18.2, ADR-016).
 *
 * While `LEGACY_PROGRESSION_READONLY` is unset, every authoritative write to the
 * typed `progression_state` / `player_theme_stats` tables is also mirrored into
 * the legacy `player_profiles` / `player_stats` blobs, on the *same*
 * transaction, so a rollback to the blob read path loses nothing. Once the flag
 * is set this mirror is skipped and the blobs freeze.
 *
 * Only the progression-owned fields are touched; `reviewSchedules`,
 * `displayName`, and the typed-preference mirror (`activeTheme` / `avatar` /
 * `bibleTranslation`) are left exactly as found.
 */
import { sql } from 'drizzle-orm';
import type { Transaction as OpaqueTx } from '../domains/shared/context';
import type { Transaction as DrizzleTx } from '../infrastructure/database/client';
import type { ProgressionSnapshot } from '../progression/completionOutcome';
import { recordThemePlay } from '../progression/globalStats';

const asTx = (tx: OpaqueTx): DrizzleTx => tx as unknown as DrizzleTx;

/** The progression subset of the `player_profiles` blob, from a `next` snapshot. */
function progressionFields(
  snapshot: ProgressionSnapshot,
  coins: number,
): Record<string, unknown> {
  return {
    coins,
    playerRank: {
      tier: snapshot.rankTier,
      plaque: snapshot.rankPlaque,
      wisdomPoints: snapshot.wisdom,
      unlockedTier: snapshot.rankUnlockedTier,
    },
    streakDays: snapshot.streakDays,
    lastActiveAt: snapshot.lastActiveAt,
    completedLevels: snapshot.completedLevels,
    millionaireWins: snapshot.millionaireWins,
    millionaireMaxLevel: snapshot.millionaireMaxLevel,
    survivalHighScore: snapshot.survivalHighScore,
    achievements: snapshot.achievements,
    themePoints: snapshot.themePoints,
    practiceTracks: snapshot.practiceTracks,
    studyMastery: snapshot.studyMastery,
  };
}

export interface LegacyBlobMirror {
  /** Merge the progression fields of `snapshot` into the `player_profiles` blob. */
  writeProfile(
    userId: string,
    snapshot: ProgressionSnapshot,
    coins: number,
    tx: OpaqueTx,
  ): Promise<void>;
  /** Apply one theme play to the `player_stats` (`GlobalStats`) blob. */
  recordThemePlay(
    userId: string,
    themeId: string,
    points: number,
    isNewForUser: boolean,
    tx: OpaqueTx,
  ): Promise<void>;
  /** Overwrite `studyMastery` + `achievements` in the blob (the `/answers` path). */
  writeAnswerState(
    userId: string,
    studyMastery: Record<string, unknown>,
    achievements: string[],
    tx: OpaqueTx,
  ): Promise<void>;
}

async function readBlob(
  tx: DrizzleTx,
  table: 'player_profiles' | 'player_stats',
  userId: string,
): Promise<Record<string, unknown> | null> {
  const result = await tx.execute(
    sql`select payload from ${sql.raw(table)} where user_id = ${userId} limit 1`,
  );
  const rows = (result as unknown as { rows: Array<{ payload: Record<string, unknown> }> }).rows;
  return rows[0]?.payload ?? null;
}

async function upsertBlob(
  tx: DrizzleTx,
  table: 'player_profiles' | 'player_stats',
  userId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await tx.execute(
    sql`insert into ${sql.raw(table)} (user_id, payload, updated_at)
        values (${userId}, ${JSON.stringify(payload)}::jsonb, now())
        on conflict (user_id) do update set payload = excluded.payload, updated_at = now()`,
  );
}

export function createLegacyBlobMirror(): LegacyBlobMirror {
  return {
    async writeProfile(userId, snapshot, coins, tx) {
      const dtx = asTx(tx);
      const existing = (await readBlob(dtx, 'player_profiles', userId)) ?? { userId };
      const next = {
        ...existing,
        ...progressionFields(snapshot, coins),
        userId,
        updatedAt: new Date().toISOString(),
      };
      await upsertBlob(dtx, 'player_profiles', userId, next);
    },

    async recordThemePlay(userId, themeId, points, isNewForUser, tx) {
      const dtx = asTx(tx);
      const stats = await readBlob(dtx, 'player_stats', userId);
      const next = recordThemePlay(stats, themeId, points, isNewForUser);
      await upsertBlob(dtx, 'player_stats', userId, next as unknown as Record<string, unknown>);
    },

    async writeAnswerState(userId, studyMastery, achievements, tx) {
      const dtx = asTx(tx);
      const existing = (await readBlob(dtx, 'player_profiles', userId)) ?? { userId };
      const next = {
        ...existing,
        studyMastery,
        achievements,
        userId,
        updatedAt: new Date().toISOString(),
      };
      await upsertBlob(dtx, 'player_profiles', userId, next);
    },
  };
}
