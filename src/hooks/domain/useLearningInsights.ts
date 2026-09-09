import { useCallback, useMemo } from 'react';
import type { DailyPlanItem, Recommendation } from '../../types';
import { generateRecommendations } from '../../lib/recommendationEngine';
import { buildDailyPlan } from '../../lib/dailyPlan';
import { loadAllTopicHierarchies } from '../../data/topicDbLoader';
import { useResolvedProfile } from './useProfileWriter';

export interface LearningInsights {
  getRecommendations: (maxRecommendations?: number) => Promise<Recommendation[]>;
  getDailyPlan: () => Promise<DailyPlanItem[]>;
}

/**
 * Derived learning guidance (§13.1) — recommendations and the daily plan are
 * pure functions of the current profile plus the topic hierarchy. Read-only.
 */
export function useLearningInsights(): LearningInsights {
  const profile = useResolvedProfile();

  const getRecommendations = useCallback(
    async (maxRecommendations = 5): Promise<Recommendation[]> => {
      try {
        const topicHierarchy = await loadAllTopicHierarchies();
        return generateRecommendations({ profile, topicHierarchy }, maxRecommendations);
      } catch (error) {
        console.error('Failed to generate recommendations:', error);
        return [];
      }
    },
    [profile],
  );

  const getDailyPlan = useCallback(async (): Promise<DailyPlanItem[]> => {
    try {
      const topicHierarchy = await loadAllTopicHierarchies();
      return buildDailyPlan({ profile, topicHierarchy });
    } catch (error) {
      console.error('Failed to build daily plan:', error);
      return [];
    }
  }, [profile]);

  return useMemo(
    () => ({ getRecommendations, getDailyPlan }),
    [getRecommendations, getDailyPlan],
  );
}
