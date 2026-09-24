/**
 * Publication/release/rollback gate (Phase 4 WS6, spec §13, §22).
 *
 * The atomic-versioned-set primitive already existed (Phase 2 §14,
 * `ContentSetRepository.publishVersion` — freezes an ordered set of revision
 * ids as an immutable, content-hashed version; idempotent by membership).
 * What was missing is the gate in front of it: "AI output cannot become
 * published without validation and human approval" (§22 forbidden shortcuts —
 * "approving in bulk without viewing blockers") wasn't actually enforced
 * anywhere before a revision (or a whole set) flipped to `published`. This
 * service is that gate, plus rollback — expressed as "publish an older
 * version's membership again" so the superseded version is never deleted and
 * `getLatest()` stays the single source of truth for "what's active."
 */
import type { AuditActor, AuditLog } from '../audit';
import { buildAuditRecord } from '../audit';
import type { ContentRepositories } from '../domains/content/repository';
import { isValidatedWith, QUESTION_CHECKS_VERSION } from '../domains/content/revisionValidation';
import type { ContentSetVersionRecord, QuestionRevisionRecord } from '../domains/content/types';
import type { LearningRepositories } from '../domains/learning/repository';
import { LESSON_CHECKS_VERSION } from '../domains/learning/revisionValidation';
import type { LessonRevisionRecord } from '../domains/learning/types';
import type { ScriptureEvidenceRepository } from '../domains/shared/scriptureEvidenceRepository';
import type { ValidationFindingRepository } from '../domains/shared/validationFindingsRepository';
import { AppError } from '../lib/errors';

/**
 * Optional — omitted in most tests and wherever there's no request context
 * yet (WS8's future Studio route is the real caller). When present, every
 * publish/rollback attempt is audited, success or denied (spec §7/§14 —
 * "publish, rollback, and denied attempts... fail-closed 403s are
 * audit-worthy too").
 */
export interface ContentPublicationAuditSink {
  log: AuditLog;
  actor: AuditActor;
  requestId?: string;
}

export interface ContentPublicationGates {
  findings: ValidationFindingRepository;
  scripture: ScriptureEvidenceRepository;
}

export interface PublicationBlocker {
  revisionId: string;
  reason: 'not_validated' | 'validation_blocking' | 'scripture_unresolved';
}

export class ContentPublicationBlockedError extends AppError {
  readonly blockers: PublicationBlocker[];

  constructor(blockers: PublicationBlocker[]) {
    super(
      'content_publish_blocked',
      `${blockers.length} revision(s) have unresolved blockers and cannot be published`,
      409,
    );
    this.name = 'ContentPublicationBlockedError';
    this.blockers = blockers;
  }
}

/** Every open WS3/WS4 blocker on `revisionIds` — exported so the WS8b review editor shows exactly what the gate will check. */
export async function findBlockers(
  gates: ContentPublicationGates,
  revisionType: 'question' | 'lesson',
  revisionIds: readonly string[],
): Promise<PublicationBlocker[]> {
  const blockers: PublicationBlocker[] = [];
  for (const revisionId of revisionIds) {
    const [findings, scriptureUnresolved] = await Promise.all([
      gates.findings.listFor(revisionType, revisionId),
      gates.scripture.hasUnresolvedBlocker(revisionType, revisionId),
    ]);
    // Fail closed: no run marker for the current checks = never checked, not "clean".
    const version = revisionType === 'question' ? QUESTION_CHECKS_VERSION : LESSON_CHECKS_VERSION;
    if (!isValidatedWith(findings, version)) blockers.push({ revisionId, reason: 'not_validated' });
    if (findings.some((f) => f.severity === 'blocking')) blockers.push({ revisionId, reason: 'validation_blocking' });
    if (scriptureUnresolved) blockers.push({ revisionId, reason: 'scripture_unresolved' });
  }
  return blockers;
}

/** Throws `ContentPublicationBlockedError` listing every blocked revision — never partially publishes. */
async function assertPublishable(
  gates: ContentPublicationGates,
  revisionType: 'question' | 'lesson',
  revisionIds: readonly string[],
): Promise<void> {
  const blockers = await findBlockers(gates, revisionType, revisionIds);
  if (blockers.length > 0) throw new ContentPublicationBlockedError(blockers);
}

