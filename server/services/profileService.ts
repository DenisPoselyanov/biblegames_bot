/**
 * Shared profile read/write logic for the self-scoped `/api/v1/me/*` routes
 * (Phase 1 §5.3, §7.1).
 *
 * WS4 part 2 removed the legacy whole-profile `PUT`: the client can no longer
 * send `coins`, `playerRank`, `streakDays`, `achievements`, `completedLevels`,
 * `studyMastery`, `practiceTracks`, game wins or unlocks as final values (DoD
 * #6). The only write the client is trusted with is the preference whitelist
 * (`writePreferences`); everything authoritative goes through the progression /
 * shop / migration commands.
 *
 * `reviewSchedules` is persisted verbatim as a client-owned opaque blob via
 * `PATCH /api/v1/me/learning-state` (`writeLearningState` below) — a tracked
 * Phase-1 DoD exception (§7.4); the SM-2-lite scheduling model is Phase 3 work.
 */

import type { ServerStore } from '../db/store';
import { migrateProfileWallet, type ProfileWithLegacyWallet } from '../../src/lib/storage';
import { isBollsTranslation } from '../../src/lib/bollsConstants';
import type { WalletLedger } from '../wallet';
import type { PreferencesRepository } from '../domains/identity/repository';
import type { EntitlementRepository } from '../domains/economy/entitlements';
import type { ProgressionRepositories } from '../domains/progression/repository';

/**
 * Typed-preferences cutover (Phase 2 §18.2). When a `PreferencesRepository` is
 * wired, the whitelist fields with a typed home (`activeTheme` / `avatar` /
 * `bibleTranslation`) are written to `user_preferences`; the read overlays them
 * back on top of the legacy blob so consumers see one shape. `legacyReadOnly`
 * stops the parallel blob write for those fields once the backfill is verified.
 */
export interface PreferencesCutover {
  repo: PreferencesRepository;
  legacyReadOnly: boolean;
}

/**
 * Progression / entitlement decomposition cutover (Phase 2 §18.2, ADR-016).
 * When wired, `readProfile` overlays the typed `progression_state` /
 * `achievement_grants` / `entitlements` rows on top of the legacy blob so
 * consumers keep seeing one profile shape. SQL-only — present only when a
 * database is wired. `legacyReadOnly` is informational here (the write path in
 * `progressionService` owns the blob-freeze decision); `readProfile` always
 * overlays a typed row when it exists.
 */
export interface ProgressionCutover {
  repos: ProgressionRepositories;
  entitlements: EntitlementRepository;
  legacyReadOnly: boolean;
  now: () => Date;
}

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
    reviewSchedules: {},
    playerRank: { tier: 'baby', plaque: 7, wisdomPoints: 0, unlockedTier: 'child' },
  };
}

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
  walletLedger: WalletLedger,
  preferences?: PreferencesCutover,
  progression?: ProgressionCutover,
): Promise<Record<string, unknown>> {
  const profile = await dbStore.getProfile(userId);
  const base = profile
    ? migrateProfileWallet(profile as ProfileWithLegacyWallet)
    : emptyProfile(userId);
  const merged: Record<string, unknown> = { ...base, coins: await walletLedger.getBalance(userId) };

  if (preferences) {
    const typed = await preferences.repo.get(userId);
    if (typed) {
      if (typed.activeTheme !== null) merged.activeTheme = typed.activeTheme;
      if (typed.avatar !== null) merged.avatar = typed.avatar;
      if (typed.bibleTranslation !== null) merged.bibleTranslation = typed.bibleTranslation;
    }
  }

  if (progression) {
    const [state, grants, active] = await Promise.all([
      progression.repos.state.get(userId),
      progression.repos.achievements.list(userId),
      progression.entitlements.listActive(userId, progression.now()),
    ]);
    if (state) {
      merged.playerRank = {
        tier: state.rankTier,
        plaque: state.rankPlaque,
        wisdomPoints: state.wisdomPoints,
        unlockedTier: state.rankUnlockedTier,
      };
      merged.streakDays = state.streakDays;
      merged.lastActiveAt = state.lastActiveAt;
      merged.millionaireWins = state.millionaireWins;
      merged.millionaireMaxLevel = state.millionaireMaxLevel;
      merged.survivalHighScore = state.survivalHighScore;
      merged.completedLevels = state.completedLevels;
      merged.themePoints = state.themePoints;
      merged.practiceTracks = state.practiceTracks;
      merged.studyMastery = state.studyMastery;
      merged.achievements = grants.map((g) => g.achievementId);
      merged.unlockedThemes = active
        .filter((e) => e.productKind === 'theme')
        .map((e) => e.productId);
      merged.unlockedAvatars = active
        .filter((e) => e.productKind === 'avatar')
        .map((e) => e.productId);
    }
  }
  return merged;
}

/** Apply the preference whitelist and nothing else (Phase 1 §7.1). */
export async function writePreferences(
  dbStore: ServerStore,
  userId: string,
  body: unknown,
  preferences?: PreferencesCutover,
): Promise<void> {
  const existing = (await dbStore.getProfile(userId)) ?? {};
  const prefs = sanitizePreferences(body, existing as Record<string, unknown>);
  if (Object.keys(prefs).length === 0) return; // nothing survived the whitelist

  if (preferences) {
    const typedPatch: Record<string, string> = {};
    if (prefs.activeTheme !== undefined) typedPatch.activeTheme = prefs.activeTheme;
    if (prefs.avatar !== undefined) typedPatch.avatar = prefs.avatar;
    if (prefs.bibleTranslation !== undefined) typedPatch.bibleTranslation = prefs.bibleTranslation;
    if (Object.keys(typedPatch).length > 0) {
      await preferences.repo.upsert(userId, typedPatch);
    }
  }

  // Once the typed store is authoritative (`legacyReadOnly`), stop mirroring the
  // three typed fields into the blob — but `displayName` has no typed home yet,
  // so it (and everything else) still goes through here.
  const blobPrefs =
    preferences?.legacyReadOnly
      ? { ...(prefs.displayName !== undefined ? { displayName: prefs.displayName } : {}) }
      : prefs;
  if (Object.keys(blobPrefs).length === 0) return;

  await dbStore.setProfile(userId, {
    ...existing,
    ...blobPrefs,
    userId,
    updatedAt: new Date().toISOString(),
  });
}

const MAX_REVIEW_SCHEDULE_KEYS = 500;

/**
 * Opaque persistence for the client-owned review-schedule blob (§7.4, tracked
 * Phase-1 DoD exception). Only `reviewSchedules` is accepted; each value must be
 * an object; the map is capped. The server never computes or rewards from it.
 */
export async function writeLearningState(
  dbStore: ServerStore,
  userId: string,
  body: unknown,
): Promise<Record<string, unknown>> {
  const existing = (await dbStore.getProfile(userId)) ?? {};
  const raw = isRecord(body) && isRecord(body.reviewSchedules) ? body.reviewSchedules : {};
  const entries = Object.entries(raw)
    .filter(([, v]) => isRecord(v))
    .slice(0, MAX_REVIEW_SCHEDULE_KEYS);
  const reviewSchedules = Object.fromEntries(entries);

  await dbStore.setProfile(userId, {
    ...existing,
    reviewSchedules,
    userId,
    updatedAt: new Date().toISOString(),
  });
  return reviewSchedules;
}
