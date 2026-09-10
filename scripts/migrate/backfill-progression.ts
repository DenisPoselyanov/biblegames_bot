/**
 * Backfill the typed progression + entitlement tables from the legacy
 * `player_profiles` / `player_stats` blobs (Phase 2 §18.2 steps 3–7, ADR-016).
 *
 * Idempotent: a row whose derived `ProgressionSnapshot` hash matches its
 * `progression_backfill_records` entry is skipped. Read-only in `--dry`.
 * `--verify-only` runs just the count/sum checks. Coins are NOT touched —
 * `wallet_ledger` has been authoritative since Phase 1; the blob `coins` is
 * already stale.
 *
 * After a clean run + verification window, set `LEGACY_PROGRESSION_READONLY=true`
 * so the reward hot path stops mirroring the blob.
 *
 * Usage:  DATABASE_URL=postgres://… npx tsx scripts/migrate/backfill-progression.ts [--dry] [--verify-only]
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { getPool, isDatabaseConfigured } from '../../server/db/pgPool';
import { createDatabase } from '../../server/infrastructure/database/client';
import { createSqlProgressionRepositories } from '../../server/infrastructure/database/repositories/progression';
import { createSqlEconomyRepositories } from '../../server/infrastructure/database/repositories/economy';
import { snapshotFromProfile } from '../../server/progression/completionOutcome';
import { snapshotToState } from '../../server/domains/progression/mapSnapshot';
import { playerThemeStats } from '../../server/infrastructure/database/schema/progression';
import { progressionBackfillRecords } from '../../server/infrastructure/database/schema/platform';
import { getCosmeticThemeById, getAvatarById } from '../../src/data/cosmetics';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

function loadRootEnv(): void {
  const envPath = join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let value = t.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = value;
  }
}

/** Stable JSON hash — key order does not matter. */
function stableHash(value: unknown): string {
  const canon = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(canon);
    if (v && typeof v === 'object') {
      return Object.fromEntries(
        Object.keys(v as Record<string, unknown>)
          .sort()
          .map((k) => [k, canon((v as Record<string, unknown>)[k])]),
      );
    }
    return v;
  };
  return createHash('sha256').update(JSON.stringify(canon(value))).digest('hex');
}

const knownProduct = (id: string): 'theme' | 'avatar' | null => {
  if (getCosmeticThemeById(id)) return 'theme';
  if (getAvatarById(id)) return 'avatar';
  return null;
};

interface Report {
  dry: boolean;
  verifyOnly: boolean;
  scanned: number;
  stateWritten: number;
  unchanged: number;
  achievementsGranted: number;
  entitlementsGranted: number;
  themeStatRows: number;
  noUserRow: number;
  unknownCatalogIds: string[];
  countsMatch: boolean;
  sumsMatch: boolean;
  sampleSkips: string[];
}

async function verify(pool: Awaited<ReturnType<typeof getPool>>): Promise<{
  countsMatch: boolean;
  sumsMatch: boolean;
  detail: Record<string, unknown>;
}> {
  const one = async (text: string) => Number((await pool.query(text)).rows[0]?.n ?? 0);

  const profilesWithUser = await one(
    `select count(*)::int as n from player_profiles p where exists (select 1 from users u where u.id = p.user_id)`,
  );
  const stateRows = await one(`select count(*)::int as n from progression_state`);

  const blobAchievements = await one(
    `select coalesce(sum(jsonb_array_length(coalesce(payload->'achievements', '[]'::jsonb))), 0)::int as n
     from player_profiles p where exists (select 1 from users u where u.id = p.user_id)`,
  );
  const grantRows = await one(`select count(*)::int as n from achievement_grants`);

  const blobWisdom = await one(
    `select coalesce(sum((payload->'playerRank'->>'wisdomPoints')::int), 0)::int as n
     from player_profiles p where exists (select 1 from users u where u.id = p.user_id)`,
  );
  const stateWisdom = await one(`select coalesce(sum(wisdom_points), 0)::int as n from progression_state`);

  const blobSurvival = await one(
    `select coalesce(sum((payload->>'survivalHighScore')::int), 0)::int as n
     from player_profiles p where exists (select 1 from users u where u.id = p.user_id)`,
  );
  const stateSurvival = await one(
    `select coalesce(sum(survival_high_score), 0)::int as n from progression_state`,
  );

  const countsMatch = profilesWithUser === stateRows && blobAchievements === grantRows;
  const sumsMatch = blobWisdom === stateWisdom && blobSurvival === stateSurvival;
  return {
    countsMatch,
    sumsMatch,
    detail: {
      profilesWithUser,
      stateRows,
      blobAchievements,
      grantRows,
      blobWisdom,
      stateWisdom,
      blobSurvival,
      stateSurvival,
    },
  };
}

