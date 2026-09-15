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
import { AnswerFeedback } from '../ui/AnswerFeedback';
import { AnswerOption } from '../ui/AnswerOption';
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

function BlockByType({ blockType, payload }: { blockType: keyof typeof LESSON_BLOCK_PAYLOAD_SCHEMAS; payload: unknown }) {
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
        <blockquote className={styles.scripture}>
          <p className={styles.scriptureText}>{text}</p>
          <footer className={styles.scriptureMeta}>
            <cite>{reference}</cite>
            <span className={styles.translation}>{translation}</span>
            {isParaphrase && <span className={styles.paraphraseTag}>переказ</span>}
          </footer>
        </blockquote>
      );
    }
    case 'explanation':
      return <p className={styles.explanation}>{(payload as z.infer<typeof LESSON_BLOCK_PAYLOAD_SCHEMAS.explanation>).text}</p>;
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
      const { src, alt, caption } = payload as z.infer<typeof LESSON_BLOCK_PAYLOAD_SCHEMAS.image>;
      return (
        <figure className={styles.image}>
          <img src={src} alt={alt} loading="lazy" onError={(e) => (e.currentTarget.style.display = 'none')} />
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
  }
}

export function LessonBlockRenderer({ block }: { block: LessonBlock }) {
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
  return <BlockByType blockType={block.blockType as keyof typeof LESSON_BLOCK_PAYLOAD_SCHEMAS} payload={parsed.data} />;
}
