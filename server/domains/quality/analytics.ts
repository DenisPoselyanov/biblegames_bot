/**
 * Gameplay quality analytics (Phase 4 WS9, spec §18) — pure functions over
 * the aggregates `QuestionSignalRepository` returns. No I/O, no personal data:
 * inputs are per-question counts only.
 *
 * Quality metrics support review; they never certify or change content by
 * themselves (§18 "do not automatically certify theological correctness").
 * An outlier is a suggestion for a human, surfaced in Studio.
 */
import type { OptionPickCount, QuestionAccuracy } from './types';

export type AccuracyBand = 'too_hard' | 'hard' | 'normal' | 'easy' | 'too_easy';

/** Band edges on the share of correct answers. Both tails are bad (prototype `library` note). */
export const ACCURACY_BANDS: ReadonlyArray<{ band: AccuracyBand; min: number; max: number }> = [
  { band: 'too_hard', min: 0, max: 0.4 },
  { band: 'hard', min: 0.4, max: 0.6 },
  { band: 'normal', min: 0.6, max: 0.85 },
  { band: 'easy', min: 0.85, max: 0.95 },
  { band: 'too_easy', min: 0.95, max: 1.0001 },
];

/** Below this many answers a question's accuracy is noise, not a signal. */
export const DEFAULT_MIN_ATTEMPTS = 20;

export function bandOf(accuracy: number): AccuracyBand {
  return (ACCURACY_BANDS.find((b) => accuracy >= b.min && accuracy < b.max) ?? ACCURACY_BANDS[4]).band;
}

export interface AccuracyOutlier {
  questionId: string;
  attempts: number;
  accuracy: number;
  issue: Extract<AccuracyBand, 'too_hard' | 'too_easy'>;
  /** How far past the band edge, weighted by evidence — higher is more urgent. */
  severity: number;
}

export interface QualityAnalysis {
  /** Questions that cleared `minAttempts`. */
  sampleSize: number;
  minAttempts: number;
  distribution: Array<{ band: AccuracyBand; count: number }>;
  outliers: AccuracyOutlier[];
}

export function analyzeAccuracy(
  stats: readonly QuestionAccuracy[],
  minAttempts: number = DEFAULT_MIN_ATTEMPTS,
): QualityAnalysis {
  const eligible = stats.filter((s) => s.attempts >= minAttempts && s.attempts > 0);
  const counts = new Map<AccuracyBand, number>(ACCURACY_BANDS.map((b) => [b.band, 0]));
  const outliers: AccuracyOutlier[] = [];
  for (const s of eligible) {
    const accuracy = s.correct / s.attempts;
    const band = bandOf(accuracy);
    counts.set(band, (counts.get(band) ?? 0) + 1);
    if (band === 'too_hard' || band === 'too_easy') {
      const distance = band === 'too_hard' ? 0.4 - accuracy : accuracy - 0.95;
      outliers.push({
        questionId: s.questionId,
        attempts: s.attempts,
        accuracy,
        issue: band,
        severity: Number(((distance + 0.01) * Math.log10(s.attempts + 1)).toFixed(4)),
      });
    }
  }
  outliers.sort((a, b) => b.severity - a.severity || (a.questionId < b.questionId ? -1 : 1));
  return {
    sampleSize: eligible.length,
    minAttempts,
    distribution: ACCURACY_BANDS.map((b) => ({ band: b.band, count: counts.get(b.band) ?? 0 })),
    outliers,
  };
}

export interface PositionBias {
  /** Total picks counted. */
  picks: number;
  /** Share of all picks that went to the first option. */
  firstOptionShare: number;
  /** What that share would be with no position effect (mean of 1/optionCount per pick). */
  expectedShare: number;
  /** Per-position share, index = option position. */
  byPosition: number[];
}

/**
 * "First-option bias in the wild" (plan WS9): do players pick option A more
 * than chance says? A strong excess means correct answers sit at A too often,
 * or wrong options are implausible enough that A wins by default.
 */
export function positionBias(picks: readonly OptionPickCount[]): PositionBias {
  let total = 0;
  let expected = 0;
  const byPosition: number[] = [];
  for (const p of picks) {
    total += p.picks;
    expected += p.picks / Math.max(1, p.optionCount);
    byPosition[p.optionIndex] = (byPosition[p.optionIndex] ?? 0) + p.picks;
  }
  const share = (n: number) => (total > 0 ? n / total : 0);
  return {
    picks: total,
    firstOptionShare: share(byPosition[0] ?? 0),
    expectedShare: share(expected),
    byPosition: Array.from({ length: byPosition.length }, (_, i) => share(byPosition[i] ?? 0)),
  };
}