async function main(): Promise<void> {
  loadRootEnv();
  const dry = process.argv.includes('--dry');
  const verifyOnly = process.argv.includes('--verify-only');

  if (!isDatabaseConfigured()) {
    console.error('DATABASE_URL is required.');
    process.exit(1);
  }

  const pool = await getPool();
  const db = createDatabase(pool);
  const progression = createSqlProgressionRepositories(db);
  const economy = createSqlEconomyRepositories(db);

  const report: Report = {
    dry,
    verifyOnly,
    scanned: 0,
    stateWritten: 0,
    unchanged: 0,
    achievementsGranted: 0,
    entitlementsGranted: 0,
    themeStatRows: 0,
    noUserRow: 0,
    unknownCatalogIds: [],
    countsMatch: false,
    sumsMatch: false,
    sampleSkips: [],
  };

  if (!verifyOnly) {
    const { rows } = await pool.query<{
      user_id: string;
      payload: Record<string, unknown>;
      updated_at: string | null;
    }>('select user_id, payload, updated_at from player_profiles');
    const { rows: statRows } = await pool.query<{ user_id: string; payload: Record<string, unknown> }>(
      'select user_id, payload from player_stats',
    );
    const statsByUser = new Map(statRows.map((r) => [r.user_id, r.payload]));
    const unknown = new Set<string>();

    for (const { user_id: userId, payload, updated_at: updatedAt } of rows) {
      report.scanned += 1;

      const userExists = await pool.query('select 1 from users where id = $1 limit 1', [userId]);
      if (userExists.rowCount === 0) {
        report.noUserRow += 1;
        if (report.sampleSkips.length < 20) report.sampleSkips.push(`${userId}: no users row — skipped`);
        continue;
      }

      const snapshot = snapshotFromProfile(payload);
      const hash = stableHash(snapshot);
      const prior = await pool.query(
        'select snapshot_hash from progression_backfill_records where user_id = $1 limit 1',
        [userId],
      );
      if (prior.rows[0]?.snapshot_hash === hash) {
        report.unchanged += 1;
        continue;
      }

      const achievements = Array.isArray(payload.achievements) ? (payload.achievements as string[]) : [];
      const unlocked = [
        ...(Array.isArray(payload.unlockedThemes) ? (payload.unlockedThemes as string[]) : []),
        ...(Array.isArray(payload.unlockedAvatars) ? (payload.unlockedAvatars as string[]) : []),
      ];
      const themeBuckets = (() => {
        const raw = statsByUser.get(userId);
        const themes = raw && typeof raw.themes === 'object' ? (raw.themes as Record<string, Record<string, unknown>>) : {};
        return Object.entries(themes);
      })();

      if (!dry) {
        await db.transaction(async (tx) => {
          const otx = tx as unknown as Parameters<typeof progression.state.upsert>[2];

          await progression.state.upsert(userId, snapshotToState(snapshot), otx);

          for (const achievementId of achievements) {
            await progression.achievements.grant(
              { userId, achievementId, sourceType: 'migration', sourceId: userId },
              otx,
            );
          }

          for (const productId of unlocked) {
            const kind = knownProduct(productId);
            if (!kind) {
              unknown.add(productId);
              continue;
            }
            await economy.entitlements.grant(
              {
                userId,
                productId,
                productKind: kind,
                sourceType: 'migration',
                sourceId: `migration:${userId}:${productId}`,
              },
              otx,
            );
          }

          for (const [themeId, bucket] of themeBuckets) {
            await tx
              .insert(playerThemeStats)
              .values({
                userId,
                themeId,
                totalPoints: Number(bucket.totalPoints) || 0,
                gamesPlayed: Number(bucket.gamesPlayed) || 0,
              })
              .onConflictDoUpdate({
                target: [playerThemeStats.userId, playerThemeStats.themeId],
                set: {
                  totalPoints: Number(bucket.totalPoints) || 0,
                  gamesPlayed: Number(bucket.gamesPlayed) || 0,
                  updatedAt: sql`now()`,
                },
              });
          }

          await tx
            .insert(progressionBackfillRecords)
            .values({
              userId,
              sourceProfileUpdatedAt: updatedAt,
              snapshotHash: hash,
              achievementsGranted: achievements.length,
              entitlementsGranted: unlocked.filter((id) => knownProduct(id)).length,
              themeStatRows: themeBuckets.length,
              status: prior.rows[0] ? 'reapplied' : 'applied',
            })
            .onConflictDoUpdate({
              target: progressionBackfillRecords.userId,
              set: {
                sourceProfileUpdatedAt: updatedAt,
                snapshotHash: hash,
                achievementsGranted: achievements.length,
                entitlementsGranted: unlocked.filter((id) => knownProduct(id)).length,
                themeStatRows: themeBuckets.length,
                status: 'reapplied',
                updatedAt: sql`now()`,
              },
            });
        });
      }

      report.stateWritten += 1;
      report.achievementsGranted += achievements.length;
      report.entitlementsGranted += unlocked.filter((id) => knownProduct(id)).length;
      report.themeStatRows += themeBuckets.length;
    }

    report.unknownCatalogIds = [...unknown];
  }

  const v = await verify(pool);
  report.countsMatch = v.countsMatch;
  report.sumsMatch = v.sumsMatch;

  console.log(JSON.stringify({ ...report, verifyDetail: v.detail }, null, 2));
  await pool.end();

  if (verifyOnly && (!v.countsMatch || !v.sumsMatch)) process.exit(2);
}

void main().catch((err) => {
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
});
