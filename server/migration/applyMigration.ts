/**
 * One-time bounded legacy migration (Phase 1 §9).
 *
 * Legacy profile values were client-controlled, so this trusts preferences
 * after validation, imports progression with bounds and provenance, caps coins
 * at `config.migrationMaxCoins`, and opens the wallet with a single
 * `migration_opening` ledger entry keyed on the user id (idempotent).
 */

import type { ServerConfig } from '../config/env';
import type { ServerStore } from '../db/store';
import type { WalletLedger } from '../wallet';
import { emptyProfile, sanitizePreferences } from '../services/profileService';
import {
  MIGRATION_VERSION,
  type MigrationRecord,
  type MigrationStore,
} from './migrationStore';

export interface MigrationRequest {
  sourceVersion?: number;
  profile?: Record<string, unknown>;
  hash?: string;
}

export interface MigrationDeps {
  dbStore: ServerStore;
  walletLedger: WalletLedger;
  migrationStore: MigrationStore;
  config: ServerConfig;
}

function clampInt(value: unknown, min: number, max: number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(n, min), max);
}

export async function applyMigration(
  userId: string,
  request: MigrationRequest,
  { dbStore, walletLedger, migrationStore, config }: MigrationDeps,
): Promise<{ record: MigrationRecord; replayed: boolean }> {
  const existing = await migrationStore.get(userId);
  if (existing) return { record: existing, replayed: true };

  const legacy = (request.profile && typeof request.profile === 'object'
    ? request.profile
    : {}) as Record<string, unknown>;
  const stored = (await dbStore.getProfile(userId)) ?? emptyProfile(userId);

  const rawCoins = Math.max(
    0,
    Math.floor(Number(legacy.coins ?? 0)) + Math.floor(Number(legacy.totalPoints ?? 0)),
  );
  const acceptedCoins = Math.min(rawCoins, config.migrationMaxCoins);
  const coinsCapped = rawCoins > config.migrationMaxCoins;

  const prefs = sanitizePreferences(legacy, stored);

  const accepted: Record<string, unknown> = {
    coins: acceptedCoins,
    preferences: prefs,
    millionaireWins: clampInt(legacy.millionaireWins, 0, 100000),
    millionaireMaxLevel: clampInt(legacy.millionaireMaxLevel, 0, 20),
    survivalHighScore: clampInt(legacy.survivalHighScore, 0, 1_000_000),
    streakDays: clampInt(legacy.streakDays, 0, 100000),
    completedLevels: Array.isArray(legacy.completedLevels)
      ? (legacy.completedLevels as unknown[]).slice(0, 2000)
      : [],
  };
  const rejected: Record<string, unknown> = {};
  if (coinsCapped) rejected.coins = { submitted: rawCoins, capTo: config.migrationMaxCoins };

  let walletOpeningEntryId: string | null = null;
  if (acceptedCoins > 0) {
    const { entry } = await walletLedger.post({
      userId,
      type: 'migration_opening',
      amount: acceptedCoins,
      sourceType: 'legacy.migration',
      sourceId: userId,
      metadata: { sourceVersion: request.sourceVersion ?? 0, capped: coinsCapped },
    });
    walletOpeningEntryId = entry.id;
  }

  await dbStore.setProfile(userId, {
    ...stored,
    ...prefs,
    userId,
    coins: acceptedCoins,
    millionaireWins: accepted.millionaireWins,
    millionaireMaxLevel: accepted.millionaireMaxLevel,
    survivalHighScore: accepted.survivalHighScore,
    streakDays: accepted.streakDays,
    completedLevels: accepted.completedLevels,
    migratedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const record = await migrationStore.put({
    userId,
    sourceVersion: clampInt(request.sourceVersion, 0, 1000),
    migrationVersion: MIGRATION_VERSION,
    submittedHash: String(request.hash ?? '').slice(0, 128),
    accepted,
    rejected,
    walletOpeningEntryId,
    status: coinsCapped ? 'applied_with_caps' : 'applied',
    createdAt: new Date().toISOString(),
  });

  return { record, replayed: false };
}
