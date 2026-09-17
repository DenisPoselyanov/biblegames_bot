import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, BookMarked, Check, Timer, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PRACTICE_QUESTIONS } from '../lib/mock';
import { useProto } from '../lib/useProto';
import { Button, Card, Ring } from '../ui/kit';
import { cn } from '../ui/cn';

const PER_QUESTION_SEC = 30;

export function Practice() {
  const navigate = useNavigate();
  const { finishPractice } = useProto();
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const [left, setLeft] = useState(PER_QUESTION_SEC);
  const startedAt = useRef(0);

  const question = PRACTICE_QUESTIONS[index];
  const answered = chosen !== null;
  const isCorrect = chosen === question.correct;

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  // Scoring lives in the handler, not in an effect: one answer, one state update.
  function choose(optionIndex: number) {
    if (chosen !== null) return;
    setChosen(optionIndex);
    if (optionIndex === question.correct) setCorrectCount((value) => value + 1);
    else setWrongIds((value) => [...value, question.id]);
  }

  useEffect(() => {
    if (answered) return undefined;
    const deadline = Date.now() + PER_QUESTION_SEC * 1000;
    const id = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining === 0) {
        window.clearInterval(id);
        choose(-1); // running out of time counts as a miss
      }
    }, 250);
    return () => window.clearInterval(id);
    // `choose` is recreated every render but only ever closes over the current,
    // unanswered question — which is exactly what this effect's deps describe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered, index]);

  function next() {
    if (index + 1 >= PRACTICE_QUESTIONS.length) {
      const total = PRACTICE_QUESTIONS.length;
      finishPractice({
        total,
        correct: correctCount,
        xp: correctCount * 12,
        coins: correctCount * 4,
        durationSec: Math.round((Date.now() - startedAt.current) / 1000),
        wrongIds,
      });
      navigate('/practice/result');
      return;
    }
    setIndex((value) => value + 1);
    setChosen(null);
    setLeft(PER_QUESTION_SEC);
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center gap-3 pt-1">
        <button
          onClick={() => navigate('/')}
          aria-label="Вийти з практики"
          className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-surface"
        >
          <X size={16} />
        </button>
        <div className="flex min-w-0 flex-1 gap-1">
          {PRACTICE_QUESTIONS.map((item, i) => (
            <span
              key={item.id}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors',
                i < index
                  ? wrongIds.includes(item.id)
                    ? 'bg-danger'
                    : 'bg-success'
                  : i === index
                    ? 'bg-gold'
                    : 'bg-line-strong',
              )}
            />
          ))}
        </div>
        <div
          className={cn(
            'flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-bold tabular-nums',
            left <= 5 && !answered
              ? 'border-[color-mix(in_srgb,var(--p-danger)_50%,transparent)] text-danger'
              : 'border-line text-muted',
          )}
        >
          <Timer size={12} />
          {left}
        </div>
      </header>

      <div className="flex flex-1 flex-col pt-7">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-faint uppercase">
          {question.theme} · питання {index + 1} з {PRACTICE_QUESTIONS.length}
        </p>
        <h1 className="font-display mt-2 text-[25px] leading-[1.22] font-semibold">
          {question.prompt}
        </h1>

        <div className="mt-6 space-y-2.5">
          {question.options.map((option, optionIndex) => {
            const picked = chosen === optionIndex;
            const right = optionIndex === question.correct;
            return (
              <motion.button
                key={option}
                data-proto-option={optionIndex}
                disabled={answered}
                onClick={() => choose(optionIndex)}
                whileTap={{ scale: answered ? 1 : 0.985 }}
                animate={
                  answered && picked && !right
                    ? { x: [0, -6, 6, -3, 0] }
                    : answered && right
                      ? { scale: [1, 1.015, 1] }
                      : {}
                }
                transition={{ duration: 0.34 }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-tile border px-4 py-3.5 text-left text-[15px] font-semibold backdrop-blur-xl transition-colors',
                  !answered && 'border-line bg-surface',
                  answered && right &&
                    'border-[color-mix(in_srgb,var(--p-success)_60%,transparent)] bg-[color-mix(in_srgb,var(--p-success)_16%,transparent)] shadow-[0_0_30px_-10px_var(--p-success)]',
                  answered && picked && !right &&
                    'border-[color-mix(in_srgb,var(--p-danger)_60%,transparent)] bg-[color-mix(in_srgb,var(--p-danger)_14%,transparent)]',
                  answered && !picked && !right && 'border-line opacity-45',
                )}
              >
                <span
                  className={cn(
                    'grid size-7 shrink-0 place-items-center rounded-full border text-[12px] font-extrabold',
                    answered && right
                      ? 'border-transparent bg-success text-canvas'
                      : answered && picked
                        ? 'border-transparent bg-danger text-canvas'
                        : 'border-line-strong',
                  )}
                >
                  {answered && right ? (
                    <Check size={14} strokeWidth={3} />
                  ) : answered && picked ? (
                    <X size={14} strokeWidth={3} />
                  ) : (
                    String.fromCharCode(1040 + optionIndex)
                  )}
                </span>
                <span className="min-w-0">{option}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Explanation sheet — the learning half of the loop, not a toast. */}
      <AnimatePresence>
        {answered && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[390px] px-3 pb-[max(12px,env(safe-area-inset-bottom))]"
          >
            <Card tone="solid" className="p-4">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'grid size-8 place-items-center rounded-full',
                    isCorrect
                      ? 'bg-[color-mix(in_srgb,var(--p-success)_18%,transparent)] text-success'
                      : 'bg-[color-mix(in_srgb,var(--p-danger)_18%,transparent)] text-danger',
                  )}
                >
                  {isCorrect ? <Check size={16} strokeWidth={3} /> : <X size={16} strokeWidth={3} />}
                </span>
                <p className="text-[16px] font-extrabold">
                  {isCorrect ? 'Правильно' : chosen === -1 ? 'Час вийшов' : 'Не зовсім'}
                </p>
                {isCorrect && (
                  <span className="ml-auto rounded-full bg-[color-mix(in_srgb,var(--p-gold)_16%,transparent)] px-2.5 py-1 text-[12px] font-bold text-gold-ink">
                    +12 XP
                  </span>
                )}
              </div>
              <p className="mt-2.5 text-[14px] leading-[1.55] text-muted">{question.explanation}</p>
              <p className="mt-2 flex items-center gap-1.5 text-[12px] font-bold text-gold-ink">
                <BookMarked size={13} /> {question.reference}
              </p>
              <Button
                data-proto-next
                variant="primary"
                size="lg"
                full
                className="mt-4"
                onClick={next}
              >
                {index + 1 >= PRACTICE_QUESTIONS.length ? 'Показати результат' : 'Далі'}
                <ArrowRight size={17} />
              </Button>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {!answered && (
        <div className="grid place-items-center py-6 opacity-70">
          <Ring value={left / PER_QUESTION_SEC} size={44} stroke={4}>
            <span className="text-[11px] font-bold tabular-nums">{left}</span>
          </Ring>
        </div>
      )}
    </div>
  );
}
