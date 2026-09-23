/**
 * Validation-finding storage types (Phase 4 WS3, spec §6). Shared by `content`
 * (question revisions) and `learning` (lesson revisions) — the same precedent
 * as `contentWriteGuard.ts`/`revisionDiff.ts`/`stableHash.ts`: one storage
 * primitive, domain-specific check logic lives in each domain's own
 * `qualityChecks.ts`.
 *
 * `severity` has exactly three levels, matching spec §6.2's "heuristics create
 * warnings or quarantine according to policy" plus §6.5's "sensitive items
 * cannot be auto-approved":
 * - `info` — noted, does not affect review/publish.
 * - `warning` — should be looked at, does not by itself block publish.
 * - `blocking` — cannot be resolved by an automated check; publishing/approving
 *   despite it requires an explicit human decision (duplicates, theological
 *   sensitivity, and — once WS4 lands — a Scripture `mismatch`/`not_found`).
 *
 * A finding set is recomputed, not appended: `record()` replaces every stored
 * finding for one revision with the latest check run (§6 "each check result
 * saved with the draft" — the draft is immutable, but a check can still be
 * re-run, e.g. once a sibling revision is added and changes a duplicate
 * verdict).
 */

export type ValidationFindingSeverity = 'info' | 'warning' | 'blocking';
export type ValidationRevisionType = 'question' | 'lesson';

export interface ValidationFinding {
  id: string;
  revisionType: ValidationRevisionType;
  revisionId: string;
  /** Machine-stable check id, e.g. `duplicate_exact`, `theological_sensitivity`. */
  kind: string;
  severity: ValidationFindingSeverity;
  /** Short human-facing title — what the review editor's right rail renders as a chip. */
  label: string;
  /** One or two sentences of specific detail (what matched, which sibling, etc.). */
  detail: string;
  checkedAt: string;
}

export type NewValidationFinding = Omit<ValidationFinding, 'id' | 'checkedAt'>;

/**
 * One (revision type, check kind, severity) bucket across every stored finding
 * — the Studio library's "Якість" summary (Phase 4 WS8c). `revisions` counts
 * distinct revisions, not finding rows.
 */
export interface ValidationFindingSummary {
  revisionType: ValidationRevisionType;
  kind: string;
  severity: ValidationFindingSeverity;
  label: string;
  revisions: number;
}

const SEVERITY_ORDER: Record<ValidationFindingSeverity, number> = { blocking: 0, warning: 1, info: 2 };

/** Blocking first, then most-affected first, then kind — same order in every adapter. */
export function compareFindingSummaries(a: ValidationFindingSummary, b: ValidationFindingSummary): number {
  return (
    SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
    b.revisions - a.revisions ||
    (a.revisionType < b.revisionType ? -1 : a.revisionType > b.revisionType ? 1 : 0) ||
    (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0)
  );
}
