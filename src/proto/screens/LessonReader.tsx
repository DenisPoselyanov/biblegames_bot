import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Lightbulb, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TODAY_LESSON, type LessonBlock } from '../lib/mock';
import { useProto } from '../lib/useProto';
import { Button, Card, Cover, Ring } from '../ui/kit';
import { cn } from '../ui/cn';

export function LessonReader() {
  const navigate = useNavigate();
  const { lessonBlock, setLessonBlock, completeLesson } = useProto();
  const blocks = TODAY_LESSON.blocks;
  const [visible, setVisible] = useState(() => Math.max(1, Math.min(lessonBlock, blocks.length)));
  const [checkpointAnswer, setCheckpointAnswer] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLessonBlock(visible);
  }, [visible, setLessonBlock]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [visible, checkpointAnswer, finished]);

  const current = blocks[visible - 1];
  const gated =
    current?.kind === 'checkpoint' && checkpointAnswer !== current.correct;
  const last = visible >= blocks.length;

  function advance() {
    if (last) {
      completeLesson();
      setFinished(true);
      return;
    }
    setVisible((value) => value + 1);
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-[calc(max(18px,env(safe-area-inset-top))*-1)] z-20 -mx-4 -mt-[max(18px,env(safe-area-inset-top))] bg-[color-mix(in_srgb,var(--p-canvas)_82%,transparent)] px-4 pt-[max(22px,calc(env(safe-area-inset-top)+4px))] pb-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            aria-label="Закрити урок"
            className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-surface"
          >
            <X size={16} />
          </button>
          <div className="flex min-w-0 flex-1 gap-1">
            {blocks.map((_, index) => (
              <span
                key={index}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors duration-300',
                  index < visible
                    ? 'bg-[linear-gradient(90deg,var(--p-violet),var(--p-ramp-end))]'
                    : 'bg-line-strong',
                )}
              />
            ))}
          </div>
          <span className="shrink-0 text-[11px] font-bold text-faint">
            {Math.min(visible, blocks.length)}/{blocks.length}
          </span>
        </div>
      </header>

      <div className="flex-1 pb-28">
        <p className="mt-1 text-[11px] font-semibold tracking-[0.14em] text-faint uppercase">
          {TODAY_LESSON.moduleTitle}
        </p>
        <h1 className="font-display mt-1.5 text-[28px] leading-[1.15] font-semibold">
          {TODAY_LESSON.title}
        </h1>
        <p className="mt-1.5 text-[13px] font-semibold text-gold-ink">{TODAY_LESSON.reference}</p>

        <div className="mt-6 space-y-5">
          {blocks.slice(0, visible).map((block, index) => (
            <Block
              key={index}
              block={block}
              answer={checkpointAnswer}
              onAnswer={setCheckpointAnswer}
            />
          ))}
        </div>

        <div ref={bottomRef} />
      </div>

      <AnimatePresence>
        {finished && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-40 mx-auto flex w-full max-w-[390px] flex-col justify-center bg-[color-mix(in_srgb,var(--p-canvas)_82%,transparent)] px-4 backdrop-blur-xl"
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 24 }}
            >
              <Card tone="solid" className="relative overflow-hidden p-0">
                <Cover hue={268} glyph="rays" fade={false} scrim className="absolute inset-0 h-full w-full" />
                <div className="relative grid place-items-center px-5 py-7 text-center">
                  <Ring value={1} size={84} stroke={7}>
                    <Check size={30} className="text-white" strokeWidth={2.6} />
                  </Ring>
                  <h2 className="font-display mt-4 text-[23px] font-semibold text-white">
                    Урок завершено
                  </h2>
                  <p className="mt-1.5 text-[13px] text-white/75">
                    Закріпіть прочитане практикою, поки воно свіже
                  </p>
                  <div className="mt-4 flex gap-2">
                    <span className="rounded-full border border-white/20 bg-white/12 px-3 py-1 text-[12px] font-bold text-white">
                      +40 XP
                    </span>
                    <span className="rounded-full border border-white/20 bg-white/12 px-3 py-1 text-[12px] font-bold text-white">
                      +15 монет
                    </span>
                  </div>
                  <Button
                    variant="onColor"
                    size="lg"
                    full
                    className="mt-6"
                    onClick={() => navigate('/practice')}
                  >
                    <Sparkles size={16} /> До практики
                  </Button>
                  <button
                    onClick={() => navigate('/')}
                    className="mt-2 w-full py-2 text-[13px] font-semibold text-white/70"
                  >
                    Пізніше
                  </button>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {!finished && (
        <div className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-[390px] bg-[linear-gradient(180deg,transparent,var(--p-canvas)_36%)] px-4 pt-8 pb-[max(16px,env(safe-area-inset-bottom))]">
          <Button variant={gated ? 'ghost' : 'primary'} size="lg" full disabled={gated} onClick={advance}>
            {gated ? 'Дайте відповідь, щоб продовжити' : last ? 'Завершити урок' : 'Далі'}
            {!gated && <ChevronDown size={17} className="-rotate-90" />}
          </Button>
        </div>
      )}
    </div>
  );
}

