/**
 * Scripture-verification evidence storage (Phase 4 WS4, spec §5.4). One row
 * per verified reference on a revision (question or lesson) — the fetched
 * canonical text snapshot plus the computed verdict, distinct from the
 * structured `scripture_references` table (which stores the reference itself,
 * not its verification result). See `server/domains/shared/scriptureEvidence.ts`.
 */
import { index, integer, pgTable, text } from 'drizzle-orm/pg-core';
import { tstz } from './_shared';

export const scriptureEvidence = pgTable(
  'scripture_evidence',
  {
    id: text('id').primaryKey(),
    /** 'question' | 'lesson'. */
    revisionType: text('revision_type').notNull(),
    revisionId: text('revision_id').notNull(),
    rawReference: text('raw_reference').notNull(),
    bookId: integer('book_id'),
    chapter: integer('chapter'),
    verseStart: integer('verse_start'),
    verseEnd: integer('verse_end'),
    translation: text('translation').notNull(),
    /** 'match' | 'paraphrase' | 'mismatch' | 'not_found'. */
    verdict: text('verdict').notNull(),
    quotedText: text('quoted_text'),
    sourceText: text('source_text'),
    adapterVersion: text('adapter_version').notNull(),
    retrievedAt: tstz('retrieved_at').notNull().defaultNow(),
    /** 'accepted' | 'rejected' | null — a reviewer's explicit call on a `paraphrase` verdict. */
    reviewerDecision: text('reviewer_decision'),
  },
  (t) => [
    index('idx_scripture_evidence_revision').on(t.revisionType, t.revisionId),
    index('idx_scripture_evidence_verdict').on(t.verdict),
  ],
);
