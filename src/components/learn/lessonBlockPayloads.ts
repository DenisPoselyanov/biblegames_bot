/**
 * Re-exports the canonical lesson-block payload schemas from `@contracts`
 * (Phase 4 WS3) — moved there so the server's validation pipeline
 * (`server/domains/learning/qualityChecks.ts`) can share the same schemas
 * instead of re-deriving them. Kept as a thin shim so existing imports
 * (`LessonBlockRenderer.tsx`, this file's own test) don't need to change.
 */
export {
  FILL_BLANK_MARKER,
  INTERACTIVE_LESSON_BLOCK_TYPES,
  LESSON_BLOCK_PAYLOAD_SCHEMAS,
  characterCardPayload,
  explanationPayload,
  fillBlankPayload,
  glossaryPayload,
  headingPayload,
  imagePayload,
  matchPairsPayload,
  memoryVersePayload,
  nextStepPayload,
  orderEventsPayload,
  questionPayload,
  reflectionPayload,
  revealPayload,
  scenarioPayload,
  scripturePayload,
  summaryPayload,
  textPayload,
  trueFalsePayload,
} from '@contracts';
export type { KnownLessonBlockType } from '@contracts';
