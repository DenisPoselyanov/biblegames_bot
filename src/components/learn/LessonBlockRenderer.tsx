/**
 * Typed lesson-block dispatch (Phase 3 WS6, spec §11.3). Every block type the
 * server's `LESSON_BLOCK_TYPES` (`server/domains/learning/types.ts`) can send
 * has a renderer + a payload shape (`lessonBlockPayloads.ts`); an
 * unrecognized `blockType`, or a payload that fails its shape check, renders
 * `UnknownBlock` and logs instead of throwing — a bad block must not crash
 * the whole lesson.
 */
import { useState } from 'react';
import type { z } from 'zod';
import type { LessonBlock } from '../../../contracts/api/learning';
import { Icon } from '../Icon';
import { AnswerFeedback } from '../ui/AnswerFeedback';
import { AnswerOption } from '../ui/AnswerOption';
import {
  CharacterCardBlock,
  FillBlankBlock,
  MatchPairsBlock,
  MemoryVerseBlock,
  OrderEventsBlock,
  RevealBlock,
  ScenarioBlock,
  TrueFalseBlock,
} from './InteractiveBlocks';
import { resolveAssetSrc } from './interactiveBlockUtils';
import { LESSON_BLOCK_PAYLOAD_SCHEMAS, type questionPayload } from './lessonBlockPayloads';
import styles from './LessonBlockRenderer.module.css';

function logUnknownBlock(block: LessonBlock, reason: string): void {
  console.warn(`[LessonBlockRenderer] block ${block.id} (type "${block.blockType}") ${reason} — rendering fallback`);
}

function UnknownBlock() {
  return (
    <div className={styles.unknown} role="note">
      Цей елемент уроку тимчасово недоступний.
    </div>
  );
}

function QuestionBlock({ payload }: { payload: z.infer<typeof questionPayload> }) {
  const [selected, setSelected] = useState<number | null>(null);
  const graded = payload.correctIndex !== undefined;

  return (
    <div className={styles.question}>
      <p className={styles.prompt}>{payload.prompt}</p>
      <div className={styles.options}>
        {payload.options.map((option, index) => {
          let visualState: 'idle' | 'selected' | 'correct' | 'wrong' = 'idle';
          if (selected !== null && graded) {
            if (index === payload.correctIndex) visualState = 'correct';
            else if (index === selected) visualState = 'wrong';
          } else if (index === selected) {
            visualState = 'selected';
          }
          return (
            <AnswerOption
              key={option}
              visualState={visualState}
              disabled={selected !== null}
              onClick={() => setSelected(index)}
            >
              {option}
            </AnswerOption>
          );
        })}
      </div>
      {selected !== null && graded && (
        <AnswerFeedback correct={selected === payload.correctIndex} explanation={payload.explanation} />
      )}
    </div>
  );
}

type PayloadOf<T extends keyof typeof LESSON_BLOCK_PAYLOAD_SCHEMAS> = z.infer<(typeof LESSON_BLOCK_PAYLOAD_SCHEMAS)[T]>;

