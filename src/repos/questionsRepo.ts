import type { Difficulty, PracticeTrackProgress, Question } from '../types';
import { apiUrl, hasApi } from './apiClient';
import {
  getQuestionsByIdsOrdered,
  getQuestionsForCategoryAsync,
  getQuestionsForCategoryStageAsync,
  getQuestionsForLevelAsync,
  getQuestionsForNodeAsync,
  getQuestionsForNodeStageAsync,
  getQuestionsForStageAsync,
  getQuestionCountByCategoryAsync,
  getQuestionCountByDifficultyAsync,
  getQuestionCountForNodeAsync,
  type PracticePickOptions,
} from '../data/questions';
import type { TopicNode } from '../types';

export type FetchQuestionsParams = {
  themeId?: string;
  themeIds?: string[];
  difficulty: Difficulty;
  topicNodeId?: string;
  nodeId?: string | null;
  count?: number;
  excludeIds?: string[];
  seed?: string;
  stageIndex?: number;
  practiceTrack?: PracticeTrackProgress;
  pickOptions?: PracticePickOptions;
};

async function apiGet<T>(path: string): Promise<T | null> {
  if (!hasApi()) return null;
  try {
    const res = await fetch(apiUrl(path));
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchQuestionsForSession(
  params: FetchQuestionsParams,
): Promise<Question[]> {
  if (hasApi()) {
    const qs = new URLSearchParams();
    qs.set('difficulty', params.difficulty);
    if (params.themeId) qs.set('themeId', params.themeId);
    if (params.themeIds?.length) qs.set('themeIds', params.themeIds.join(','));
    const node = params.topicNodeId ?? params.nodeId;
    if (node) {
      qs.set('topicNodeId', node);
      qs.set('nodeId', node);
    }
    if (params.count != null) qs.set('count', String(params.count));
    if (params.excludeIds?.length) qs.set('excludeIds', params.excludeIds.join(','));
    if (params.seed) qs.set('seed', params.seed);
    if (params.stageIndex != null) qs.set('stageIndex', String(params.stageIndex));
    if (params.practiceTrack) {
      qs.set('practiceTrack', JSON.stringify(params.practiceTrack));
    } else if (params.pickOptions?.practiceTrack) {
      qs.set('practiceTrack', JSON.stringify(params.pickOptions.practiceTrack));
    }
    const body = await apiGet<{ questions: Question[] }>(`/api/questions?${qs}`);
    if (body?.questions?.length) return body.questions;
  }

  return fetchQuestionsLocal(params);
}

async function fetchQuestionsLocal(params: FetchQuestionsParams): Promise<Question[]> {
  const count = params.count ?? 10;
  const pickOptions = params.pickOptions;
  const stageIndex = params.stageIndex;
  const isStage = stageIndex != null && Number.isFinite(stageIndex);
  const nodeId = params.topicNodeId ?? params.nodeId;

  if (nodeId && params.topicNodeId && params.themeId) {
    const { loadAllTopicHierarchies, findRootByThemeId } = await import('../data/topicDbLoader');
    const hierarchies = await loadAllTopicHierarchies();
    const root = findRootByThemeId(hierarchies, params.themeId);
    if (root) {
      if (isStage) {
        return getQuestionsForNodeStageAsync(
          nodeId,
          root,
          params.difficulty,
          stageIndex!,
          count,
          false,
          false,
          pickOptions,
        );
      }
      return getQuestionsForNodeAsync(
        nodeId,
        root,
        params.difficulty,
        count,
        false,
        false,
        pickOptions,
      );
    }
  }

  if (params.themeIds?.length) {
    if (isStage) {
      return getQuestionsForCategoryStageAsync(
        params.themeIds,
        params.difficulty,
        stageIndex!,
        count,
        pickOptions,
      );
    }
    return getQuestionsForCategoryAsync(
      params.themeIds[0] ?? '',
      params.themeIds,
      params.difficulty,
      count,
      pickOptions,
    );
  }

  if (params.themeId) {
    if (isStage) {
      return getQuestionsForStageAsync(
        params.themeId,
        params.difficulty,
        stageIndex!,
        count,
        pickOptions,
      );
    }
    return getQuestionsForLevelAsync(params.themeId, params.difficulty, count, pickOptions);
  }

  return [];
}

export async function fetchQuestionsByIds(ids: string[]): Promise<Question[]> {
  if (!ids.length) return [];
  if (hasApi()) {
    const qs = new URLSearchParams({ ids: ids.join(',') });
    const body = await apiGet<{ questions: Question[] }>(`/api/questions/by-ids?${qs}`);
    if (body?.questions?.length) return body.questions;
  }
  return getQuestionsByIdsOrdered(ids);
}

export async function fetchQuestionCounts(params: {
  themeId?: string;
  themeIds?: string[];
  topicNodeId?: string;
}): Promise<Record<Difficulty, number> | null> {
  if (hasApi()) {
    const qs = new URLSearchParams();
    if (params.themeId) qs.set('themeId', params.themeId);
    if (params.themeIds?.length) qs.set('themeIds', params.themeIds.join(','));
    if (params.topicNodeId) qs.set('topicNodeId', params.topicNodeId);
    const body = await apiGet<{ counts: Record<Difficulty, number> }>(
      `/api/questions/counts?${qs}`,
    );
    if (body?.counts) return body.counts;
  }
  return null;
}

export async function fetchQuestionCountByDifficulty(
  themeId: string,
  difficulty: Difficulty,
): Promise<number> {
  const counts = await fetchQuestionCounts({ themeId });
  if (counts) return counts[difficulty] ?? 0;
  return getQuestionCountByDifficultyAsync(themeId, difficulty);
}

export async function fetchQuestionCountByCategory(
  themeIds: string[],
  difficulty: Difficulty,
): Promise<number> {
  const counts = await fetchQuestionCounts({ themeIds });
  if (counts) return counts[difficulty] ?? 0;
  return getQuestionCountByCategoryAsync(themeIds, difficulty);
}

export async function fetchQuestionCountForNode(
  nodeId: string,
  hierarchy: TopicNode,
  difficulty: Difficulty,
  themeId: string,
): Promise<number> {
  const counts = await fetchQuestionCounts({ themeId, topicNodeId: nodeId });
  if (counts) return counts[difficulty] ?? 0;
  return getQuestionCountForNodeAsync(nodeId, hierarchy, difficulty);
}

export async function fetchReviewQuestions(wrongIds: string[]): Promise<Question[]> {
  if (!wrongIds.length) return [];
  return fetchQuestionsByIds(wrongIds);
}
