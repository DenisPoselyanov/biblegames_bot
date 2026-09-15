import { describe, expect, it } from 'vitest';
import { LESSON_BLOCK_PAYLOAD_SCHEMAS, questionPayload, scripturePayload } from './lessonBlockPayloads';

/** Matches the §11.3 typed-block list (heading/text, scripture, explanation, glossary/term, image, reflection, question, summary, next-step). */
const EXPECTED_BLOCK_TYPES = [
  'heading',
  'text',
  'scripture',
  'explanation',
  'glossary',
  'image',
  'reflection',
  'question',
  'summary',
  'next_step',
];

describe('LESSON_BLOCK_PAYLOAD_SCHEMAS', () => {
  it('covers exactly the §11.3 block types', () => {
    expect(Object.keys(LESSON_BLOCK_PAYLOAD_SCHEMAS).sort()).toEqual(EXPECTED_BLOCK_TYPES.sort());
  });
});

describe('scripturePayload', () => {
  it('accepts a well-formed quotation', () => {
    const parsed = scripturePayload.safeParse({
      reference: 'Буття 1:1',
      translation: 'УБТ',
      text: 'На початку Бог створив небо і землю.',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects a payload missing the reference', () => {
    const parsed = scripturePayload.safeParse({ translation: 'УБТ', text: '...' });
    expect(parsed.success).toBe(false);
  });
});

describe('questionPayload', () => {
  it('accepts an ungraded (no correctIndex) self-check question', () => {
    const parsed = questionPayload.safeParse({ prompt: 'Хто був першою людиною?', options: ['Адам', 'Ной'] });
    expect(parsed.success).toBe(true);
  });

  it('rejects fewer than two options', () => {
    const parsed = questionPayload.safeParse({ prompt: 'Q?', options: ['only one'] });
    expect(parsed.success).toBe(false);
  });
});

describe('every schema in the table', () => {
  it('rejects an empty object (a malformed/unknown-shaped payload)', () => {
    for (const [blockType, schema] of Object.entries(LESSON_BLOCK_PAYLOAD_SCHEMAS)) {
      expect(schema.safeParse({}).success, `${blockType} should reject {}`).toBe(false);
    }
  });
});
