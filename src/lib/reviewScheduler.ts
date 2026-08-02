import type { PlayerProfile, ReviewQueueItem, ReviewScheduleState, TopicNode } from '../types';
import { getLearningObjectiveId } from './learningObjectives';
import { getStageQuizPath } from './practiceProgression';

const REVIEW_DIFFICULTY = 'baby' as const;
const INITIAL_EASE_FACTOR = 2.5;
const MIN_EASE_FACTOR = 1.3;

function collectLeafNodes(node: TopicNode): TopicNode[] {
  if (node.aggregateThemeIds?.length) return [];
  if (!node.children?.length) return [node];
  return node.children.flatMap(collectLeafNodes);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * SM-2-lite: only pass/fail is known at practice-stage granularity (no
 * per-answer quality grade), so this collapses SM-2's quality scale to two
 * branches — a "quality=5" pass and a "quality=0" fail.
 */
export function computeNextReviewState(
  existing: ReviewScheduleState | undefined,
  objective: { learningObjectiveId: string; themeId: string; nodeId: string },
  passed: boolean,
  now: Date = new Date(),
): ReviewScheduleState {
  const easeFactor = existing?.easeFactor ?? INITIAL_EASE_FACTOR;
  const repetitions = existing?.repetitions ?? 0;
  const intervalDays = existing?.intervalDays ?? 0;

  let nextEaseFactor: number;
  let nextRepetitions: number;
  let nextIntervalDays: number;

  if (passed) {
    nextRepetitions = repetitions + 1;
    nextEaseFactor = Math.max(MIN_EASE_FACTOR, easeFactor + 0.1);
    nextIntervalDays =
      nextRepetitions === 1 ? 1 : nextRepetitions === 2 ? 6 : Math.round(intervalDays * easeFactor);
  } else {
    nextRepetitions = 0;
    nextEaseFactor = Math.max(MIN_EASE_FACTOR, easeFactor - 0.2);
    nextIntervalDays = 1;
  }

  return {
    learningObjectiveId: objective.learningObjectiveId,
    themeId: objective.themeId,
    nodeId: objective.nodeId,
    easeFactor: nextEaseFactor,
    intervalDays: nextIntervalDays,
    repetitions: nextRepetitions,
    dueAt: addDays(now, nextIntervalDays).toISOString(),
    lastReviewedAt: now.toISOString(),
  };
}

/**
 * Objectives due for review in a theme, sorted most-overdue first. Only
 * leaf nodes that already have a review schedule are candidates — a node
 * with no schedule yet hasn't been practiced under review_scheduler_v2,
 * so it belongs to the learning plan / practice flow, not the review queue.
 */
export function buildReviewQueue(
  profile: PlayerProfile,
  hierarchyRoot: TopicNode,
  themeId: string,
  now: Date = new Date(),
): ReviewQueueItem[] {
  const leaves = collectLeafNodes(hierarchyRoot);
  const schedules = profile.reviewSchedules ?? {};

  const items: ReviewQueueItem[] = leaves
    .map((node) => {
      const learningObjectiveId = getLearningObjectiveId(themeId, node.id);
      const schedule = schedules[learningObjectiveId];
      if (!schedule) return null;
      const dueAt = new Date(schedule.dueAt).getTime();
      if (dueAt > now.getTime()) return null;
      const overdueDays = Math.max(0, Math.floor((now.getTime() - dueAt) / (24 * 60 * 60 * 1000)));

      const item: ReviewQueueItem = {
        learningObjectiveId,
        themeId,
        nodeId: node.id,
        title: node.title,
        icon: node.icon,
        dueAt: schedule.dueAt,
        overdueDays,
        practicePath: getStageQuizPath(themeId, REVIEW_DIFFICULTY, 0, node.id),
      };
      return item;
    })
    .filter((item): item is ReviewQueueItem => item !== null);

  return items.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
}
