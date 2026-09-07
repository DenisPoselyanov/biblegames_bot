/**
 * Server-authoritative practice-track bookkeeping (Phase 1 §7.1, §7.5, ADR-003).
 *
 * The client (src/context/PlayerContext.tsx `completePracticeStage`) keeps a
 * per-track list of stage results and a `highestUnlockedStage`. Phase 1 DoD #6
 * forbids the client writing "practice unlocks" as final values, so the server
 * derives them from the `practice_stage` completion events it already receives.
 *
 * Unlock authority is "you passed stage N, so stage N+1 is open" — this needs
 * no stage-count manifest. An optional bounded `stageCount` hint only caps the
 * upper bound (a track can never unlock past its last stage); it can never lower
 * an already-unlocked stage.
 *
 * Rewards are incremental: a stage only pays out coins/wisdom for the amount
 * above the best it previously earned, so replaying an aced stage grants 0
 * (mirrors the client's `bestPointsAwarded` / `bestWisdomAwarded` logic).
 */

import type { Difficulty, PracticeStageResult, PracticeTrackProgress } from '../../src/types/index';

/** Ceiling on stage index we will ever unlock, mirroring the client MAX_STAGE_CAP. */
export const MAX_STAGE_INDEX = 11;

export function trackKey(themeId: string, nodeId: string | null, difficulty: Difficulty): string {
  return `${themeId}::${nodeId ?? '_root'}::${difficulty}`;
}

function keyOf(track: PracticeTrackProgress): string {
  return trackKey(track.themeId, track.nodeId, track.difficulty);
}

export interface StageApplyInput {
  themeId: string;
  nodeId: string | null;
  difficulty: Difficulty;
  stageIndex: number;
  correct: number;
  total: number;
  passed: boolean;
  /** Full (non-incremental) points this run is worth if it beats the prior best. */
  pointsThisRun: number;
  /** Full (non-incremental) wisdom this run is worth if it beats the prior best. */
  wisdomThisRun: number;
  /** Optional client hint for the track's stage count (1..12); only caps the upper bound. */
  stageCount?: number;
  questionIds?: string[];
  now: Date;
}

export interface StageApplyResult {
  tracks: PracticeTrackProgress[];
  /** Reward actually granted (incremental over the stage's prior best). */
  awardedPoints: number;
  awardedWisdom: number;
  stageResult: PracticeStageResult;
  nextStageUnlocked: boolean;
  stagePerfect: boolean;
}

export function applyPracticeStage(
  existingTracks: readonly PracticeTrackProgress[],
  input: StageApplyInput,
): StageApplyResult {
  const key = trackKey(input.themeId, input.nodeId, input.difficulty);
  const tracks = existingTracks.map((t) => ({
    ...t,
    stageResults: t.stageResults.map((r) => ({ ...r })),
  }));
  let track = tracks.find((t) => keyOf(t) === key);
  if (!track) {
    track = {
      themeId: input.themeId,
      nodeId: input.nodeId,
      difficulty: input.difficulty,
      highestUnlockedStage: 0,
      stageResults: [],
    };
    tracks.push(track);
  }

  const prev = track.stageResults.find((r) => r.stageIndex === input.stageIndex);
  const bestCorrectBefore = prev?.bestCorrect ?? prev?.correct ?? 0;
  const bestPointsBefore = prev?.bestPointsAwarded ?? 0;
  const bestWisdomBefore = prev?.bestWisdomAwarded ?? 0;

  const perfectNow = input.total > 0 && input.correct === input.total;
  const stagePerfect = Boolean(prev?.perfect) || perfectNow;
  const stagePassed = Boolean(prev?.passed) || input.passed;

  const awardedPoints = Math.max(0, input.pointsThisRun - bestPointsBefore);
  const awardedWisdom = Math.max(0, input.wisdomThisRun - bestWisdomBefore);

  const stageResult: PracticeStageResult = {
    stageIndex: input.stageIndex,
    correct: input.correct,
    total: input.total,
    attempts: (prev?.attempts ?? 0) + 1,
    questionIds: input.questionIds?.length ? input.questionIds : prev?.questionIds,
    bestCorrect: Math.max(bestCorrectBefore, input.correct),
    bestPointsAwarded: Math.max(bestPointsBefore, input.pointsThisRun),
    bestWisdomAwarded: Math.max(bestWisdomBefore, input.wisdomThisRun),
    perfect: stagePerfect,
    perfectCompletedAt: prev?.perfectCompletedAt ?? (perfectNow ? input.now.toISOString() : undefined),
    passed: stagePassed,
    completedAt: input.now.toISOString(),
  };

  track.stageResults = [
    ...track.stageResults.filter((r) => r.stageIndex !== input.stageIndex),
    stageResult,
  ].sort((a, b) => a.stageIndex - b.stageIndex);

  const cap = clampStageCap(input.stageCount);
  const unlockedBefore = track.highestUnlockedStage;
  if (input.passed) {
    track.highestUnlockedStage = Math.min(
      cap,
      Math.max(track.highestUnlockedStage, input.stageIndex + 1),
    );
  }
  const nextStageUnlocked =
    input.passed &&
    input.stageIndex < cap &&
    track.highestUnlockedStage > unlockedBefore &&
    track.highestUnlockedStage >= input.stageIndex + 1;

  return { tracks, awardedPoints, awardedWisdom, stageResult, nextStageUnlocked, stagePerfect };
}

function clampStageCap(hint: number | undefined): number {
  if (!Number.isFinite(hint) || !Number.isInteger(hint)) return MAX_STAGE_INDEX;
  const asIndex = (hint as number) - 1;
  return Math.max(0, Math.min(MAX_STAGE_INDEX, asIndex));
}
