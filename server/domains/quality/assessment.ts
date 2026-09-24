/**
 * Question assessments (content quality gate, layers 2–3). One record = one
 * judgement of one question body, from one of two sources:
 *
 * - `golden` — the owner's hand label (the ~200-item calibration set). At most
 *   one per question; relabelling replaces it.
 * - `ai` — the AI reviewer's verdict. Append-only history; the newest one per
 *   question is the one that counts. A reviewer's decision on it (accept /
 *   override / dismiss) is recorded on the row, never by editing the verdict.
 *
 * An assessment binds to a body by `contentHash`, not a revision id: the
 * legacy bank is still files (`data/question-db`), and the same hash identifies
 * the body once it is imported as a revision. If the body changes, the old
 * assessment is simply stale.
 *
 * Assessments never change content (§22). Applying accepted decisions to the
 * bank is a separate, explicit step (`npm run ai -- apply-review-decisions`).
 */
import type { Difficulty } from '../../../contracts/index';
import type {
  AssessmentCriteria,
  AssessmentDecision,
  AssessmentSubject,
  AssessmentVerdict,
} from '../../../src/lib/contentAssessment';
import type { Transaction } from '../shared/context';

export type AssessmentSource = 'golden' | 'ai';

export interface QuestionAssessment {
  id: string;
  questionId: string;
  contentHash: string;
  source: AssessmentSource;
  /** User id for `golden`, `provider:model` for `ai`. */
  assessor: string;
  rubricVersion: string;
  verdict: AssessmentVerdict;
  criteria: AssessmentCriteria;
  suggestedDifficulty: Difficulty | null;
  /** A better theme for a misfiled question (`topic_fit` failed). */
  suggestedThemeId: string | null;
  suggestedTopicNodeId: string | null;
  suggestedExplanationShort: string | null;
  suggestedExplanationDeep: string | null;
  notes: string | null;
  /** 0–1, AI only. */
  confidence: number | null;
  /** `assessmentRisk()` at write time — player signals are added on read. */
  risk: number;
  subject: AssessmentSubject;
  /** Provider/model/usage/verse evidence — never shown raw to players. */
  meta: Record<string, unknown>;
  decision: AssessmentDecision | null;
  decisionNote: string | null;
  /** What the reviewer applied instead, when `overridden` (e.g. a different level). */
  decisionPatch: AssessmentPatch | null;
  decidedBy: string | null;
  decidedAt: string | null;
  /** Set once `apply-review-decisions` has written the decision into the bank. */
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** The content change a decision applies — a subset of the question body. */
export interface AssessmentPatch {
  difficulty?: Difficulty;
  themeId?: string;
  topicNodeId?: string | null;
  explanationShort?: string;
  explanationDeep?: string;
  /** `true` = take the question out of play. */
  exclude?: boolean;
}

export type NewAssessment = Omit<
  QuestionAssessment,
  'id' | 'decision' | 'decisionNote' | 'decisionPatch' | 'decidedBy' | 'decidedAt' | 'appliedAt' | 'createdAt' | 'updatedAt'
>;

export interface AssessmentQueueFilter {
  /** Default: every AI verdict except `pass`. */
  verdicts?: AssessmentVerdict[];
  /** `undecided` (default) | `decided` | `all`. */
  decided?: 'undecided' | 'decided' | 'all';
  /** Accepted/overridden decisions not yet applied to the bank. */
  unappliedOnly?: boolean;
  themeId?: string;
  questionIds?: readonly string[];
  limit?: number;
  offset?: number;
}

export interface AssessmentDecisionInput {
  ids: readonly string[];
  decision: AssessmentDecision;
  decidedBy: string;
  note?: string | null;
  patch?: AssessmentPatch | null;
}

export interface AssessmentSummary {
  ai: {
    total: number;
    byVerdict: Partial<Record<AssessmentVerdict, number>>;
    undecided: number;
    decidedUnapplied: number;
  };
  golden: { total: number };
}

export interface AssessmentRepository {
  /** Insert or replace the owner's label for one question (one golden label per question). */
  upsertGolden(input: NewAssessment, tx?: Transaction): Promise<QuestionAssessment>;
  /** Append an AI verdict (history is kept; the newest per question wins). */
  addAi(input: NewAssessment, tx?: Transaction): Promise<QuestionAssessment>;
  getById(id: string, tx?: Transaction): Promise<QuestionAssessment | null>;
  listGolden(tx?: Transaction): Promise<QuestionAssessment[]>;
  /** Newest AI assessment per question, optionally for some questions only. */
  latestAi(options?: { questionIds?: readonly string[] }, tx?: Transaction): Promise<QuestionAssessment[]>;
  /** `${questionId}:${contentHash}` of every AI assessment made with this rubric version — for resumable runs. */
  aiKeys(rubricVersion: string, tx?: Transaction): Promise<Set<string>>;
  /** The review queue: newest AI assessment per question, highest risk first. */
  queue(filter?: AssessmentQueueFilter, tx?: Transaction): Promise<{ items: QuestionAssessment[]; total: number }>;
  /** Record a reviewer decision on several AI assessments at once; returns how many changed. */
  decide(input: AssessmentDecisionInput, tx?: Transaction): Promise<number>;
  markApplied(ids: readonly string[], at: string, tx?: Transaction): Promise<number>;
  summary(tx?: Transaction): Promise<AssessmentSummary>;
}

export const ASSESSMENT_QUEUE_DEFAULT_LIMIT = 50;
export const ASSESSMENT_QUEUE_MAX_LIMIT = 500;

export function boundedQueueLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit) || (limit ?? 0) <= 0) return ASSESSMENT_QUEUE_DEFAULT_LIMIT;
  return Math.min(Math.floor(limit as number), ASSESSMENT_QUEUE_MAX_LIMIT);
}

/** Highest risk first, then newest, then id — identical in every adapter. */
export function compareQueue(a: QuestionAssessment, b: QuestionAssessment): number {
  if (a.risk !== b.risk) return b.risk - a.risk;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Newest-wins key for "latest AI assessment per question". */
export function isNewer(a: QuestionAssessment, b: QuestionAssessment): boolean {
  return a.createdAt > b.createdAt || (a.createdAt === b.createdAt && a.id > b.id);
}

export function matchesQueueFilter(a: QuestionAssessment, filter: AssessmentQueueFilter): boolean {
  const verdicts = filter.verdicts ?? ['reclassify', 'repair', 'reject'];
  if (!verdicts.includes(a.verdict)) return false;
  const decided = filter.decided ?? 'undecided';
  if (decided === 'undecided' && a.decision) return false;
  if (decided === 'decided' && !a.decision) return false;
  if (filter.unappliedOnly && (a.appliedAt || !a.decision || a.decision === 'dismissed')) return false;
  if (filter.themeId && a.subject.themeId !== filter.themeId) return false;
  if (filter.questionIds && !filter.questionIds.includes(a.questionId)) return false;
  return true;
}
