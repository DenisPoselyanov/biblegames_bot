/**
 * Server-side rank/wisdom math (Phase 1 §7.5, ADR-003).
 *
 * A faithful port of the pure functions in src/lib/practiceProgression.ts —
 * kept as a separate copy (like server/lib/streak.ts ports updateStreak) so the
 * server does not pull the client's practice-stage-config / zustand dependency
 * graph. These two must stay in sync until Phase 2 consolidates the progression
 * domain into one shared module.
 */

import { DIFFICULTIES, DIFFICULTY_ORDER, type Difficulty, type PlayerRank } from '../../src/types/index';

export const WISDOM_PER_STAGE_BASE: Record<Difficulty, number> = {
  baby: 5,
  child: 8,
  youth: 12,
  student: 18,
  preacher: 25,
  teacher: 35,
  theologian: 50,
};

export const WISDOM_TO_NEXT_PLAQUE = 20;
export const WISDOM_TO_NEXT_TIER = 30;

export function getDefaultPlayerRank(): PlayerRank {
  return { tier: 'baby', plaque: 7, wisdomPoints: 0, unlockedTier: 'child' };
}

export function computeStageWisdom(difficulty: Difficulty, correct: number, total: number): number {
  if (total <= 0 || correct <= 0) return 0;
  const base = WISDOM_PER_STAGE_BASE[difficulty];
  const accuracy = correct / total;
  let wisdom = Math.round(base * accuracy);
  if (correct === total) wisdom = Math.round(wisdom * 1.5);
  return Math.max(0, wisdom);
}

function nextUnlockedTierAfterPromotion(tier: Difficulty): Difficulty {
  const idx = DIFFICULTY_ORDER[tier] + 1;
  if (idx + 1 < DIFFICULTIES.length) return DIFFICULTIES[idx + 1];
  return DIFFICULTIES[Math.min(idx, DIFFICULTIES.length - 1)];
}

export function advancePlayerRank(current: PlayerRank, wisdomDelta: number): PlayerRank {
  if (wisdomDelta <= 0) return current;

  let { tier, plaque, wisdomPoints, unlockedTier } = current;
  wisdomPoints += wisdomDelta;

  while (true) {
    if (plaque > 1) {
      if (wisdomPoints >= WISDOM_TO_NEXT_PLAQUE) {
        wisdomPoints -= WISDOM_TO_NEXT_PLAQUE;
        plaque -= 1;
        continue;
      }
      break;
    }

    const tierIndex = DIFFICULTY_ORDER[tier];
    if (tierIndex >= DIFFICULTIES.length - 1) break;

    if (wisdomPoints >= WISDOM_TO_NEXT_TIER) {
      wisdomPoints -= WISDOM_TO_NEXT_TIER;
      tier = DIFFICULTIES[tierIndex + 1];
      plaque = 7;
      const newUnlocked = nextUnlockedTierAfterPromotion(tier);
      if (DIFFICULTY_ORDER[newUnlocked] > DIFFICULTY_ORDER[unlockedTier]) {
        unlockedTier = newUnlocked;
      }
      continue;
    }
    break;
  }

  return { tier, plaque, wisdomPoints, unlockedTier };
}
