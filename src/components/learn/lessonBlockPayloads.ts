/**
 * Re-exports the canonical lesson-block payload schemas from `@contracts`
 * (Phase 4 WS3) — moved there so the server's validation pipeline
 * (`server/domains/learning/qualityChecks.ts`) can share the same schemas
 * instead of re-deriving them. Kept as a thin shim so existing imports
 * (`LessonBlockRenderer.tsx`, this file's own test) don't need to change.
 */
export {
  LESSON_BLOCK_PAYLOAD_SCHEMAS,
  explanationPayload,
  glossaryPayload,
  headingPayload,
  imagePayload,
  nextStepPayload,
  questionPayload,
  reflectionPayload,
  scripturePayload,
  summaryPayload,
  textPayload,
} from '@contracts';
export type { KnownLessonBlockType } from '@contracts';
