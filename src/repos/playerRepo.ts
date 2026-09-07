import type { PlayerProfile } from '../types';
import { loadProfile, saveProfile } from '../lib/storage';
import { normalizeBollsTranslation } from '../lib/bollsConstants';
import { hasApi } from './apiClient';
import { progressionRepo } from './progressionRepo';

/**
 * The server-authoritative `/api/v1` surface is the only remote path (WS4 part 2
 * removed the `authoritative_profile` flag and the legacy whole-profile
 * `GET/PUT /profile/:userId` round-trip). Authoritative fields are owned by the
 * progression / shop / migration commands; the client only ever writes the
 * preference whitelist. With no API base configured the app runs fully local.
 */

export const playerRepo = {
  async get(userId: string, displayName: string): Promise<PlayerProfile> {
    const local = loadProfile(userId, displayName);
    if (!hasApi()) return local;

    try {
      // One-time migration seeds the server from the local profile on first run.
      await maybeMigrate(userId, local);
      const remote = await progressionRepo.getProfile();
      if (!remote) return local;
      const hydrated: PlayerProfile = {
        ...local,
        ...remote,
        userId,
        displayName: remote.displayName || displayName || local.displayName,
        bibleTranslation: normalizeBollsTranslation(
          remote.bibleTranslation ?? local.bibleTranslation,
        ),
      };
      saveProfile(hydrated);
      return hydrated;
    } catch {
      return local;
    }
  },

  async save(profile: PlayerProfile): Promise<void> {
    saveProfile(profile);
    if (!hasApi()) return;
    try {
      await progressionRepo.savePreferences({
        displayName: profile.displayName,
        bibleTranslation: profile.bibleTranslation,
        activeTheme: profile.activeTheme,
        avatar: profile.avatar,
      });
    } catch {
      /* noop — preferences retry on the next change */
    }
  },
};

const MIGRATED_KEY_PREFIX = 'bible-game-migrated:';

async function maybeMigrate(userId: string, local: PlayerProfile): Promise<void> {
  const key = `${MIGRATED_KEY_PREFIX}${userId}`;
  try {
    if (localStorage.getItem(key)) return;
  } catch {
    return;
  }
  try {
    await progressionRepo.migrate(local);
  } catch {
    // Server is idempotent; a failed attempt just retries next load.
    return;
  }
  try {
    localStorage.setItem(key, new Date().toISOString());
  } catch {
    /* noop */
  }
}
