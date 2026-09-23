import { describe, expect, it } from 'vitest';
import { LESSON_ARCHETYPES } from '@contracts';
import {
  fillBlankPayload,
  INTERACTIVE_LESSON_BLOCK_TYPES,
  LESSON_BLOCK_PAYLOAD_SCHEMAS,
  matchPairsPayload,
  orderEventsPayload,
  questionPayload,
  scenarioPayload,
  scripturePayload,
  trueFalsePayload,
} from './lessonBlockPayloads';

/** The §11.3 typed-block list plus the interactive lesson-variety blocks. */
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
  'true_false',
  'order_events',
  'fill_blank',
  'match_pairs',
  'reveal',
  'scenario',
  'character_card',
  'memory_verse',
];

describe('LESSON_BLOCK_PAYLOAD_SCHEMAS', () => {
  it('covers exactly the known block types', () => {
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

describe('interactive payloads', () => {
  it('fill_blank requires exactly one gap', () => {
    const base = {
      reference: 'Івана 3:16',
      translation: 'УБТ',
      answer: 'світ',
      distractors: ['народ', 'храм'],
    };
    expect(fillBlankPayload.safeParse({ ...base, text: 'Бо так полюбив Бог ___, що…' }).success).toBe(true);
    expect(fillBlankPayload.safeParse({ ...base, text: 'Бо так полюбив Бог світ' }).success).toBe(false);
    expect(fillBlankPayload.safeParse({ ...base, text: '___ полюбив Бог ___' }).success).toBe(false);
  });

  it('fill_blank rejects a distractor equal to the answer', () => {
    const parsed = fillBlankPayload.safeParse({
      reference: 'Івана 3:16',
      translation: 'УБТ',
      text: 'Бо так полюбив Бог ___',
      answer: 'світ',
      distractors: ['Світ'],
    });
    expect(parsed.success).toBe(false);
  });

  it('order_events needs 3+ unique items', () => {
    expect(orderEventsPayload.safeParse({ prompt: 'P', items: ['A', 'B', 'C'] }).success).toBe(true);
    expect(orderEventsPayload.safeParse({ prompt: 'P', items: ['A', 'B'] }).success).toBe(false);
    expect(orderEventsPayload.safeParse({ prompt: 'P', items: ['A', 'B', 'a'] }).success).toBe(false);
  });

  it('match_pairs rejects duplicate sides', () => {
    const pairs = [
      { left: 'Мойсей', right: 'Синай' },
      { left: 'Ілля', right: 'Кармил' },
      { left: 'Ной', right: 'Арарат' },
    ];
    expect(matchPairsPayload.safeParse({ prompt: 'P', pairs }).success).toBe(true);
    expect(
      matchPairsPayload.safeParse({ prompt: 'P', pairs: [...pairs.slice(0, 2), { left: 'Ной', right: 'Синай' }] }).success,
    ).toBe(false);
  });

  it('true_false and scenario accept well-formed payloads', () => {
    expect(trueFalsePayload.safeParse({ statements: [{ text: 'Ной збудував ковчег', isTrue: true }] }).success).toBe(true);
    expect(
      scenarioPayload.safeParse({
        situation: 'Друг тебе образив.',
        choices: [
          { text: 'Пробачити', response: 'Так навчає Христос.', reference: 'Матвія 18:22' },
          { text: 'Відповісти тим самим', response: 'Зло не перемагається злом.' },
        ],
      }).success,
    ).toBe(true);
  });
});

describe('lesson archetypes', () => {
  it('only reference known block types and each contains an interactive block', () => {
    const interactive = INTERACTIVE_LESSON_BLOCK_TYPES as readonly string[];
    for (const [name, archetype] of Object.entries(LESSON_ARCHETYPES)) {
      for (const t of archetype.blocks) expect(t in LESSON_BLOCK_PAYLOAD_SCHEMAS, `${name}: ${t}`).toBe(true);
      expect(archetype.blocks.some((t) => interactive.includes(t)), name).toBe(true);
      expect(archetype.blocks, name).toContain('summary');
    }
  });
});
