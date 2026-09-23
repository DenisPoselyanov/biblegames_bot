/**
 * React Query hooks over `studioRepo` (Phase 4 WS8a). One place so the
 * Sidebar's job badge and the Jobs/Dashboard screens share the same cache
 * entries instead of each issuing their own fetch.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  studioRepo,
  type ContentStatus,
  type JobStatus,
  type ReviewRevisionType,
} from '../../../repos/studioRepo';
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

// --- Review queue + editor (Phase 4 WS8b) ----------------------------------

/** Review data changes only when a person acts — refresh far less often than jobs. */
const REVIEW_REFRESH_MS = 30_000;

export function useReviewQueueQuery(statuses?: readonly ContentStatus[]) {
  return useQuery({
    queryKey: queryKeys.studio.review(statuses?.join(',')),
    queryFn: () => studioRepo.listReviewQueue(statuses),
    refetchInterval: REVIEW_REFRESH_MS,
  });
}

export function useReviewDetailQuery(type: ReviewRevisionType | undefined, revisionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.studio.reviewItem(type ?? '', revisionId ?? ''),
    queryFn: () => studioRepo.getReviewDetail(type as ReviewRevisionType, revisionId as string),
    enabled: Boolean(type && revisionId),
  });
}

/** Every review write invalidates the whole studio cache — queue counts, the item, and the dashboard's activity feed. */
function useStudioWrite<TInput, TResult>(mutationFn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.studio.root() });
    },
  });
}

export function useApproveMutation() {
  return useStudioWrite((input: { type: ReviewRevisionType; id: string }) =>
    studioRepo.approveRevision(input.type, input.id),
  );
}

export function useRequestChangesMutation() {
  return useStudioWrite((input: { type: ReviewRevisionType; id: string; comment: string }) =>
    studioRepo.requestChanges(input.type, input.id, input.comment),
  );
}

export function usePublishMutation() {
  return useStudioWrite((input: { type: ReviewRevisionType; id: string; confirmRevisionId: string }) =>
    studioRepo.publishRevision(input.type, input.id, input.confirmRevisionId),
  );
}

export function useScriptureDecisionMutation() {
  return useStudioWrite((input: { evidenceId: string; decision: 'accepted' | 'rejected' }) =>
    studioRepo.decideScripture(input.evidenceId, input.decision),
  );
}