export interface ContentPublicationService {
  publishQuestionRevision(revisionId: string): Promise<QuestionRevisionRecord>;
  publishQuestionSet(input: {
    setId: string;
    kind: ContentSetVersionRecord['kind'];
    filter: ContentSetVersionRecord['filter'];
    items: Array<{ questionId: string; revisionId: string }>;
    publishedBy?: string | null;
  }): Promise<ContentSetVersionRecord>;
  /** Re-publishes `toVersion`'s exact membership as the new latest version — never deletes the superseded one. */
  rollbackQuestionSet(
    setId: string,
    toVersion: number,
    publishedBy?: string | null,
  ): Promise<ContentSetVersionRecord>;
  publishLessonRevision(revisionId: string): Promise<LessonRevisionRecord>;
}

async function audit(
  sink: ContentPublicationAuditSink | undefined,
  action: string,
  target: string,
  result: 'ok' | 'denied',
  metadata?: Record<string, unknown>,
): Promise<void> {
  if (!sink) return;
  await sink.log.append(
    buildAuditRecord({ actor: sink.actor, action, target, result, requestId: sink.requestId, metadata }),
  );
}

export function createContentPublicationService(deps: {
  content: ContentRepositories;
  learning: LearningRepositories;
  gates: ContentPublicationGates;
  audit?: ContentPublicationAuditSink;
}): ContentPublicationService {
  return {
    async publishQuestionRevision(revisionId) {
      try {
        await assertPublishable(deps.gates, 'question', [revisionId]);
      } catch (err) {
        if (err instanceof ContentPublicationBlockedError) {
          await audit(deps.audit, 'content.publish_denied', revisionId, 'denied', { blockers: err.blockers });
        }
        throw err;
      }
      const revision = await deps.content.revisions.publishRevision(revisionId);
      await audit(deps.audit, 'content.publish', revisionId, 'ok', { revisionType: 'question' });
      return revision;
    },

    async publishQuestionSet(input) {
      try {
        await assertPublishable(
          deps.gates,
          'question',
          input.items.map((i) => i.revisionId),
        );
      } catch (err) {
        if (err instanceof ContentPublicationBlockedError) {
          await audit(deps.audit, 'content.publish_denied', input.setId, 'denied', { blockers: err.blockers });
        }
        throw err;
      }
      const version = await deps.content.sets.publishVersion(input);
      await audit(deps.audit, 'content.publish', input.setId, 'ok', {
        version: version.version,
        itemCount: version.items.length,
      });
      return version;
    },

    async rollbackQuestionSet(setId, toVersion, publishedBy) {
      const target = await deps.content.sets.getVersion(setId, toVersion);
      if (!target) {
        throw new AppError('content_set_version_not_found', `${setId} has no version ${toVersion}`, 404);
      }
      // Deliberately skips the publish gate: `target` was itself published once
      // already (it passed the gate then), and re-checking would let a check
      // that got *stricter* since then (a rule change, a new sensitivity
      // keyword) block a rollback — the one operation §24 says must always be
      // available to recover from a bad publish.
      const version = await deps.content.sets.publishVersion({
        setId,
        kind: target.kind,
        filter: target.filter,
        items: target.items.map((i) => ({ questionId: i.questionId, revisionId: i.revisionId })),
        publishedBy,
      });
      await audit(deps.audit, 'content.rollback', setId, 'ok', {
        fromVersion: version.version,
        toVersion,
      });
      return version;
    },

    async publishLessonRevision(revisionId) {
      try {
        await assertPublishable(deps.gates, 'lesson', [revisionId]);
      } catch (err) {
        if (err instanceof ContentPublicationBlockedError) {
          await audit(deps.audit, 'content.publish_denied', revisionId, 'denied', { blockers: err.blockers });
        }
        throw err;
      }
      const revision = await deps.learning.lessonRevisions.publishRevision(revisionId);
      await audit(deps.audit, 'content.publish', revisionId, 'ok', { revisionType: 'lesson' });
      return revision;
    },
  };
}
