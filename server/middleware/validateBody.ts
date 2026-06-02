import type { PlayerProfile } from '../../src/types/index';
import { isBollsTranslation } from '../../src/lib/bollsConstants';

const DIFFICULTIES = new Set([
  'baby',
  'child',
  'youth',
  'student',
  'preacher',
  'teacher',
  'theologian',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function sanitizeProfileBody(
  userId: string,
  body: unknown,
): Partial<PlayerProfile> & { userId: string } {
  if (!isRecord(body)) {
    return { userId };
  }
  const legacyTotalPoints = typeof body.totalPoints === 'number' ? Math.max(0, body.totalPoints) : 0;
  const coins = typeof body.coins === 'number' ? Math.max(0, body.coins) : 0;

  const completedLevels = Array.isArray(body.completedLevels)
    ? body.completedLevels
        .filter(isRecord)
        .slice(0, 500)
        .map((level) => ({
          themeId: String(level.themeId ?? ''),
          difficulty: DIFFICULTIES.has(String(level.difficulty))
            ? (level.difficulty as PlayerProfile['completedLevels'][0]['difficulty'])
            : 'child',
          score: Math.max(0, Number(level.score) || 0),
          maxScore: Math.max(1, Number(level.maxScore) || 1),
          completedAt: String(level.completedAt ?? new Date().toISOString()),
        }))
        .filter((l) => l.themeId)
    : undefined;

  return {
    userId,
    displayName: typeof body.displayName === 'string' ? body.displayName.slice(0, 120) : undefined,
    coins: coins + legacyTotalPoints,
    survivalHighScore:
      typeof body.survivalHighScore === 'number' ? Math.max(0, body.survivalHighScore) : undefined,
    millionaireWins:
      typeof body.millionaireWins === 'number' ? Math.max(0, body.millionaireWins) : undefined,
    millionaireMaxLevel:
      typeof body.millionaireMaxLevel === 'number' ? Math.max(0, body.millionaireMaxLevel) : undefined,
    streakDays: typeof body.streakDays === 'number' ? Math.max(0, body.streakDays) : undefined,
    themePoints: isRecord(body.themePoints)
      ? Object.fromEntries(
          Object.entries(body.themePoints)
            .slice(0, 100)
            .map(([k, v]) => [k.slice(0, 64), Math.max(0, Number(v) || 0)]),
        )
      : undefined,
    completedLevels,
    unlockedThemes: Array.isArray(body.unlockedThemes)
      ? body.unlockedThemes.map((t) => String(t).slice(0, 64)).slice(0, 100)
      : undefined,
    unlockedAvatars: Array.isArray(body.unlockedAvatars)
      ? body.unlockedAvatars.map((t) => String(t).slice(0, 64)).slice(0, 100)
      : undefined,
    achievements: Array.isArray(body.achievements)
      ? body.achievements.map((t) => String(t).slice(0, 64)).slice(0, 200)
      : undefined,
    activeTheme: typeof body.activeTheme === 'string' ? body.activeTheme.slice(0, 64) : undefined,
    avatar: typeof body.avatar === 'string' ? body.avatar.slice(0, 64) : undefined,
    lastActiveAt:
      body.lastActiveAt === null || typeof body.lastActiveAt === 'string'
        ? (body.lastActiveAt as string | null)
        : undefined,
    studyMastery: isRecord(body.studyMastery) ? (body.studyMastery as PlayerProfile['studyMastery']) : undefined,
    bibleTranslation:
      typeof body.bibleTranslation === 'string' && isBollsTranslation(body.bibleTranslation)
        ? body.bibleTranslation
        : undefined,
    practiceTracks: Array.isArray(body.practiceTracks)
      ? body.practiceTracks
          .filter(isRecord)
          .slice(0, 500)
          .map((track) => ({
            themeId: String(track.themeId ?? '').slice(0, 64),
            nodeId:
              track.nodeId === null || track.nodeId === undefined
                ? null
                : String(track.nodeId).slice(0, 64),
            difficulty: DIFFICULTIES.has(String(track.difficulty))
              ? (track.difficulty as PlayerProfile['practiceTracks'][0]['difficulty'])
              : 'baby',
            highestUnlockedStage: Math.max(0, Math.min(10, Number(track.highestUnlockedStage) || 0)),
            stageResults: Array.isArray(track.stageResults)
              ? track.stageResults
                  .filter(isRecord)
                  .slice(0, 20)
                  .map((result) => ({
                    stageIndex: Math.max(0, Math.min(10, Number(result.stageIndex) || 0)),
                    correct: Math.max(0, Number(result.correct) || 0),
                    total: Math.max(1, Number(result.total) || 1),
                    passed: Boolean(result.passed),
                    completedAt: String(result.completedAt ?? new Date().toISOString()),
                  }))
              : [],
          }))
          .filter((t) => t.themeId)
      : undefined,
    playerRank: isRecord(body.playerRank)
      ? {
          tier: DIFFICULTIES.has(String(body.playerRank.tier))
            ? (body.playerRank.tier as PlayerProfile['playerRank']['tier'])
            : 'baby',
          plaque: Math.max(1, Math.min(7, Number(body.playerRank.plaque) || 7)),
          wisdomPoints: Math.max(0, Number(body.playerRank.wisdomPoints) || 0),
          unlockedTier: DIFFICULTIES.has(String(body.playerRank.unlockedTier))
            ? (body.playerRank.unlockedTier as PlayerProfile['playerRank']['unlockedTier'])
            : 'child',
        }
      : undefined,
  };
}

export function sanitizeStatsBody(userId: string, body: unknown): Record<string, unknown> {
  if (!isRecord(body)) return { userId };
  const themes = isRecord(body.themes) ? body.themes : {};
  return {
    userId,
    themes,
    lastUpdated:
      typeof body.lastUpdated === 'string' ? body.lastUpdated : new Date().toISOString(),
  };
}

export function sanitizeStudyAnswers(body: unknown): unknown[] {
  if (!Array.isArray(body)) return [];
  return body.slice(0, 5000);
}

export function sanitizeTelemetryEvents(body: unknown): unknown[] {
  if (!isRecord(body) || !Array.isArray(body.events)) return [];
  return body.events.slice(0, 100);
}
