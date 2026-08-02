import type { DailyPlanItem, PlayerProfile, TopicHierarchyMap } from '../types';
import { generateRecommendations, formatRecommendation, getRecommendationLink } from './recommendationEngine';
import { hasPlayedToday } from './learning';

const MAX_DAILY_PLAN_ITEMS = 4;
const STREAK_MAINTENANCE_PRIORITY = 11; // above continue-practice (12) only when streak already started

interface DailyPlanContext {
  profile: PlayerProfile;
  topicHierarchy: TopicHierarchyMap;
  currentThemeId?: string;
  recentRecommendations?: string[];
}

/**
 * Reuses the existing recommendationEngine as the sole recommendation source
 * (no duplicated scoring logic) and folds in a streak-maintenance item when
 * the player hasn't played yet today, so the daily plan can replace both the
 * old recommendation cards and the separate getDailyTasks() block on Home.
 */
export function buildDailyPlan(context: DailyPlanContext): DailyPlanItem[] {
  const { profile, topicHierarchy, currentThemeId, recentRecommendations } = context;

  const recommendations = generateRecommendations(
    { profile, topicHierarchy, currentThemeId, recentRecommendations },
    MAX_DAILY_PLAN_ITEMS,
  );

  const items: DailyPlanItem[] = recommendations.map((rec) => {
    const formatted = formatRecommendation(rec);
    return {
      id: rec.id,
      kind: 'recommendation',
      title: formatted.title,
      description: formatted.description,
      subtitle: formatted.subtitle,
      icon: formatted.icon,
      link: getRecommendationLink(rec),
      priority: rec.priority,
      estimatedTime: rec.estimatedTime,
    };
  });

  if (profile.streakDays > 0 && !hasPlayedToday(profile)) {
    items.push({
      id: 'streak-maintenance-today',
      kind: 'streak-maintenance',
      title: `Не втрать серію: ${profile.streakDays} ${dayWord(profile.streakDays)}`,
      description: 'Зіграй сьогодні хоча б один етап, щоб серія не обнулилась.',
      subtitle: 'Серія оновлюється щодня',
      icon: '🔥',
      link: '/play',
      priority: STREAK_MAINTENANCE_PRIORITY,
    });
  }

  items.sort((a, b) => b.priority - a.priority);
  return items.slice(0, MAX_DAILY_PLAN_ITEMS);
}

function dayWord(days: number): string {
  const mod10 = days % 10;
  const mod100 = days % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'дні';
  return 'днів';
}
