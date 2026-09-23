/**
 * Payload shapes for each typed lesson block (§11.3), one zod schema per
 * `blockType`. Canonical home for both sides: the client (`src/components/
 * learn/lessonBlockPayloads.ts` re-exports this file) and the server (Phase 4
 * WS3 `server/domains/learning/qualityChecks.ts`, which had no payload-shape
 * validation before — every lesson block landed as an untyped `jsonb` blob).
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
  // Optional — reserves layout space (§18 CLS) when the author supplies real
  // dimensions; the renderer falls back to a fixed aspect ratio otherwise.
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
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

// ── Interactive blocks (lesson variety) ────────────────────────────────────
// All client-only: no answer is stored server-side. Every shape is small and
// flat so an AI generator can fill it reliably and a quality check can catch
// a malformed one before publication.

/** Marker the `fill_blank` verse uses for its single gap. */
export const FILL_BLANK_MARKER = '___';

function hasDuplicates(values: readonly string[]): boolean {
  const normalized = values.map((v) => v.trim().toLocaleLowerCase('uk'));
  return new Set(normalized).size !== normalized.length;
}

/** «Правда чи міф» — a few short statements, each answered true/false. */
export const trueFalsePayload = z.object({
  prompt: z.string().min(1).optional(),
  statements: z
    .array(z.object({ text: z.string().min(1), isTrue: z.boolean(), explanation: z.string().optional() }))
    .min(1)
    .max(6),
});

/** «Розстав по порядку» — `items` are authored in the correct order; the client shuffles them. */
export const orderEventsPayload = z.object({
  prompt: z.string().min(1),
  items: z
    .array(z.string().min(1))
    .min(3)
    .max(6)
    .refine((items) => !hasDuplicates(items), 'items must be unique'),
  explanation: z.string().optional(),
});

/**
 * «Допиши вірш» — `text` is the verse with exactly one `___` gap; `answer`
 * fills it back to the full quotation (so the verse stays verifiable against
 * its `reference`), `distractors` are the wrong choices.
 */
export const fillBlankPayload = z
  .object({
    reference: z.string().min(1),
    translation: z.string().min(1),
    text: z.string().min(1),
    answer: z.string().min(1),
    distractors: z.array(z.string().min(1)).min(1).max(3),
    explanation: z.string().optional(),
  })
  .refine((p) => p.text.split(FILL_BLANK_MARKER).length === 2, {
    message: `text must contain exactly one ${FILL_BLANK_MARKER}`,
    path: ['text'],
  })
  .refine((p) => !hasDuplicates([p.answer, ...p.distractors]), {
    message: 'answer and distractors must all differ',
    path: ['distractors'],
  });

/** «Зістав» — pairs authored matched; the client shuffles the right column. */
export const matchPairsPayload = z.object({
  prompt: z.string().min(1),
  pairs: z
    .array(z.object({ left: z.string().min(1), right: z.string().min(1) }))
    .min(3)
    .max(5)
    .refine((pairs) => !hasDuplicates(pairs.map((p) => p.left)), 'left sides must be unique')
    .refine((pairs) => !hasDuplicates(pairs.map((p) => p.right)), 'right sides must be unique'),
});

/** «Чи знав ти?» — a card flipped by tap. */
export const revealPayload = z.object({
  kicker: z.string().min(1).optional(),
  front: z.string().min(1),
  back: z.string().min(1),
});

/** «Що б ти зробив?» — no wrong answer: every choice gets its own response. */
export const scenarioPayload = z.object({
  situation: z.string().min(1),
  choices: z
    .array(z.object({ text: z.string().min(1), response: z.string().min(1), reference: z.string().optional() }))
    .min(2)
    .max(4),
});

/** A Bible character profile card. */
export const characterCardPayload = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  facts: z.array(z.string().min(1)).min(1).max(4),
  quote: z.string().min(1).optional(),
  reference: z.string().min(1).optional(),
});

/** «Вивчи напам'ять» — the client hides progressively more words each round. */
export const memoryVersePayload = z.object({
  reference: z.string().min(1),
  translation: z.string().min(1),
  text: z.string().min(1),
});

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
  true_false: trueFalsePayload,
  order_events: orderEventsPayload,
  fill_blank: fillBlankPayload,
  match_pairs: matchPairsPayload,
  reveal: revealPayload,
  scenario: scenarioPayload,
  character_card: characterCardPayload,
  memory_verse: memoryVersePayload,
} as const;

export type KnownLessonBlockType = keyof typeof LESSON_BLOCK_PAYLOAD_SCHEMAS;

/** Blocks the reader acts on (answers, taps, orders) rather than just reads — a lesson should have at least one. */
export const INTERACTIVE_LESSON_BLOCK_TYPES = [
  'question',
  'true_false',
  'order_events',
  'fill_blank',
  'match_pairs',
  'reveal',
  'scenario',
  'memory_verse',
] as const satisfies readonly KnownLessonBlockType[];

/**
 * Lesson archetypes — the block sequence a generator (Content Studio) should
 * follow for a given kind of lesson, so consecutive lessons don't all read the
 * same. Advisory, not enforced: `blocks` is the recommended order, not a
 * required one.
 */
export const LESSON_ARCHETYPES = {
  story: {
    label: 'Історія',
    blocks: ['heading', 'scripture', 'explanation', 'order_events', 'character_card', 'reflection', 'summary'],
  },
  verse: {
    label: 'Вірш',
    blocks: ['heading', 'scripture', 'explanation', 'fill_blank', 'memory_verse', 'summary'],
  },
  character: {
    label: 'Персонаж',
    blocks: ['heading', 'character_card', 'scripture', 'question', 'match_pairs', 'summary'],
  },
  concept: {
    label: 'Поняття',
    blocks: ['heading', 'glossary', 'scripture', 'true_false', 'reveal', 'match_pairs', 'summary'],
  },
  application: {
    label: 'Застосування',
    blocks: ['heading', 'scripture', 'explanation', 'scenario', 'reflection', 'summary'],
  },
} as const satisfies Record<string, { label: string; blocks: readonly KnownLessonBlockType[] }>;

export type LessonArchetype = keyof typeof LESSON_ARCHETYPES;
