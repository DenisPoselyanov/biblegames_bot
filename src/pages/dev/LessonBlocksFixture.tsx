import type { LessonBlock } from '../../../contracts/api/learning';
import { LessonBlockRenderer } from '../../components/learn/LessonBlockRenderer';
import { INTERACTIVE_LESSON_BLOCK_TYPES } from '../../components/learn/lessonBlockPayloads';
import { AppPage, ContentCard, PageHeader } from '../../components/ui';

/**
 * Dev-only visual QA harness for the interactive lesson blocks — one sample of
 * every `blockType`, rendered the way `LessonSession` (design-v2) renders them.
 * Registered in App.tsx behind `import.meta.env.DEV` only, so it is tree-shaken
 * out of production builds. Doubles as a reference of well-formed payloads.
 */
const SAMPLE_BLOCKS: Array<Pick<LessonBlock, 'blockType' | 'payload'>> = [
  { blockType: 'heading', payload: { text: 'Ной і ковчег' } },
  {
    blockType: 'character_card',
    payload: {
      name: 'Ной',
      role: 'Праведник, що збудував ковчег',
      facts: [
        'Знайшов милість в очах Господа серед зіпсованого покоління',
        'Збудував ковчег за Божими вказівками',
        'Після потопу приніс жертву, і Бог уклав з ним завіт',
      ],
      reference: 'Буття 6–9',
    },
  },
  {
    blockType: 'order_events',
    payload: {
      prompt: 'Розстав події історії Ноя по порядку',
      items: ['Бог наказує збудувати ковчег', 'Починається потоп', 'Ковчег зупиняється на горах Арарат', 'Бог ставить веселку як знак завіту'],
      explanation: 'Буття 6–9 розповідає цю історію саме в такій послідовності.',
    },
  },
  {
    blockType: 'true_false',
    payload: {
      prompt: 'Перевір себе',
      statements: [
        { text: 'Ной узяв у ковчег по одній парі від кожного виду тварин.', isTrue: false, explanation: 'Чистих тварин він узяв по сім пар (Буття 7:2).' },
        { text: 'Веселка — знак Божого завіту більше не нищити землю потопом.', isTrue: true },
      ],
    },
  },
  {
    blockType: 'fill_blank',
    payload: {
      reference: 'Буття 9:13',
      translation: 'Огієнко',
      text: 'Мою ___ Я дав у хмарі, і вона буде на знак заповіту між Мною та між землею.',
      answer: 'веселку',
      distractors: ['зорю', 'хмару', 'печать'],
      explanation: 'Веселка — видимий знак Божої обітниці.',
    },
  },
  {
    blockType: 'match_pairs',
    payload: {
      prompt: 'Зістав персонажа з місцем',
      pairs: [
        { left: 'Ной', right: 'Арарат' },
        { left: 'Мойсей', right: 'Синай' },
        { left: 'Ілля', right: 'Кармил' },
      ],
    },
  },
  {
    blockType: 'reveal',
    payload: { front: 'Скільки днів і ночей ішов дощ під час потопу?', back: 'Сорок днів і сорок ночей (Буття 7:12).' },
  },
  {
    blockType: 'scenario',
    payload: {
      situation: 'Усі друзі сміються з твого рішення, яке ти вважаєш правильним перед Богом.',
      choices: [
        { text: 'Відмовитися від рішення, щоб не виділятися', response: 'Ной теж міг би так зробити, але довіра Богові для нього важила більше за думку людей.' },
        { text: 'Спокійно продовжувати й пояснити, чому', response: 'Саме так діяв Ной — роками будував ковчег на очах у всіх.', reference: 'Євреїв 11:7' },
      ],
    },
  },
  {
    blockType: 'memory_verse',
    payload: {
      reference: 'Івана 3:16',
      translation: 'Огієнко',
      text: 'Бо так полюбив Бог світ, що дав Сина Свого Однородженого, щоб кожен, хто вірує в Нього, не згинув, але мав життя вічне.',
    },
  },
  { blockType: 'summary', payload: { text: 'Віра Ноя проявилася в послуху, навіть коли інші не розуміли.' } },
];

export function LessonBlocksFixture() {
  const interactive = INTERACTIVE_LESSON_BLOCK_TYPES as readonly string[];
  return (
    <AppPage noBottomNav>
      <PageHeader kicker="Dev" title="Блоки уроку" description="Приклад кожного інтерактивного блоку." />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
        {SAMPLE_BLOCKS.map((sample, i) => {
          const block: LessonBlock = { id: `fixture_b${i}`, position: i, schemaVersion: 1, ...sample };
          return interactive.includes(block.blockType) ? (
            <ContentCard key={block.id}>
              <LessonBlockRenderer block={block} richBlocks />
            </ContentCard>
          ) : (
            <LessonBlockRenderer key={block.id} block={block} richBlocks />
          );
        })}
      </div>
    </AppPage>
  );
}
