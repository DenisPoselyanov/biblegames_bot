/**
 * User preferences — the typed, decomposed home for what used to live in the
 * `player_profiles` blob (Phase 2 §5.1 "preferences", §18.2 step 2).
 *
 * Preferences are the one client-trusted write surface (§7.1). This repository
 * is the authoritative store for them once `LEGACY_STORE_READONLY` is set; until
 * then it is written alongside the blob during the verification window.
 */
import type { Transaction } from '../shared/context';

export interface PreferencesRecord {
  userId: string;
  schemaVersion: number;
  bibleTranslation: string | null;
  activeTheme: string | null;
  avatar: string | null;
  locale: string | null;
  timezone: string | null;
  motionIntensity: string | null;
  updatedAt: string;
}

/** Only the provided keys are changed. `null` clears a value; `undefined` leaves it. */
export interface PreferencesPatch {
  bibleTranslation?: string | null;
  activeTheme?: string | null;
  avatar?: string | null;
  locale?: string | null;
  timezone?: string | null;
  motionIntensity?: string | null;
}

export const PREFERENCE_KEYS = [
  'bibleTranslation',
  'activeTheme',
  'avatar',
  'locale',
  'timezone',
  'motionIntensity',
] as const;

export interface PreferencesRepository {
  get(userId: string, tx?: Transaction): Promise<PreferencesRecord | null>;
  /**
   * Upsert the given fields. Creates the row (schema version 1) if absent.
   * Returns the full stored record.
   */
  upsert(userId: string, patch: PreferencesPatch, tx?: Transaction): Promise<PreferencesRecord>;
}
