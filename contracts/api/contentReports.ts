import { z } from 'zod';
import { entityId, isoTimestamp } from '../schemas/primitives';

/**
 * `/api/v1/content-reports` — a player reports a wrong question/lesson
 * (Phase 4 WS9, spec §14). Reports never change content; a reviewer resolves
 * them in Content Studio. The response never reveals other players' reports.
 */

export const contentReportCategorySchema = z.enum([
  'wrong_answer',
  'wording',
  'translation',
  'reference',
  'offensive',
  'technical',
]);
export type ContentReportCategory = z.infer<typeof contentReportCategorySchema>;

export const contentReportStatusSchema = z.enum(['open', 'resolved', 'dismissed']);

/** `POST /api/v1/content-reports` */
export const contentReportCreateRequest = z
  .object({
    entityType: z.enum(['question', 'lesson']),
    entityId,
    revisionId: entityId.optional(),
    category: contentReportCategorySchema,
    /** Optional free text, bounded (§14 "optional comment with privacy limits"). */
    comment: z.string().trim().max(500).optional(),
    sessionId: entityId.optional(),
  })
  .strict();
export type ContentReportCreateRequest = z.infer<typeof contentReportCreateRequest>;

/** The player's own view of a report — no reviewer notes, no other players. */
export const myContentReport = z.object({
  id: z.string(),
  entityType: z.enum(['question', 'lesson']),
  entityId: z.string(),
  category: contentReportCategorySchema,
  status: contentReportStatusSchema,
  createdAt: isoTimestamp,
  resolvedAt: isoTimestamp.nullable(),
});
export type MyContentReport = z.infer<typeof myContentReport>;

export const contentReportCreateResponse = z.object({
  report: myContentReport,
  /** True when this player already had an open report of this category here — nothing new was stored. */
  duplicate: z.boolean(),
});
export type ContentReportCreateResponse = z.infer<typeof contentReportCreateResponse>;

/** `GET /api/v1/content-reports/mine` */
export const myContentReportsResponse = z.object({ reports: z.array(myContentReport) });
export type MyContentReportsResponse = z.infer<typeof myContentReportsResponse>;
