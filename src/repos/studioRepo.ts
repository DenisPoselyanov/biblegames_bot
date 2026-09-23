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
import type {
  AssessmentCriteria,
  AssessmentSubject,
  AssessmentVerdict,
} from '../lib/contentAssessment';
import type { Difficulty } from '../types';

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
  blockers: Array<{ revisionId: string; reason: 'not_validated' | 'validation_blocking' | 'scripture_unresolved' }>;
  history: StudioActivityEntry[];
  siblings: Array<{ revisionId: string; revisionNumber: number; status: ContentStatus; createdAt: string }>;
}

// --- Library + releases + settings (Phase 4 WS8c) --------------------------

export interface LibraryTheme {
  themeId: string;
  title: string;
  categoryId: string | null;
  categoryTitle: string | null;
  inCatalog: boolean;
  counts: StatusCounts;
}

export interface FindingSummary {
  revisionType: ReviewRevisionType;
  kind: string;
  severity: 'info' | 'warning' | 'blocking';
  label: string;
  revisions: number;
}

export interface LibraryResponse {
  available: boolean;
  themes: LibraryTheme[];
  findings: FindingSummary[];
}

export interface SetVersionSummary {
  setId: string;
  kind: string;
  version: number;
  contentHash: string;
  questionCount: number;
  publishedAt: string;
  publishedBy: string | null;
  isLatest: boolean;
}

export interface ReleasesResponse {
  available: boolean;
  sets: SetVersionSummary[];
  history: StudioActivityEntry[];
}

export interface SetVersionDetail {
  available: boolean;
  version: (SetVersionSummary & { latestVersion: number | null }) | null;
  items: Array<{
    position: number;
    questionId: string;
    revisionId: string;
    text: string | null;
    status: ContentStatus | null;
    themeId: string | null;
  }>;
  truncated?: boolean;
}

export interface StudioSettings {
  providers: Array<{
    id: 'gemini' | 'groq' | 'openrouter' | 'mock';
    label: string;
    model: string | null;
    selected: boolean;
    configured: boolean;
  }>;
  aiEnabled: boolean;
  jobBudget: { maxRequests?: number; maxTokens?: number; maxCostUsd?: number } | null;
  roles: Array<{ role: Role; permissions: Permission[] }>;
  permissions: Permission[];
  queueAvailable: boolean;
  promptVersions: Array<{ promptVersion: string; lastUsedAt: string; jobs: number }>;
}

// --- Quality feedback loop (Phase 4 WS9) ------------------------------------

export type AccuracyBand = 'too_hard' | 'hard' | 'normal' | 'easy' | 'too_easy';
export type ReportCategory = 'wrong_answer' | 'wording' | 'translation' | 'reference' | 'offensive' | 'technical';

export interface QualityOutlier {
  questionId: string;
  attempts: number;
  accuracy: number;
  issue: 'too_hard' | 'too_easy';
  severity: number;
  revisionId: string | null;
  text: string | null;
  themeId: string | null;
  status: ContentStatus | null;
}

export interface QualityResponse {
  available: boolean;
  analysis: {
    sampleSize: number;
    minAttempts: number;
    distribution: Array<{ band: AccuracyBand; count: number }>;
    outliers: QualityOutlier[];
    outlierTotal: number;
  } | null;
  positionBias: { picks: number; firstOptionShare: number; expectedShare: number; byPosition: number[] } | null;
  openReports: number;
}

export interface ReportGroup {
  entityType: ReviewRevisionType;
  entityId: string;
  openCount: number;
  totalCount: number;
  categories: Partial<Record<ReportCategory, number>>;
  latestRevisionId: string | null;
  firstAt: string;
  latestAt: string;
  title: string | null;
}

export interface ReviewerReport {
  id: string;
  category: ReportCategory;
  comment: string | null;
  revisionId: string | null;
  status: 'open' | 'resolved' | 'dismissed';
  createdAt: string;
  resolutionNote: string | null;
  resolvedRevisionId: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
}

export interface ReportDetail {
  entityType: ReviewRevisionType;
  entityId: string;
  title: string | null;
  reports: ReviewerReport[];
}

export interface ActivityFilter {
  action?: string;
  limit?: number;
}

const reviewPath = (type: ReviewRevisionType, id: string) =>
  `/studio/review/${type}/${encodeURIComponent(id)}`;