function BlockByType({
  blockId,
  blockType,
  payload,
  richBlocks,
}: {
  blockId: string;
  blockType: keyof typeof LESSON_BLOCK_PAYLOAD_SCHEMAS;
  payload: unknown;
  richBlocks?: boolean;
}) {
  switch (blockType) {
    case 'heading':
      return <h2 className={styles.heading}>{(payload as z.infer<typeof LESSON_BLOCK_PAYLOAD_SCHEMAS.heading>).text}</h2>;
    case 'text':
      return <p className={styles.text}>{(payload as z.infer<typeof LESSON_BLOCK_PAYLOAD_SCHEMAS.text>).text}</p>;
    case 'scripture': {
      const { reference, translation, text, isParaphrase } = payload as z.infer<
        typeof LESSON_BLOCK_PAYLOAD_SCHEMAS.scripture
      >;
      return (
        <blockquote className={richBlocks ? styles.scriptureParchment : styles.scripture}>
          <p className={styles.scriptureText}>{text}</p>
          <footer className={styles.scriptureMeta}>
            <cite>{reference}</cite>
            <span className={styles.translation}>{translation}</span>
            {isParaphrase && <span className={styles.paraphraseTag}>переказ</span>}
          </footer>
        </blockquote>
      );
    }
    case 'explanation': {
      const { text } = payload as z.infer<typeof LESSON_BLOCK_PAYLOAD_SCHEMAS.explanation>;
      if (richBlocks) {
        return (
          <div className={styles.insight}>
            <span className={styles.insightIcon}>
              <Icon name="star" size={17} />
            </span>
            <div className={styles.insightBody}>
              <p className={styles.insightKicker}>Інсайт</p>
              <p className={styles.insightText}>{text}</p>
            </div>
          </div>
        );
      }
      return <p className={styles.explanation}>{text}</p>;
    }
    case 'glossary': {
      const { term, definition } = payload as z.infer<typeof LESSON_BLOCK_PAYLOAD_SCHEMAS.glossary>;
      return (
        <dl className={styles.glossary}>
          <dt>{term}</dt>
          <dd>{definition}</dd>
        </dl>
      );
    }
    case 'image': {
      const { src, alt, caption, width, height } = payload as z.infer<typeof LESSON_BLOCK_PAYLOAD_SCHEMAS.image>;
      return (
        <figure className={styles.image}>
          <img
            src={resolveAssetSrc(src)}
            alt={alt}
            width={width}
            height={height}
            // Real ratio when known; otherwise the CSS default (16/9) still
            // reserves a box so the image can never cause layout shift.
            style={width && height ? { aspectRatio: `${width} / ${height}` } : undefined}
            loading="lazy"
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
          {caption && <figcaption>{caption}</figcaption>}
        </figure>
      );
    }
    case 'reflection':
      return <p className={styles.reflection}>{(payload as z.infer<typeof LESSON_BLOCK_PAYLOAD_SCHEMAS.reflection>).prompt}</p>;
    case 'question':
      return <QuestionBlock payload={payload as z.infer<typeof LESSON_BLOCK_PAYLOAD_SCHEMAS.question>} />;
    case 'summary':
      return <p className={styles.summary}>{(payload as z.infer<typeof LESSON_BLOCK_PAYLOAD_SCHEMAS.summary>).text}</p>;
    case 'next_step':
      return <p className={styles.nextStep}>{(payload as z.infer<typeof LESSON_BLOCK_PAYLOAD_SCHEMAS.next_step>).text}</p>;
    case 'true_false':
      return <TrueFalseBlock blockId={blockId} payload={payload as PayloadOf<'true_false'>} />;
    case 'order_events':
      return <OrderEventsBlock blockId={blockId} payload={payload as PayloadOf<'order_events'>} />;
    case 'fill_blank':
      return <FillBlankBlock blockId={blockId} payload={payload as PayloadOf<'fill_blank'>} />;
    case 'match_pairs':
      return <MatchPairsBlock blockId={blockId} payload={payload as PayloadOf<'match_pairs'>} />;
    case 'reveal':
      return <RevealBlock blockId={blockId} payload={payload as PayloadOf<'reveal'>} />;
    case 'scenario':
      return <ScenarioBlock blockId={blockId} payload={payload as PayloadOf<'scenario'>} />;
    case 'character_card':
      return <CharacterCardBlock blockId={blockId} payload={payload as PayloadOf<'character_card'>} />;
    case 'memory_verse':
      return <MemoryVerseBlock blockId={blockId} payload={payload as PayloadOf<'memory_verse'>} />;
  }
}

/** `richBlocks` (Phase 3.5 §4 audit, designSystemV2 only): scripture reads as a parchment card and `explanation` becomes an "insight" callout, instead of the plain-paragraph legacy look. */
export function LessonBlockRenderer({ block, richBlocks }: { block: LessonBlock; richBlocks?: boolean }) {
  const schema = LESSON_BLOCK_PAYLOAD_SCHEMAS[block.blockType as keyof typeof LESSON_BLOCK_PAYLOAD_SCHEMAS];
  if (!schema) {
    logUnknownBlock(block, 'is not a recognized block type');
    return <UnknownBlock />;
  }
  const parsed = schema.safeParse(block.payload);
  if (!parsed.success) {
    logUnknownBlock(block, 'has an invalid payload');
    return <UnknownBlock />;
  }
  return (
    <BlockByType
      blockId={block.id}
      blockType={block.blockType as keyof typeof LESSON_BLOCK_PAYLOAD_SCHEMAS}
      payload={parsed.data}
      richBlocks={richBlocks}
    />
  );
}
