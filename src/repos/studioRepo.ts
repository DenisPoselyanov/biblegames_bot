/**
 * Client for `/api/v1/studio/*` and the identity fields on `/api/v1/me`
 * (Phase 4 WS8a). Same shape as `src/repos/learningRepo.ts` — every method
 * throws `StudioError` on a non-2xx response.
 *
 * Response shapes here mirror the server DTOs in `server/routes/studio.ts`
 * (`StudioJobSummary`/`StudioJobDetail`) by hand — kept in sync manually,
 * same as `src/pages/studio/lib/rbac.ts` mirrors `server/authz/roles.ts`.
 */
import { ApiError, apiRequest, type ApiRequestOptions } from '../lib/apiClient';
import type { Permission, Role } from '../pages/studio/lib/rbac';

export class StudioError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(source: ApiError) {
    super(source.message);
    this.name = 'StudioError';
    this.code = source.code;
    this.status = source.status;
  }
}

async function call<T>(path: string, opts?: ApiRequestOptions<T>): Promise<T> {
  try {
    return await apiRequest<T>(path, opts);
  } catch (err) {
    if (err instanceof ApiError) throw new StudioError(err);
    throw err;
  }
}

export interface MyIdentity {
  userId: string;
  displayName: string;
  roles: Role[];
  permissions: Permission[];
}

export type JobStatus = 'pending' | 'active' | 'completed' | 'retry' | 'failed' | 'cancelled';

export interface StudioJobSummary {
  id: string;
  type: string;
  typeLabel: string;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  label: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
}

export interface StudioJobDetail extends StudioJobSummary {
  usage: { requests: number; tokens: number; costUsd: number } | null;
  budget: { maxRequests?: number; maxTokens?: number; maxCostUsd?: number } | null;
  artifactKey: string | null;
}

export interface StudioActivityEntry {
  at: string;
  actor: { userId: string | null; authSource: string | null };
  action: string;
  target?: string;
  result: 'ok' | 'denied' | 'error';
  metadata?: Record<string, unknown>;
}

export interface StudioDashboard {
  jobs: { byStatus: Record<JobStatus, number>; types: string[] } | null;
  activity: StudioActivityEntry[];
}

export const studioRepo = {
  getMyIdentity(): Promise<MyIdentity> {
    return call<MyIdentity>('/me');
  },

  listJobs(status?: JobStatus): Promise<{ available: boolean; jobs: StudioJobSummary[] }> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return call(`/studio/jobs${qs}`);
  },

  getJob(id: string): Promise<{ available: boolean; job: StudioJobDetail | null }> {
    return call(`/studio/jobs/${encodeURIComponent(id)}`);
  },

  createJob(input: { promptVersion: string; prompt: string; label?: string }): Promise<{ ok: true; id: string }> {
    return call('/studio/jobs', { method: 'POST', body: input });
  },

  cancelJob(id: string): Promise<{ ok: true; job: StudioJobDetail | null }> {
    return call(`/studio/jobs/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
  },

  getActivity(limit = 10): Promise<{ activity: StudioActivityEntry[] }> {
    return call(`/studio/activity?limit=${limit}`);
  },

  getDashboard(): Promise<StudioDashboard> {
    return call('/studio/dashboard');
  },
};
