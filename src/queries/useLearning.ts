/**
 * React Query hooks over `learningRepo` (Phase 3 WS6, spec §9-§11). Reads use
 * `queryKeys.learning.*`. Session mutations are server-authoritative (§11.4) —
 * the client only caches the returned session for the lesson-session view, it
 * does not compute progress locally.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { newRequestId } from '../lib/apiClient';
import { learningRepo } from '../repos/learningRepo';
import type { Testament } from '../../contracts/index';
import { queryKeys } from './keys';

export function useTodayView(userId: string) {
  return useQuery({
    queryKey: queryKeys.learning.today(userId),
    queryFn: () => learningRepo.getToday(),
    enabled: Boolean(userId),
    staleTime: 30_000,
  });
}

export function usePublishedPlans(testament?: Testament) {
  return useQuery({
    queryKey: queryKeys.learning.plans(testament),
    queryFn: () => learningRepo.listPlans(testament),
    staleTime: 60_000,
  });
}

export function usePlanDetail(planId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.learning.plan(planId ?? ''),
    queryFn: () => learningRepo.getPlan(planId as string),
    enabled: Boolean(planId),
    staleTime: 60_000,
  });
}

export function useModuleDetail(moduleId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.learning.module(moduleId ?? ''),
    queryFn: () => learningRepo.getModule(moduleId as string),
    enabled: Boolean(moduleId),
    staleTime: 60_000,
  });
}

export function useLessonDetail(lessonId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.learning.lesson(lessonId ?? ''),
    queryFn: () => learningRepo.getLesson(lessonId as string),
    enabled: Boolean(lessonId),
    staleTime: 60_000,
  });
}

/** `q` shorter than the server's 2-char minimum simply doesn't query (§10.2). */
export function useLearningSearch(q: string, testament?: Testament) {
  const trimmed = q.trim();
  return useQuery({
    queryKey: queryKeys.learning.search(trimmed, testament),
    queryFn: () => learningRepo.search(trimmed, { testament }),
    enabled: trimmed.length >= 2,
    staleTime: 30_000,
  });
}

export function useStartLessonSession(lessonId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => learningRepo.startLessonSession(lessonId, newRequestId()),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.learning.lesson(lessonId), data.lesson);
    },
  });
}

export function useProgressLessonSession(sessionId: string) {
  return useMutation({
    mutationFn: (checkpointBlockId: string) =>
      learningRepo.progressLessonSession(sessionId, checkpointBlockId, newRequestId()),
  });
}

export function useCompleteLessonSession(sessionId: string, userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => learningRepo.completeLessonSession(sessionId, newRequestId()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.learning.today(userId) });
    },
  });
}