function Block({
  block,
  answer,
  onAnswer,
}: {
  block: LessonBlock;
  answer: number | null;
  onAnswer: (index: number) => void;
}) {
  const shell = (children: React.ReactNode) => (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );

  if (block.kind === 'paragraph') {
    return shell(<p className="text-[16px] leading-[1.68] text-muted">{block.text}</p>);
  }

  if (block.kind === 'scripture') {
    // The one place the dark shell opens into light: Scripture reads on paper.
    return shell(
      <figure className="rounded-card bg-parchment px-5 py-5 text-parchment-ink shadow-lift">
        <blockquote className="font-display text-[18px] leading-[1.6]">{block.text}</blockquote>
        <figcaption className="mt-3 text-[12px] font-bold tracking-[0.08em] opacity-70 uppercase">
          {block.reference}
        </figcaption>
      </figure>,
    );
  }

  if (block.kind === 'insight') {
    return shell(
      <Card className="flex gap-3 p-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--p-gold)_16%,transparent)]">
          <Lightbulb size={17} className="text-gold-ink" />
        </span>
        <div>
          <p className="text-[11px] font-semibold tracking-[0.12em] text-gold-ink uppercase">
            {block.title}
          </p>
          <p className="mt-1 text-[15px] leading-[1.6]">{block.text}</p>
        </div>
      </Card>,
    );
  }

  if (block.kind === 'figure') {
    return shell(
      <figure>
        <Cover hue={block.hue} glyph="path" className="h-40 w-full rounded-card" />
        <figcaption className="mt-2 text-center text-[12px] text-faint">{block.caption}</figcaption>
      </figure>,
    );
  }

  const answered = answer !== null;
  const correct = answer === block.correct;

  return shell(
    <Card tone="solid" className="p-4">
      <p className="text-[11px] font-semibold tracking-[0.12em] text-faint uppercase">
        Перевірка розуміння
      </p>
      <p className="font-display mt-1.5 text-[18px] leading-snug font-semibold">{block.question}</p>
      <div className="mt-3 space-y-2">
        {block.options.map((option, index) => {
          const chosen = answer === index;
          const isRight = index === block.correct;
          return (
            <button
              key={option}
              onClick={() => !correct && onAnswer(index)}
              className={cn(
                'flex w-full items-center gap-3 rounded-control border px-3.5 py-3 text-left text-[14px] font-medium transition-colors',
                !answered && 'border-line bg-surface active:scale-[0.99]',
                answered && isRight &&
                  'border-[color-mix(in_srgb,var(--p-success)_55%,transparent)] bg-[color-mix(in_srgb,var(--p-success)_14%,transparent)]',
                answered && chosen && !isRight &&
                  'border-[color-mix(in_srgb,var(--p-danger)_55%,transparent)] bg-[color-mix(in_srgb,var(--p-danger)_12%,transparent)]',
                answered && !chosen && !isRight && 'border-line opacity-50',
              )}
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-full border border-line-strong text-[11px] font-bold">
                {String.fromCharCode(1040 + index)}
              </span>
              {option}
            </button>
          );
        })}
      </div>
      <AnimatePresence>
        {answered && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-3 text-[13px] leading-relaxed text-muted"
          >
            {block.why}
          </motion.p>
        )}
      </AnimatePresence>
    </Card>,
  );
}
