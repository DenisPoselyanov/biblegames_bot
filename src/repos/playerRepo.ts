import type { CompletedLevel, PlayerProfile } from '../types';
import { loadProfile, saveProfile } from '../lib/storage';
import { normalizeBollsTranslation } from '../lib/bollsConstants';
import { apiFetch, hasApi } from './apiClient';

function isRemoteEnabled(): boolean {
  return hasApi();
}

function levelKey(level: CompletedLevel): string {
  return `${level.themeId}:${level.difficulty}`;
}

function mergeCompletedLevels(
  local: CompletedLevel[],
  remote: CompletedLevel[],
): CompletedLevel[] {
  const map = new Map<string, CompletedLevel>();
  for (const level of remote) {
    map.set(levelKey(level), level);
  }
  for (const level of local) {
    const key = levelKey(level);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, level);
      continue;
    }
    const existingScore = existing.score / Math.max(1, existing.maxScore);
    const levelScore = level.score / Math.max(1, level.maxScore);
    const existingTime = new Date(existing.completedAt).getTime();
    const levelTime = new Date(level.completedAt).getTime();
    if (
      levelScore > existingScore ||
      (levelScore === existingScore && levelTime > existingTime)
    ) {
      map.set(key, level);
    }
  }
  return [...map.values()];
}

function mergeProfiles(local: PlayerProfile, remote: PlayerProfile): PlayerProfile {
  const themePoints: Record<string, number> = { ...remote.themePoints };
  for (const [key, value] of Object.entries(local.themePoints)) {
    themePoints[key] = Math.max(themePoints[key] ?? 0, value);
  }

  const mastery = { ...remote.studyMastery };
  for (const [key, value] of Object.entries(local.studyMastery)) {
    if (!mastery[key]) {
      mastery[key] = value;
      continue;
    }
    mastery[key] = {
      ...mastery[key],
      mastery: Math.max(mastery[key].mastery, value.mastery),
      confidence: Math.max(mastery[key].confidence, value.confidence),
      correctStreak: Math.max(mastery[key].correctStreak, value.correctStreak),
      wrongCount: Math.max(mastery[key].wrongCount, value.wrongCount),
      totalAnswers: Math.max(mastery[key].totalAnswers, value.totalAnswers),
      errorTags: Array.from(new Set([...mastery[key].errorTags, ...value.errorTags])),
      lastReviewedAt: mastery[key].lastReviewedAt && value.lastReviewedAt
        ? (new Date(mastery[key].lastReviewedAt) > new Date(value.lastReviewedAt)
          ? mastery[key].lastReviewedAt
          : value.lastReviewedAt)
        : mastery[key].lastReviewedAt ?? value.lastReviewedAt,
    };
  }

  return {
    ...remote,
    displayName: local.displayName || remote.displayName,
    totalPoints: Math.max(local.totalPoints, remote.totalPoints),
    coins: Math.max(local.coins, remote.coins),
    survivalHighScore: Math.max(local.survivalHighScore, remote.survivalHighScore),
    millionaireWins: Math.max(local.millionaireWins, remote.millionaireWins),
    millionaireMaxLevel: Math.max(local.millionaireMaxLevel, remote.millionaireMaxLevel),
    streakDays: Math.max(local.streakDays, remote.streakDays),
    themePoints,
    completedLevels: mergeCompletedLevels(local.completedLevels, remote.completedLevels),
    unlockedThemes: Array.from(new Set([...remote.unlockedThemes, ...local.unlockedThemes])),
    unlockedAvatars: Array.from(new Set([...remote.unlockedAvatars, ...local.unlockedAvatars])),
    achievements: Array.from(new Set([...remote.achievements, ...local.achievements])),
    studyMastery: mastery,
    lastActiveAt: local.lastActiveAt && remote.lastActiveAt
      ? (new Date(local.lastActiveAt) > new Date(remote.lastActiveAt) ? local.lastActiveAt : remote.lastActiveAt)
      : local.lastActiveAt ?? remote.lastActiveAt,
    activeTheme: local.activeTheme || remote.activeTheme,
    avatar: local.avatar || remote.avatar,
    bibleTranslation: normalizeBollsTranslation(
      local.bibleTranslation ?? remote.bibleTranslation,
    ),
  };
}

function profilesEqual(a: PlayerProfile, b: PlayerProfile): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export const playerRepo = {
  async get(userId: string, displayName: string): Promise<PlayerProfile> {
    const local = loadProfile(userId, displayName);
    if (!isRemoteEnabled()) return local;
    try {
      const response = await apiFetch(`/profile/${userId}`, userId);
      if (!response.ok) return local;
      const remote = (await response.json()) as PlayerProfile;
      const merged = mergeProfiles(local, remote);
      saveProfile(merged);
      if (!profilesEqual(merged, remote)) {
        await apiFetch(`/profile/${merged.userId}`, userId, {
          method: 'PUT',
          body: JSON.stringify(merged),
        });
      }
      return merged;
    } catch {
      return local;
    }
  },
  async save(profile: PlayerProfile): Promise<void> {
    saveProfile(profile);
    if (!isRemoteEnabled()) return;
    try {
      await apiFetch(`/profile/${profile.userId}`, profile.userId, {
        method: 'PUT',
        body: JSON.stringify(profile),
      });
    } catch {
      /* noop */
    }
  },
};
