/**
 * Defense-in-depth write guard for content revisions (Phase 4 WS2, ADR-019
 * §3, spec §3.2/§22): "AI-originated writes cannot reach the published store
 * directly." `RevisionDraft.status`/`LessonRevisionDraft.status` already
 * restrict the type to `'legacy_unreviewed' | 'draft'` at compile time — this
 * is the runtime backstop for a caller that bypasses the type (an `as` cast,
 * a JSON request body), enforced at the repository write path itself, not
 * just at an HTTP endpoint (that permission-matrix layer is WS5's scope).
 */

const AI_ORIGIN_ALLOWED_STATUSES = new Set(['legacy_unreviewed', 'draft']);

/**
 * Throws if a draft claiming `source: 'ai'` requests any status other than
 * `'legacy_unreviewed'`/`'draft'`. A no-op for every other `source`.
 */
export function assertAiWriteAllowed(source: string | undefined, status: string | undefined): void {
  if (source !== 'ai') return;
  if (status && !AI_ORIGIN_ALLOWED_STATUSES.has(status)) {
    throw new Error(
      `AI-originated content must land as 'draft'/'legacy_unreviewed', got status '${status}' (source 'ai')`,
    );
  }
}
