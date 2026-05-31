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
    totalPoints: typeof body.totalPoints === 'number' ? Math.max(0, body.totalPoints) : undefined,
    coins: typeof body.coins === 'number' ? Math.max(0, body.coins) : undefined,
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