// --- Content quality gate: golden labels (WS11c) -----------------------------

/** Mirrors `toLabelView` in `server/routes/studioAssessments.ts`. */
export interface AssessmentLabelView {
  id: string;
  verdict: AssessmentVerdict;
  criteria: AssessmentCriteria;
  suggestedDifficulty: Difficulty | null;
  suggestedTopicNodeId: string | null;
  suggestedExplanationShort: string | null;
  suggestedExplanationDeep: string | null;
  notes: string | null;
  assessor: string;
  /** The question body changed since this label was saved. */
  stale: boolean;
  updatedAt: string;
}

export interface GoldenItem {
  index: number;
  subject: AssessmentSubject;
  findings: string[];
  label: AssessmentLabelView | null;
}

export interface GoldenResponse {
  available: boolean;
  sampleMissing?: boolean;
  seed?: string;
  items: GoldenItem[];
  progress: { labelled: number; total: number } | null;
}

export interface AssessmentLabelInput {
  verdict: AssessmentVerdict;
  criteria: AssessmentCriteria;
  suggestedDifficulty?: Difficulty | null;
  suggestedTopicNodeId?: string | null;
  suggestedExplanationShort?: string | null;
  suggestedExplanationDeep?: string | null;
  notes?: string | null;
}

export const studioRepo = {
  getGolden(): Promise<GoldenResponse> {
    return call('/studio/assessments/golden');
  },

  saveGoldenLabel(questionId: string, input: AssessmentLabelInput): Promise<{ ok: true; label: AssessmentLabelView }> {
    return call(`/studio/assessments/golden/${encodeURIComponent(questionId)}`, { method: 'PUT', body: input });
  },

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

  getActivity(filter: ActivityFilter = {}): Promise<{ activity: StudioActivityEntry[] }> {
    const qs = new URLSearchParams({ limit: String(filter.limit ?? 10) });
    if (filter.action) qs.set('action', filter.action);
    return call(`/studio/activity?${qs.toString()}`);
  },

  getLibrary(): Promise<LibraryResponse> {
    return call('/studio/library');
  },

  getReleases(): Promise<ReleasesResponse> {
    return call('/studio/releases');
  },

  getSetVersion(setId: string, version: number): Promise<SetVersionDetail> {
    return call(`/studio/releases/${encodeURIComponent(setId)}/versions/${version}`);
  },

  /** `confirmSetId` must equal `setId` — the server refuses a rollback the caller didn't explicitly confirm. */
  rollbackSet(
    setId: string,
    toVersion: number,
    confirmSetId: string,
  ): Promise<{ ok: true; version: Omit<SetVersionSummary, 'isLatest'> }> {
    return call(`/studio/releases/${encodeURIComponent(setId)}/rollback`, {
      method: 'POST',
      body: { toVersion, confirmSetId },
    });
  },

  getSettings(): Promise<StudioSettings> {
    return call('/studio/settings');
  },

  getQuality(): Promise<QualityResponse> {
    return call('/studio/quality');
  },

  repairOutlier(questionId: string): Promise<{ ok: true; jobId: string; revisionId: string }> {
    return call(`/studio/quality/outliers/${encodeURIComponent(questionId)}/repair`, { method: 'POST', body: {} });
  },

  listReportGroups(includeClosed = false): Promise<{ available: boolean; groups: ReportGroup[] }> {
    return call(`/studio/quality/reports${includeClosed ? '?closed=1' : ''}`);
  },

  getReportDetail(type: ReviewRevisionType, entityId: string): Promise<ReportDetail> {
    return call(`/studio/quality/reports/${type}/${encodeURIComponent(entityId)}`);
  },

  resolveReports(
    type: ReviewRevisionType,
    entityId: string,
    input: { status: 'resolved' | 'dismissed'; note?: string; revisionId?: string },
  ): Promise<{ ok: true; closed: number }> {
    return call(`/studio/quality/reports/${type}/${encodeURIComponent(entityId)}/resolve`, {
      method: 'POST',
      body: input,
    });
  },

  repairFromReports(entityId: string): Promise<{ ok: true; jobId: string; revisionId: string }> {
    return call(`/studio/quality/reports/question/${encodeURIComponent(entityId)}/repair`, { method: 'POST', body: {} });
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
