/**
 * Review queue + review editor read model and decisions (Phase 4 WS8b, spec
 * §10 / §23.9).
 *
 * ADR-019 §1 keeps `ContentStatus` 6-state: `approved`/`changes_requested` are
 * not persisted statuses but a reviewer's `content.review_decision` audit event
 * targeting the revision id. Revisions are immutable, so a decision on a
 * revision id never goes stale — a changed draft is a new revision with no
 * decision yet. The latest decision per revision is therefore read back from
 * the audit log, the same log that records it.
 *
 * Publishing still goes through `contentPublicationService` (the WS6 gate);
 * this module only adds the "must be approved first" precondition in front of
 * it, so the review editor can never publish a revision nobody approved.
 */
import type { ContentStatus } from '../../contracts/index';
import type { AuditActor, AuditLog, AuditRecord } from '../audit';
import { buildAuditRecord } from '../audit';
import { diffQuestionRevisions } from '../domains/content/diff';
import type { ContentRepositories } from '../domains/content/repository';
import type { QuestionRevisionRecord } from '../domains/content/types';
import { diffLessonRevisions } from '../domains/learning/diff';
import type { LearningRepositories } from '../domains/learning/repository';
import type { LessonRevisionRecord } from '../domains/learning/types';
import type { FieldDiff } from '../domains/shared/revisionDiff';
import {
  compareNewestFirst,
  type RevisionStatusCounts,
} from '../domains/shared/revisionStatusFilter';
import type { ScriptureEvidenceRecord } from '../domains/shared/scriptureEvidence';
import type { ValidationFinding } from '../domains/shared/validationFindings';
import { AppError } from '../lib/errors';
import {
  createContentPublicationService,
  findBlockers,
  type ContentPublicationGates,
  type PublicationBlocker,
} from './contentPublicationService';

export type ReviewRevisionType = 'question' | 'lesson';
export type ReviewDecision = 'approved' | 'changes_requested';

/** Statuses a reviewer can still act on — everything before publish/quarantine/archive. */
export const REVIEWABLE_STATUSES: readonly ContentStatus[] = [
  'legacy_unreviewed',
  'draft',
  'ready_for_review',
];
/** What the queue shows when no status filter is given: work produced for review, not the legacy backlog. */
export const DEFAULT_QUEUE_STATUSES: readonly ContentStatus[] = ['draft', 'ready_for_review'];

export const REVIEW_DECISION_ACTION = 'content.review_decision';
/** How far back the queue looks for decisions in one audit read (newest-first). */
const DECISION_SCAN_LIMIT = 1000;
/** `redactAuditMetadata` truncates strings at 500 chars — cap here so nothing is silently cut. */
const COMMENT_MAX = 500;

export interface ReviewDecisionRecord {
  decision: ReviewDecision;
  at: string;
  actorUserId: string | null;
  comment: string | null;
}

export interface ReviewFindingSummary {
  blocking: number;
  warning: number;
  info: number;
  scriptureUnresolved: number;
}

export interface ReviewQueueItem {
  revisionType: ReviewRevisionType;
  revisionId: string;
  /** `questionId` or `lessonId`. */
  entityId: string;
  revisionNumber: number;
  status: ContentStatus;
  /** Question text or lesson title. */
  title: string;
  /** Topic path/theme (question) or plan › module (lesson). */
  context: string;
  source: string;
  createdAt: string;
  createdBy: string | null;
  findings: ReviewFindingSummary;
  /** The single most important reason this row needs a human, or `null` when every check passed. */
  topProblem: { severity: 'blocking' | 'warning'; label: string; detail: string } | null;
  decision: ReviewDecisionRecord | null;
}

export interface ReviewQueue {
  items: ReviewQueueItem[];
  counts: Record<ReviewRevisionType, RevisionStatusCounts>;
}

