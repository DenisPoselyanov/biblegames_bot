/**
 * Payload shapes for each typed lesson block (§11.3), one zod schema per
 * `blockType`. Split out of `LessonBlockRenderer.tsx` so the validation rules
 * are testable as plain functions — this repo has no React-rendering test
 * harness (no `@testing-library/react`/jsdom; `vitest.config.ts` only
 * discovers `*.test.ts`), so a `.tsx` component itself isn't unit-testable
 * here; its live behavior is covered by browser QA instead (see the WS6 plan).
 */
import { z } from 'zod';

export const headingPayload = z.object({ text: z.string().min(1) });
export const textPayload = z.object({ text: z.string().min(1) });
export const scripturePayload = z.object({
  reference: z.string().min(1),
  translation: z.string().min(1),
  text: z.string().min(1),
  isParaphrase: z.boolean().optional(),
});
export const explanationPayload = z.object({ text: z.string().min(1) });
export const glossaryPayload = z.object({ term: z.string().min(1), definition: z.string().min(1) });
export const imagePayload = z.object({
  src: z.string().min(1),
  alt: z.string().min(1),
  caption: z.string().optional(),
});
export const reflectionPayload = z.object({ prompt: z.string().min(1) });
export const questionPayload = z.object({
  prompt: z.string().min(1),
  options: z.array(z.string().min(1)).min(2),
  correctIndex: z.number().int().min(0).optional(),
  explanation: z.string().optional(),
});
export const summaryPayload = z.object({ text: z.string().min(1) });
export const nextStepPayload = z.object({ text: z.string().min(1), ctaLabel: z.string().optional() });

/** Every `blockType` the renderer knows how to display, matching the server's `LESSON_BLOCK_TYPES` (§11.3). */
export const LESSON_BLOCK_PAYLOAD_SCHEMAS = {
  heading: headingPayload,
  text: textPayload,
  scripture: scripturePayload,
  explanation: explanationPayload,
  glossary: glossaryPayload,
  image: imagePayload,
  reflection: reflectionPayload,
  question: questionPayload,
  summary: summaryPayload,
  next_step: nextStepPayload,
} as const;

export type KnownLessonBlockType = keyof typeof LESSON_BLOCK_PAYLOAD_SCHEMAS;
