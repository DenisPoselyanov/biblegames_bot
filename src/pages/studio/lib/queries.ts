/**
 * React Query hooks over `studioRepo` (Phase 4 WS8a). One place so the
 * Sidebar's job badge and the Jobs/Dashboard screens share the same cache
 * entries instead of each issuing their own fetch.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { studioRepo, type JobStatus } from '../../../repos/studioRepo';
import { queryKeys } from '../../../queries/keys';

const REFRESH_MS = 10_000;

export function useDashboardQuery() {
  return useQuery({
    queryKey: queryKeys.studio.dashboard(),
    queryFn: () => studioRepo.getDashboard(),
    refetchInterval: REFRESH_MS,
  });
}

export function useJobsQuery(status?: JobStatus) {
  return useQuery({
    queryKey: queryKeys.studio.jobs(status),
    queryFn: () => studioRepo.listJobs(status),
    refetchInterval: REFRESH_MS,
  });
}

export function useJobQuery(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.studio.job(id ?? ''),
    queryFn: () => studioRepo.getJob(id as string),
    enabled: Boolean(id),
    refetchInterval: REFRESH_MS,
  });
}

export function useCreateJobMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { promptVersion: string; prompt: string; label?: string }) =>
      studioRepo.createJob(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.studio.root() });
    },
  });
}

export function useCancelJobMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => studioRepo.cancelJob(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.studio.root() });
    },
  });
}
