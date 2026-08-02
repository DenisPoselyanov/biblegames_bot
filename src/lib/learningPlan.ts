import type { LearningPlan, LearningPlanStep, PlayerProfile, TopicNode } from '../types';
import { getLearningObjectiveId } from './learningObjectives';
import {
  countPassedStages,
  findPracticeTrack,
  getPracticeStageCount,
  getStageQuizPath,
} from './practiceProgression';

const PLAN_DIFFICULTY = 'baby' as const;

function collectLeafNodes(node: TopicNode): TopicNode[] {
  if (node.aggregateThemeIds?.length) return [];
  if (!node.children?.length) return [node];
  return node.children.flatMap(collectLeafNodes);
}

/**
 * Ordered curriculum for a theme (learning_plans flag). Sequence is document
 * order in the topic hierarchy — authoring order is assumed pedagogical
 * order, there is no separate `order` field (documented limitation).
 * Reuses the same practice-progression helpers ThemeDetail.tsx already uses
 * for the per-difficulty stage list, so status here matches what the user
 * sees once they open a node.
 */
export function buildLearningPlan(
  themeId: string,
  hierarchyRoot: TopicNode,
  profile: PlayerProfile,
): LearningPlan {
  const leaves = collectLeafNodes(hierarchyRoot);

  const steps: LearningPlanStep[] = leaves.map((node) => {
    const stageCount = getPracticeStageCount(node.id, PLAN_DIFFICULTY, {
      hierarchyRoot,
    });
    const track = findPracticeTrack(
      profile.practiceTracks ?? [],
      themeId,
      node.id,
      PLAN_DIFFICULTY,
    );
    const passedStages = track ? countPassedStages(track) : 0;

    const status: LearningPlanStep['status'] =
      stageCount > 0 && passedStages >= stageCount
        ? 'completed'
        : passedStages > 0 || track
          ? 'in_progress'
          : 'available';

    const nextStageIndex = passedStages >= stageCount ? 0 : (track?.highestUnlockedStage ?? 0);

    return {
      nodeId: node.id,
      learningObjectiveId: getLearningObjectiveId(themeId, node.id),
      title: node.title,
      icon: node.icon,
      status,
      lessonPath: `/play/study/lesson/${themeId}/${node.id}`,
      practicePath: getStageQuizPath(themeId, PLAN_DIFFICULTY, nextStageIndex, node.id),
    };
  });

  return { themeId, steps };
}
