import type { KahootScoringMode } from '../src/types/kahoot';

const STREAK_BONUS_THRESHOLD = 3;
const STREAK_BONUS_MULTIPLIER = 1.1;

export function calcClassicPoints(elapsedMs: number, timeLimitMs: number, correct: boolean, streak: number): number {
  if (!correct) return 0;
  const ratio = Math.max(0, Math.min(1, 1 - elapsedMs / timeLimitMs));
  let points = Math.max(200, Math.round(800 + 1200 * ratio));
  if (streak >= STREAK_BONUS_THRESHOLD) {
    points = Math.round(points * STREAK_BONUS_MULTIPLIER);
  }
  return points;
}

/** QuizLive-style linear 5–30 points */
export function calcSimplePoints(elapsedMs: number, timeLimitMs: number, correct: boolean): number {
  if (!correct) return 0;
  const timerSec = timeLimitMs / 1000;
  const timeTakenSec = elapsedMs / 1000;
  const raw = 30 - (timeTakenSec / timerSec) * 25;
  return Math.max(5, Math.round(raw));
}

export function calcQuestionPoints(
  scoringMode: KahootScoringMode,
  elapsedMs: number,
  timeLimitMs: number,
  correct: boolean,
  streakBeforeAnswer: number,
): number {
  if (scoringMode === 'simple') {
    return calcSimplePoints(elapsedMs, timeLimitMs, correct);
  }
  return calcClassicPoints(elapsedMs, timeLimitMs, correct, streakBeforeAnswer);
}
