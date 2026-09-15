/**
 * Review-due computation (Phase 3 WS2 §12.5).
 *
 * A pure function, same style as `server/progression/masteryMath.ts` — no
 * persistence of its own. Due-ness is *derived* from a `MasteryState` that
 * `applyAnswer` already maintains (`correctStreak`, `lastReviewedAt`), so
 * nothing new is written; a snapshot is a computed view here, not a stored
 * aggregate (mirrors the framing in `contracts/schemas/snapshots.ts`).
 *
 * The interval ladder is a plain Leitner-style doubling, not FSRS — the Phase 3
 * spec explicitly reserves algorithmic sophistication for Phase 8 and warns
 * against "fake scientific precision" (§12.5). `box = min(correctStreak, 5)`:
 * every correct answer advances one box (capped), any wrong answer resets
 * `correctStreak` to 0 (already `updateMastery`'s behaviour), so a lapse always
 * drops an item back to the 1-day box.
 */
import type { MasteryState } from '../../../src/types/index';

export const REVIEW_BOX_INTERVALS_DAYS = [1, 2, 4, 7, 14, 30] as const;

export interface ReviewDueEntry {
  objectiveId: string;
  dueAt: string;
  box: number;
  reason: 'missed_recently' | 'spaced_interval';
}

/**
 * Due-ness for every objective the caller has ever answered. Entries with no
 * `lastReviewedAt` (never studied) are skipped — "not started" is a different
 * concern (Learning hub / daily plan), not a review item. Result is sorted
 * most-overdue first.
 */
export function computeReviewDue(
  mastery: Record<string, MasteryState>,
  now: Date = new Date(),
): ReviewDueEntry[] {
  const entries: ReviewDueEntry[] = [];

  for (const [objectiveId, state] of Object.entries(mastery)) {
    if (!state.lastReviewedAt) continue;
    const lastReviewedAt = Date.parse(state.lastReviewedAt);
    if (!Number.isFinite(lastReviewedAt)) continue;

    const box = Math.min(state.correctStreak, REVIEW_BOX_INTERVALS_DAYS.length - 1);
    const intervalMs = REVIEW_BOX_INTERVALS_DAYS[box] * 24 * 60 * 60 * 1000;
    const dueAt = new Date(lastReviewedAt + intervalMs);
    if (dueAt.getTime() > now.getTime()) continue;

    entries.push({
      objectiveId,
      dueAt: dueAt.toISOString(),
      box,
      reason: state.wrongCount > 0 && box === 0 ? 'missed_recently' : 'spaced_interval',
    });
  }

  return entries.sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
}
