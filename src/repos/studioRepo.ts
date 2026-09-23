/**
 * Client for `/api/v1/studio/*` and the identity fields on `/api/v1/me`
 * (Phase 4 WS8a). Same shape as `src/repos/learningRepo.ts` — every method
 * throws `StudioError` on a non-2xx response.
 *
 * Response shapes here mirror the server DTOs in `server/routes/studio.ts`
 * (`StudioJobSummary`/`StudioJobDetail`) and `server/services/contentReviewWorkflow.ts`
 * (`ReviewQueueItem`/`ReviewDetail`, WS8b) by hand — kept in sync manually,
 * same as `src/pages/studio/lib/rbac.ts` mirrors `server/authz/roles.ts`.
 */
import type { ContentStatus } from '@contracts';
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

// --- Review queue + editor (Phase 4 WS8b) ---------------------------------

export type { ContentStatus };
export type ReviewRevisionType = 'question' | 'lesson';
export type ReviewDecision = 'approved' | 'changes_requested';
export type StatusCounts = Record<ContentStatus, number>;

export interface ReviewDecisionRecord {
  decision: ReviewDecision;
  at: string;
  actorUserId: string | null;
  comment: string | null;
}

export interface ReviewQueueItem {
  revisionType: ReviewRevisionType;
  revisionId: string;
  entityId: string;
  revisionNumber: number;
  status: ContentStatus;
  title: string;
  context: string;
  source: string;
  createdAt: string;
  createdBy: string | null;
  findings: { blocking: number; warning: number; info: number; scriptureUnresolved: number };
  topProblem: { severity: 'blocking' | 'warning'; label: string; detail: string } | null;
  decision: ReviewDecisionRecord | null;
}

export interface ReviewQueueResponse {
  available: boolean;
  items: ReviewQueueItem[];
  counts: Record<ReviewRevisionType, StatusCounts> | null;
}

export interface ValidationFinding {
  id: string;
  kind: string;
  severity: 'info' | 'warning' | 'blocking';
  label: string;
  detail: string;
  checkedAt: string;
}

export interface ScriptureEvidence {
  id: string;
  rawReference: string;
  translation: string;
  verdict: 'match' | 'paraphrase' | 'mismatch' | 'not_found';
  quotedText: string | null;
  sourceText: string | null;
  retrievedAt: string;
  reviewerDecision: 'accepted' | 'rejected' | null;
}

export interface QuestionRevision {
  id: string;
  questionId: string;
  revisionNumber: number;
  status: ContentStatus;
  themeId: string;
  difficulty: string;
  topicPath: string | null;
  text: string;
  options: string[];
  correctIndex: number;
  explanationShort: string | null;
  explanationDeep: string | null;
  reference: string | null;
  tags: string[];
  source: string;
  createdAt: string;
  createdBy: string | null;
}

export interface LessonRevision {
  id: string;
  lessonId: string;
  revisionNumber: number;
  status: ContentStatus;
  planId: string;
  moduleId: string;
  objectiveId: string;
  title: string;
  description: string | null;
  blocks: Array<{ id: string; blockType: string; schemaVersion: number; payload: Record<string, unknown> }>;
  source: string;
  createdAt: string;
  createdBy: string | null;
}

export interface ReviewDetail {
  item: ReviewQueueItem;
  revision:
    | { revisionType: 'question'; record: QuestionRevision }
    | { revisionType: 'lesson'; record: LessonRevision };
  baseline: { revisionId: string; revisionNumber: number; status: ContentStatus } | null;
  diff: Array<{ field: string; before: unknown; after: unknown }>;
  findings: ValidationFinding[];
  scripture: ScriptureEvidence[];
  blockers: Array<{ revisionId: string; reason: 'validation_blocking' | 'scripture_unresolved' }>;
  history: StudioActivityEntry[];
  siblings: Array<{ revisionId: string; revisionNumber: number; status: ContentStatus; createdAt: string }>;
}

const reviewPath = (type: ReviewRevisionType, id: string) =>
  `/studio/review/${type}/${encodeURIComponent(id)}`;

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

  listReviewQueue(statuses?: readonly ContentStatus[]): Promise<ReviewQueueResponse> {
    const qs = statuses && statuses.length ? `?status=${encodeURIComponent(statuses.join(','))}` : '';
    return call(`/studio/review${qs}`);
  },

  getReviewDetail(
    type: ReviewRevisionType,
    id: string,
  ): Promise<{ available: boolean; detail: ReviewDetail | null }> {
    return call(reviewPath(type, id));
  },

  approveRevision(type: ReviewRevisionType, id: string): Promise<{ ok: true; decision: ReviewDecisionRecord }> {
    return call(`${reviewPath(type, id)}/approve`, { method: 'POST', body: {} });
  },

  requestChanges(
    type: ReviewRevisionType,
    id: string,
    comment: string,
  ): Promise<{ ok: true; decision: ReviewDecisionRecord }> {
    return call(`${reviewPath(type, id)}/request-changes`, { method: 'POST', body: { comment } });
  },

  /** `confirmRevisionId` must equal `id` — the server refuses a publish the caller didn't explicitly confirm. */
  publishRevision(
    type: ReviewRevisionType,
    id: string,
    confirmRevisionId: string,
  ): Promise<{ ok: true; revisionId: string; status: ContentStatus }> {
    return call(`${reviewPath(type, id)}/publish`, { method: 'POST', body: { confirmRevisionId } });
  },

  decideScripture(
    evidenceId: string,
    decision: 'accepted' | 'rejected',
  ): Promise<{ ok: true; evidence: ScriptureEvidence }> {
    return call(`/studio/review/scripture/${encodeURIComponent(evidenceId)}/decision`, {
      method: 'POST',
      body: { decision },
    });
  },
};
