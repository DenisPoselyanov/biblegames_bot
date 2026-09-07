/**
 * Server-authoritative study-mastery math (Phase 1 §7.5, ADR-003).
 *
 * A faithful port of `updateMastery` from src/lib/learning.ts — kept as a
 * separate copy (like server/progression/rankMath.ts and server/lib/streak.ts)
 * so the server does not pull the client's dependency graph. The two must stay
 * in sync until Phase 2 consolidates the progression domain.
 *
 * One deliberate divergence: the `mastery-expert` achievement is granted when
 * mastery reaches 100 (the achievement text: "Досягти 100% майстерності"). The
 * client currently checks `nextMasteryState.mastery >= 0.99` against a 0..100
 * scale, which fires after a single correct answer — a bug this port does not
 * reproduce.
 */

import type { MasteryState } from '../../src/types/index';

export const MASTERY_MAX = 100;
export const MASTERY_EXPERT_THRESHOLD = 100;

function emptyMastery(): MasteryState {
  return {
    mastery: 0,
    confidence: 0,
    lastReviewedAt: null,
    errorTags: [],
    correctStreak: 0,
    wrongCount: 0,
    totalAnswers: 0,
  };
}

export function updateMastery(
  state: MasteryState | undefined,
  isCorrect: boolean,
  tag: string,
  now: Date = new Date(),
): MasteryState {
  const current = state ?? emptyMastery();
  const nextStreak = isCorrect ? current.correctStreak + 1 : 0;
  const total = current.totalAnswers + 1;
  const wrongCount = current.wrongCount + (isCorrect ? 0 : 1);
  const delta = isCorrect ? 6 + Math.min(6, nextStreak) : -10;
  const mastery = Math.max(0, Math.min(MASTERY_MAX, current.mastery + delta));
  const confidence = Math.max(0, Math.min(100, Math.round((1 - wrongCount / total) * 100)));
  return {
    ...current,
    mastery,
    confidence,
    lastReviewedAt: now.toISOString(),
    errorTags: isCorrect ? current.errorTags : Array.from(new Set([...current.errorTags, tag])),
    correctStreak: nextStreak,
    wrongCount,
    totalAnswers: total,
  };
}