export interface ReviewDetail {
  item: ReviewQueueItem;
  revision:
    | { revisionType: 'question'; record: QuestionRevisionRecord }
    | { revisionType: 'lesson'; record: LessonRevisionRecord };
  /** What the diff compares against: the published revision, else the previous one; `null` for a first revision. */
  baseline: { revisionId: string; revisionNumber: number; status: ContentStatus } | null;
  diff: FieldDiff[];
  findings: ValidationFinding[];
  scripture: ScriptureEvidenceRecord[];
  blockers: PublicationBlocker[];
  /** Decisions + publish events on this revision, newest first. */
  history: AuditRecord[];
  /** Sibling revisions of the same question/lesson, newest first. */
  siblings: Array<{ revisionId: string; revisionNumber: number; status: ContentStatus; createdAt: string }>;
}

export class ContentApprovalBlockedError extends AppError {
  readonly blockers: PublicationBlocker[];
  constructor(blockers: PublicationBlocker[]) {
    super(
      'content_approve_blocked',
      `${blockers.length} unresolved blocker(s) — resolve them before approving`,
      409,
    );
    this.name = 'ContentApprovalBlockedError';
    this.blockers = blockers;
  }
}

type AnyRevision = QuestionRevisionRecord | LessonRevisionRecord;

function entityIdOf(type: ReviewRevisionType, r: AnyRevision): string {
  return type === 'question'
    ? (r as QuestionRevisionRecord).questionId
    : (r as LessonRevisionRecord).lessonId;
}

function titleOf(type: ReviewRevisionType, r: AnyRevision): string {
  return type === 'question' ? (r as QuestionRevisionRecord).text : (r as LessonRevisionRecord).title;
}

function contextOf(type: ReviewRevisionType, r: AnyRevision): string {
  if (type === 'question') {
    const q = r as QuestionRevisionRecord;
    return q.topicPath ?? q.themeId;
  }
  const l = r as LessonRevisionRecord;
  return `${l.planId} › ${l.moduleId}`;
}

function toDecision(record: AuditRecord): ReviewDecisionRecord | null {
  const decision = record.metadata?.decision;
  if (decision !== 'approved' && decision !== 'changes_requested') return null;
  if (record.result !== 'ok') return null;
  const comment = record.metadata?.comment;
  return {
    decision,
    at: record.at,
    actorUserId: record.actor.userId,
    comment: typeof comment === 'string' ? comment : null,
  };
}

const VERDICT_LABEL: Record<ScriptureEvidenceRecord['verdict'], string> = {
  match: 'збіг',
  paraphrase: 'переказ, чекає рішення рецензента',
  mismatch: 'текст не збігається з перекладом',
  not_found: 'вірша не знайдено',
};

function summarize(
  findings: ValidationFinding[],
  scripture: ScriptureEvidenceRecord[],
): Pick<ReviewQueueItem, 'findings' | 'topProblem'> {
  const count = (s: ValidationFinding['severity']) => findings.filter((f) => f.severity === s).length;
  const unresolved = scripture.filter(
    (e) =>
      e.verdict === 'mismatch' ||
      e.verdict === 'not_found' ||
      (e.verdict === 'paraphrase' && e.reviewerDecision !== 'accepted'),
  );
  const blocking = findings.find((f) => f.severity === 'blocking');
  const warning = findings.find((f) => f.severity === 'warning');
  const topProblem = blocking
    ? { severity: 'blocking' as const, label: blocking.label, detail: blocking.detail }
    : unresolved[0]
      ? {
          severity: 'blocking' as const,
          label: 'Писання не підтверджено',
          detail: `${unresolved[0].rawReference} — ${
            unresolved[0].verdict === 'paraphrase' && unresolved[0].reviewerDecision === 'rejected'
              ? 'переказ відхилено рецензентом'
              : VERDICT_LABEL[unresolved[0].verdict]
          }`,
        }
      : warning
        ? { severity: 'warning' as const, label: warning.label, detail: warning.detail }
        : null;
  return {
    findings: {
      blocking: count('blocking'),
      warning: count('warning'),
      info: count('info'),
      scriptureUnresolved: unresolved.length,
    },
    topProblem,
  };
}

export interface ContentReviewWorkflowDeps {
  content: ContentRepositories;
  learning: LearningRepositories;
  gates: ContentPublicationGates;
  auditLog: AuditLog;
}

