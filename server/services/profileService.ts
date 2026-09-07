/**
 * Shared profile read/write logic used by the legacy `/profile/:userId` routes
 * and the self-scoped `/api/v1/me/*` routes (Phase 1 §5.3, §7.1).
 *
 * WS3 splits writes into two modes:
 * - `preferences` — a small whitelist the client is still trusted to set;
 * - `full` — the legacy whole-profile write. When `authoritativeProfileV2` is
 *   on, the authoritative fields (coins, rank, streak, achievements, …) are
 *   stripped from the body before merge (DoD #6); when
 *   `disableLegacyProfileWrites` is on it is refused outright (§9.3).
 */

import type { ServerStore } from '../db/store';
import { migrateProfileWallet, type ProfileWithLegacyWallet } from '../../src/lib/storage';
import { isBollsTranslation } from '../../src/lib/bollsConstants';
import { AppError } from '../lib/errors';
import { isServerFeatureEnabled, serverFlag } from '../lib/flags';
import { recomputeStreak } from '../lib/streak';
import { sanitizeProfileBody } from '../middleware/validateBody';
import type { WalletLedger } from '../wallet';

/** The default profile returned when a user has no stored record yet. */
export function emptyProfile(userId: string): Record<string, unknown> {
  return {
    userId,
    displayName: '',
    themePoints: {},
    completedLevels: [],
    survivalHighScore: 0,
    millionaireWins: 0,
    millionaireMaxLevel: 0,
    unlockedThemes: [],
    activeTheme: '',
    achievements: [],
    avatar: '',
    coins: 0,
    unlockedAvatars: [],
    streakDays: 0,
    lastActiveAt: null,
    studyMastery: {},
    bibleTranslation: 'UTT',
    practiceTracks: [],
    playerRank: { tier: 'baby', plaque: 7, wisdomPoints: 0, unlockedTier: 'child' },
  };
}

/**
 * Fields the server owns once `authoritativeProfileV2` is on. The client may
 * still send them (old clients will) — they are dropped, not rejected.
 */
export const AUTHORITATIVE_PROFILE_FIELDS = [
  'coins',
  'totalPoints',
  'playerRank',
  'streakDays',
  'lastActiveAt',
  'achievements',
  'completedLevels',
  'studyMastery',
  'practiceTracks',
  'millionaireWins',
  'millionaireMaxLevel',
  'survivalHighScore',
  'unlockedThemes',
  'unlockedAvatars',
  'themePoints',
  'reviewSchedules',
] as const;

export interface ProfilePreferences {
  displayName?: string;
  bibleTranslation?: string;
  activeTheme?: string;
  avatar?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The preference whitelist (Phase 1 §7.1). `activeTheme` / `avatar` must be
 * something the user already owns per the stored profile.
 */
export function sanitizePreferences(
  body: unknown,
  stored: Record<string, unknown>,
): ProfilePreferences {
  if (!isRecord(body)) return {};
  const out: ProfilePreferences = {};

  if (typeof body.displayName === 'string') {
    const trimmed = body.displayName.trim().slice(0, 120);
    if (trimmed) out.displayName = trimmed;
  }
  if (typeof body.bibleTranslation === 'string' && isBollsTranslation(body.bibleTranslation)) {
    out.bibleTranslation = body.bibleTranslation;
  }
  const unlockedThemes = Array.isArray(stored.unlockedThemes) ? (stored.unlockedThemes as string[]) : [];
  if (typeof body.activeTheme === 'string' && unlockedThemes.includes(body.activeTheme)) {
    out.activeTheme = body.activeTheme;
  }
  const unlockedAvatars = Array.isArray(stored.unlockedAvatars)
    ? (stored.unlockedAvatars as string[])
    : [];
  if (body.avatar === '' || (typeof body.avatar === 'string' && unlockedAvatars.includes(body.avatar))) {
    out.avatar = body.avatar as string;
  }
  return out;
}

export async function readProfile(
  dbStore: ServerStore,
  userId: string,
  walletLedger?: WalletLedger,
): Promise<Record<string, unknown>> {
  const profile = await dbStore.getProfile(userId);
  const base = profile
    ? migrateProfileWallet(profile as ProfileWithLegacyWallet)
    : emptyProfile(userId);
  if (walletLedger && serverFlag('authoritativeProfileV2', false)) {
    return { ...base, coins: await walletLedger.getBalance(userId) };
  }
  return base;
}

export interface WriteProfileOptions {
  mode?: 'full' | 'preferences';
}

export async function writeProfile(
  dbStore: ServerStore,
  userId: string,
  body: unknown,
  opts: WriteProfileOptions = {},
): Promise<void> {
  const mode = opts.mode ?? 'full';
  const existing = (await dbStore.getProfile(userId)) ?? {};

  if (mode === 'preferences') {
    const prefs = sanitizePreferences(body, existing as Record<string, unknown>);
    await dbStore.setProfile(userId, {
      ...existing,
      ...prefs,
      userId,
      updatedAt: new Date().toISOString(),
    });
    return;
  }

  if (serverFlag('disableLegacyProfileWrites', false)) {
    throw new AppError(
      'legacy_profile_write_disabled',
      'Whole-profile writes are disabled; use /api/v1/me/preferences and progression commands',
      409,
    );
  }

  let incoming = sanitizeProfileBody(userId, body) as Record<string, unknown>;
  if (serverFlag('authoritativeProfileV2', false)) {
    incoming = Object.fromEntries(
      Object.entries(incoming).filter(
        ([key]) => !(AUTHORITATIVE_PROFILE_FIELDS as readonly string[]).includes(key),
      ),
    );
  }

  const streakOverride =
    isServerFeatureEnabled('server_streak') && !serverFlag('authoritativeProfileV2', false)
      ? recomputeStreak(
          (existing as { lastActiveAt?: unknown }).lastActiveAt,
          (existing as { streakDays?: unknown }).streakDays,
        )
      : {};

  const merged = migrateProfileWallet({
    ...existing,
    ...incoming,
    ...streakOverride,
    userId,
  } as ProfileWithLegacyWallet);
  await dbStore.setProfile(userId, { ...merged, updatedAt: new Date().toISOString() });
}
