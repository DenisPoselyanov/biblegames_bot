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
import type { ContentRepositories } from '../domains/content/repository';
import type { ContentSetVersionRecord, QuestionRevisionRecord } from '../domains/content/types';
import type { LearningRepositories } from '../domains/learning/repository';
import type { LessonRevisionRecord } from '../domains/learning/types';
import type { ScriptureEvidenceRepository } from '../domains/shared/scriptureEvidenceRepository';
import type { ValidationFindingRepository } from '../domains/shared/validationFindingsRepository';
import { AppError } from '../lib/errors';

export interface ContentPublicationGates {
  findings: ValidationFindingRepository;
  scripture: ScriptureEvidenceRepository;
}

export interface PublicationBlocker {
  revisionId: string;
  reason: 'validation_blocking' | 'scripture_unresolved';
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

async function findBlockers(
  gates: ContentPublicationGates,
  revisionType: 'question' | 'lesson',
  revisionIds: readonly string[],
): Promise<PublicationBlocker[]> {
  const blockers: PublicationBlocker[] = [];
  for (const revisionId of revisionIds) {
    const [blocking, scriptureUnresolved] = await Promise.all([
      gates.findings.hasBlocking(revisionType, revisionId),
      gates.scripture.hasUnresolvedBlocker(revisionType, revisionId),
    ]);
    if (blocking) blockers.push({ revisionId, reason: 'validation_blocking' });
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

export function createContentPublicationService(deps: {
  content: ContentRepositories;
  learning: LearningRepositories;
  gates: ContentPublicationGates;
}): ContentPublicationService {
  return {
    async publishQuestionRevision(revisionId) {
      await assertPublishable(deps.gates, 'question', [revisionId]);
      return deps.content.revisions.publishRevision(revisionId);
    },

    async publishQuestionSet(input) {
      await assertPublishable(
        deps.gates,
        'question',
        input.items.map((i) => i.revisionId),
      );
      return deps.content.sets.publishVersion(input);
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
      return deps.content.sets.publishVersion({
        setId,
        kind: target.kind,
        filter: target.filter,
        items: target.items.map((i) => ({ questionId: i.questionId, revisionId: i.revisionId })),
        publishedBy,
      });
    },

    async publishLessonRevision(revisionId) {
      await assertPublishable(deps.gates, 'lesson', [revisionId]);
      return deps.learning.lessonRevisions.publishRevision(revisionId);
    },
  };
}
