/**
 * Domain types for the Content Studio prototype.
 *
 * They mirror the Phase 4 vocabulary of the master specification (draft →
 * generated → ready_for_review → approved → published → superseded) so that a
 * later implementation can map them onto `contracts/` without renaming things.
 */

export type Role = 'author' | 'reviewer' | 'admin';

/** Every permissioned operation the studio exposes. */
export type Permission =
  | 'job.run'
  | 'job.cancel'
  | 'draft.edit'
  | 'draft.repair'
  | 'review.comment'
  | 'review.approve'
  | 'content.publish'
  | 'content.rollback'
  | 'settings.write';

export type DraftStatus =
  | 'draft'
  | 'generated'
  | 'validation_failed'
  | 'ready_for_review'
  | 'changes_requested'
  | 'approved'
  | 'scheduled'
  | 'published'
  | 'superseded'
  | 'archived';

export type JobStatus =
  | 'queued'
  | 'running'
  | 'cancelled'
  | 'failed'
  | 'completed'
  | 'partial';

export type CheckSeverity = 'pass' | 'warn' | 'fail';

export type ProviderId = 'ollama' | 'gemini' | 'omniroute' | 'mock';

/** One deterministic or AI-assisted gate a draft has to clear. */
export interface Check {
  id: string;
  label: string;
  severity: CheckSeverity;
  detail: string;
  /** Deterministic checks are reproducible; AI-assisted ones are advisory. */
  kind: 'deterministic' | 'ai' | 'human';
}

export interface Comment {
  id: string;
  author: string;
  role: Role;
  at: string;
  body: string;
  resolved?: boolean;
}

/** A single field-level change between the published revision and the draft. */
export interface DiffField {
  field: string;
  before: string | null;
  after: string;
  kind: 'added' | 'changed' | 'unchanged' | 'removed';
}

export type ScriptureVerdict = 'match' | 'paraphrase' | 'mismatch' | 'not_found';

export interface ScriptureCheck {
  id: string;
  reference: string;
  normalized: string;
  translation: string;
  quoted: string;
  source: string | null;
  verdict: ScriptureVerdict;
  note: string;
  draftId?: string;
  checkedAt: string;
}

export interface Draft {
  id: string;
  kind: 'question' | 'explanation' | 'lesson' | 'topic';
  title: string;
  topicId: string;
  topicPath: string;
  status: DraftStatus;
  revision: number;
  author: string;
  provider: ProviderId;
  model: string;
  jobId: string | null;
  createdAt: string;
  updatedAt: string;
  checks: Check[];
  diff: DiffField[];
  comments: Comment[];
  scriptureIds: string[];
  /** Question payload, present for `kind: 'question'`. */
  question?: {
    prompt: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    reference: string;
    difficulty: 'easy' | 'medium' | 'hard';
  };
}

export interface JobLogLine {
  at: string;
  level: 'info' | 'warn' | 'error';
  text: string;
}

export interface Job {
  id: string;
  task: string;
  taskLabel: string;
  requester: string;
  provider: ProviderId;
  model: string;
  status: JobStatus;
  inputHash: string;
  attempts: number;
  maxAttempts: number;
  startedAt: string;
  finishedAt: string | null;
  /** Real counters only — the spec forbids fake percentage progress. */
  itemsDone: number;
  itemsTotal: number;
  step: string;
  budget: {
    requests: number;
    requestLimit: number;
    tokens: number;
    tokenLimit: number;
    costUsd: number;
    costLimitUsd: number;
  };
  checkpoint: string | null;
  retention: string;
  logs: JobLogLine[];
  resultRef: string | null;
  target: string;
}

export interface TopicNode {
  id: string;
  title: string;
  reference: string;
  children?: TopicNode[];
  pool: {
    published: number;
    inReview: number;
    target: number;
  };
  flags: string[];
  /** Share of published questions answered correctly in live play. */
  accuracy: number | null;
  updatedAt: string;
}

export interface Release {
  id: string;
  version: string;
  publishedAt: string;
  publishedBy: string;
  items: number;
  topics: string[];
  status: 'published' | 'scheduled' | 'rolled_back' | 'superseded';
  note: string;
  canRollback: boolean;
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  role: Role;
  action: string;
  target: string;
  detail: string;
  evidence: string | null;
}

export interface Provider {
  id: ProviderId;
  label: string;
  status: 'connected' | 'degraded' | 'offline' | 'not_configured';
  models: string[];
  defaultModel: string;
  envKeys: string[];
  monthly: { tokens: number; tokenLimit: number; costUsd: number; costLimitUsd: number };
  latencyMs: number | null;
  note: string;
}

export interface Prompt {
  id: string;
  name: string;
  version: string;
  updatedAt: string;
  updatedBy: string;
  usedBy: string[];
  excerpt: string;
}

export interface QualityMetric {
  id: string;
  label: string;
  value: string;
  delta: string;
  tone: 'good' | 'warn' | 'bad' | 'neutral';
  hint: string;
}
