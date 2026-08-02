import type { AnswerEvent, PlayerProfile, ProgressSummary, TopicNode } from '../types';
import { buildLearningInsight, countTotalPassedStages } from './learning';
import { buildReviewQueue } from './reviewScheduler';
import { computeWisdomProgress, formatRankLabel } from './practiceProgression';

/**
 * Thin composition over Phase 4-6 data — no new scoring/aggregation math,
 * just a single object for ProgressDashboard.tsx to render.
 */
export function buildProgressSummary(
  profile: PlayerProfile,
  answerHistory: AnswerEvent[],
  hierarchies: Record<string, TopicNode | null>,
): ProgressSummary {
  const insight = buildLearningInsight(profile, answerHistory);
  const stagesPassed = countTotalPassedStages(profile);
  const wisdom = computeWisdomProgress(profile.playerRank);

  const reviewDueCount = (profile.unlockedThemes ?? []).reduce((sum, themeId) => {
    const hierarchyRoot = hierarchies[themeId];
    if (!hierarchyRoot) return sum;
    return sum + buildReviewQueue(profile, hierarchyRoot, themeId).length;
  }, 0);

  return {
    streakDays: profile.streakDays,
    accuracy7d: insight.accuracy7d,
    accuracy30d: insight.accuracy30d,
    masteredSubthemes: insight.masteredSubthemes,
    stagesPassed,
    reviewDueCount,
    wisdom,
    rankLabel: formatRankLabel(profile.playerRank.tier, profile.playerRank.plaque),
  };
}
