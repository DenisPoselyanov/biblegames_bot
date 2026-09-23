/**
 * Validation-finding storage (Phase 4 WS3, spec §6). One row per check result,
 * for one revision (question or lesson) — the data the review editor's right
 * rail renders. See `server/domains/shared/validationFindings.ts` for the
 * severity levels and the "recomputed, not appended" write model.
 */
import { index, pgTable, text } from 'drizzle-orm/pg-core';
import { tstz } from './_shared';

export const contentValidationFindings = pgTable(
  'content_validation_findings',
  {
    id: text('id').primaryKey(),
    /** 'question' | 'lesson' — which domain's revision this finding belongs to. */
    revisionType: text('revision_type').notNull(),
    revisionId: text('revision_id').notNull(),
    /** Machine-stable check id, e.g. `duplicate_exact`, `theological_sensitivity`. */
    kind: text('kind').notNull(),
    /** 'info' | 'warning' | 'blocking'. */
    severity: text('severity').notNull(),
    label: text('label').notNull(),
    detail: text('detail').notNull(),
    checkedAt: tstz('checked_at').notNull().defaultNow(),
  },
  (t) => [
    index('idx_content_validation_findings_revision').on(t.revisionType, t.revisionId),
    index('idx_content_validation_findings_severity').on(t.severity),
  ],
);
