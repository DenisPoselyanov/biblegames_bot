/**
 * Scripture-evidence storage types (Phase 4 WS4, spec §5.4). Shared by
 * `content` (question `scriptureRefs`) and `learning` (lesson `scripture`
 * blocks) — same precedent as `validationFindings.ts`. One row per verified
 * reference on a revision; a revision with several references gets several
 * rows.
 */
import type { ScriptureVerdict } from '../content/scriptureVerification';

export type EvidenceRevisionType = 'question' | 'lesson';

export interface ScriptureEvidenceRecord {
  id: string;
  revisionType: EvidenceRevisionType;
  revisionId: string;
  /** As authored, before parsing — "Ів 3:16", "JHN.3.16", … */
  rawReference: string;
  bookId: number | null;
  chapter: number | null;
  verseStart: number | null;
  verseEnd: number | null;
  translation: string;
  verdict: ScriptureVerdict;
  /** The text the content claims to quote, or `null` for a citation-only reference. */
  quotedText: string | null;
  /** The fetched canonical text snapshot at verification time, or `null` when the reference didn't resolve. */
  sourceText: string | null;
  adapterVersion: string;
  retrievedAt: string;
  /** A human's explicit call on a `paraphrase` verdict — never auto-set. `null` until a reviewer decides. */
  reviewerDecision: 'accepted' | 'rejected' | null;
}

export type NewScriptureEvidence = Omit<ScriptureEvidenceRecord, 'id' | 'retrievedAt' | 'reviewerDecision'>;