export interface ContentReviewWorkflow {
  listQueue(input: {
    type?: ReviewRevisionType;
    statuses?: readonly ContentStatus[];
    limit?: number;
  }): Promise<ReviewQueue>;
  getDetail(type: ReviewRevisionType, revisionId: string): Promise<ReviewDetail | null>;
  decide(
    type: ReviewRevisionType,
    revisionId: string,
    decision: ReviewDecision,
    actor: AuditActor,
    opts?: { comment?: string | null; requestId?: string },
  ): Promise<ReviewDecisionRecord>;
  /** Publishes an approved revision through the WS6 gate; refuses one with no standing approval. */
  publish(
    type: ReviewRevisionType,
    revisionId: string,
    actor: AuditActor,
    requestId?: string,
  ): Promise<AnyRevision>;
}

export function createContentReviewWorkflow(deps: ContentReviewWorkflowDeps): ContentReviewWorkflow {
  const getRevision = (type: ReviewRevisionType, id: string): Promise<AnyRevision | null> =>
    type === 'question' ? deps.content.revisions.getById(id) : deps.learning.lessonRevisions.getById(id);

  const latestDecisionFor = async (revisionId: string): Promise<ReviewDecisionRecord | null> => {
    const records = await deps.auditLog.query({ action: REVIEW_DECISION_ACTION, target: revisionId, limit: 20 });
    for (const r of records) {
      const d = toDecision(r);
      if (d) return d;
    }
    return null;
  };

  const toItem = async (
    type: ReviewRevisionType,
    r: AnyRevision,
    decision: ReviewDecisionRecord | null,
  ): Promise<ReviewQueueItem> => {
    const [findings, scripture] = await Promise.all([
      deps.gates.findings.listFor(type, r.id),
      deps.gates.scripture.listFor(type, r.id),
    ]);
    return {
      revisionType: type,
      revisionId: r.id,
      entityId: entityIdOf(type, r),
      revisionNumber: r.revisionNumber,
      status: r.status,
      title: titleOf(type, r),
      context: contextOf(type, r),
      source: r.source,
      createdAt: r.createdAt,
      createdBy: r.createdBy,
      ...summarize(findings, scripture),
      decision,
    };
  };

  return {
    async listQueue({ type, statuses, limit }) {
      const wanted = statuses && statuses.length ? statuses : DEFAULT_QUEUE_STATUSES;
      const filter = { statuses: wanted, limit };
      const [questions, lessons, questionCounts, lessonCounts, decisionLog] = await Promise.all([
        type === 'lesson' ? Promise.resolve([]) : deps.content.revisions.listByStatus(filter),
        type === 'question' ? Promise.resolve([]) : deps.learning.lessonRevisions.listByStatus(filter),
        deps.content.revisions.countByStatus(),
        deps.learning.lessonRevisions.countByStatus(),
        deps.auditLog.query({ action: REVIEW_DECISION_ACTION, limit: DECISION_SCAN_LIMIT }),
      ]);

      // Newest-first log: the first decision seen per target is the standing one.
      const decisions = new Map<string, ReviewDecisionRecord>();
      for (const record of decisionLog) {
        if (!record.target || decisions.has(record.target)) continue;
        const d = toDecision(record);
        if (d) decisions.set(record.target, d);
      }

      const merged: Array<{ type: ReviewRevisionType; r: AnyRevision }> = [
        ...questions.map((r) => ({ type: 'question' as const, r })),
        ...lessons.map((r) => ({ type: 'lesson' as const, r })),
      ]
        .sort((a, b) => compareNewestFirst(a.r, b.r))
        .slice(0, filter.limit ?? questions.length + lessons.length);

      const items = await Promise.all(
        merged.map(({ type: t, r }) => toItem(t, r, decisions.get(r.id) ?? null)),
      );
      return { items, counts: { question: questionCounts, lesson: lessonCounts } };
    },

    async getDetail(type, revisionId) {
      const record = await getRevision(type, revisionId);
      if (!record) return null;
      const entityId = entityIdOf(type, record);
      const siblings: AnyRevision[] =
        type === 'question'
          ? await deps.content.revisions.listRevisions(entityId)
          : await deps.learning.lessonRevisions.listRevisions(entityId);
      const baseline =
        siblings.find((s) => s.status === 'published' && s.id !== record.id) ??
        siblings.find((s) => s.revisionNumber < record.revisionNumber) ??
        null;

      const [item, findings, scripture, blockers, history] = await Promise.all([
        latestDecisionFor(revisionId).then((d) => toItem(type, record, d)),
        deps.gates.findings.listFor(type, revisionId),
        deps.gates.scripture.listFor(type, revisionId),
        findBlockers(deps.gates, type, [revisionId]),
        deps.auditLog.query({ target: revisionId, limit: 50 }),
      ]);

      const diff =
        type === 'question'
          ? diffQuestionRevisions(
              (baseline as QuestionRevisionRecord | null) ?? null,
              record as QuestionRevisionRecord,
            ).fields
          : diffLessonRevisions(
              (baseline as LessonRevisionRecord | null) ?? null,
              record as LessonRevisionRecord,
            ).fields;

      return {
        item,
        revision:
          type === 'question'
            ? { revisionType: 'question', record: record as QuestionRevisionRecord }
            : { revisionType: 'lesson', record: record as LessonRevisionRecord },
        baseline: baseline
          ? { revisionId: baseline.id, revisionNumber: baseline.revisionNumber, status: baseline.status }
          : null,
        diff,
        findings,
        scripture,
        blockers,
        history,
        siblings: siblings.map((s) => ({
          revisionId: s.id,
          revisionNumber: s.revisionNumber,
          status: s.status,
          createdAt: s.createdAt,
        })),
      };
    },

    async decide(type, revisionId, decision, actor, opts = {}) {
      const record = await getRevision(type, revisionId);
      if (!record) throw new AppError('revision_not_found', 'No such revision', 404);
      if (!REVIEWABLE_STATUSES.includes(record.status)) {
        throw new AppError(
          'revision_not_reviewable',
          `A ${record.status} revision cannot receive a review decision`,
          409,
        );
      }
      const comment = opts.comment?.trim() ? opts.comment.trim().slice(0, COMMENT_MAX) : null;
      if (decision === 'changes_requested' && !comment) {
        throw new AppError('comment_required', 'Say what needs to change', 400, {
          fieldErrors: { comment: ['required'] },
        });
      }
      if (decision === 'approved') {
        const blockers = await findBlockers(deps.gates, type, [revisionId]);
        if (blockers.length > 0) {
          await deps.auditLog.append(
            buildAuditRecord({
              actor,
              action: REVIEW_DECISION_ACTION,
              target: revisionId,
              result: 'denied',
              requestId: opts.requestId,
              metadata: { decision, revisionType: type, blockers },
            }),
          );
          throw new ContentApprovalBlockedError(blockers);
        }
      }
      const audit = buildAuditRecord({
        actor,
        action: REVIEW_DECISION_ACTION,
        target: revisionId,
        result: 'ok',
        requestId: opts.requestId,
        metadata: { decision, revisionType: type, revisionNumber: record.revisionNumber, comment },
      });
      await deps.auditLog.append(audit);
      return { decision, at: audit.at, actorUserId: actor.userId, comment };
    },

    async publish(type, revisionId, actor, requestId) {
      const record = await getRevision(type, revisionId);
      if (!record) throw new AppError('revision_not_found', 'No such revision', 404);
      const decision = await latestDecisionFor(revisionId);
      if (decision?.decision !== 'approved') {
        await deps.auditLog.append(
          buildAuditRecord({
            actor,
            action: 'content.publish_denied',
            target: revisionId,
            result: 'denied',
            requestId,
            metadata: { revisionType: type, reason: 'not_approved' },
          }),
        );
        throw new AppError('content_not_approved', 'Only an approved revision can be published', 409);
      }
      const publication = createContentPublicationService({
        content: deps.content,
        learning: deps.learning,
        gates: deps.gates,
        audit: { log: deps.auditLog, actor, requestId },
      });
      return type === 'question'
        ? publication.publishQuestionRevision(revisionId)
        : publication.publishLessonRevision(revisionId);
    },
  };
}
