import { motion } from 'framer-motion';
import { Check, Flame, Heart, RotateCcw, X, Zap } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PRACTICE_QUESTIONS } from '../lib/mock';
import { useProto } from '../lib/useProto';
import { Button, Card, Cover, Ring } from '../ui/kit';
import { cn } from '../ui/cn';

const LIVES = 3;

export function Survival() {
  const navigate = useNavigate();
  const { finishPractice } = useProto();
  const [step, setStep] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const [streak, setStreak] = useState(0);
  const [best] = useState(14);
  const [chosen, setChosen] = useState<number | null>(null);

  const question = PRACTICE_QUESTIONS[step % PRACTICE_QUESTIONS.length];
  const answered = chosen !== null;
  const dead = lives === 0;

  function choose(index: number) {
    if (answered || dead) return;
    setChosen(index);
    const right = index === question.correct;
    window.setTimeout(() => {
      if (right) {
        setStreak((value) => value + 1);
      } else {
        const left = lives - 1;
        setLives(left);
        setStreak(0);
        if (left === 0) {
          finishPractice({
            total: step + 1,
            correct: streak,
            xp: streak * 8,
            coins: streak * 3,
            durationSec: 0,
            wrongIds: [],
          });
          return;
        }
      }
      setStep((value) => value + 1);
      setChosen(null);
    }, 1100);
  }

  if (dead) {
    return (
      <div className="grid h-full place-items-center">
        <Card className="relative w-full overflow-hidden p-0">
          <Cover hue={348} glyph="wave" fade={false} scrim className="absolute inset-0 h-full w-full" />
          <div className="relative grid place-items-center px-5 py-8 text-center">
            <Ring value={Math.min(1, step / Math.max(best, 1))} size={92} stroke={7}>
              <div>
                <p className="text-[26px] leading-none font-extrabold text-white tabular-nums">{step}</p>
                <p className="text-[10px] font-semibold text-white/70">питань</p>
              </div>
            </Ring>
            <h1 className="font-display mt-4 text-[24px] font-semibold text-white">
              Життя скінчились
            </h1>
            <p className="mt-1.5 text-[13px] text-white/75">
              {step > best ? 'Новий рекорд!' : `Ваш рекорд — ${best} питань`}
            </p>
            <Button
              variant="onColor"
              size="lg"
              full
              className="mt-6"
              onClick={() => {
                setLives(LIVES);
                setStep(0);
                setStreak(0);
                setChosen(null);
              }}
            >
              <RotateCcw size={16} /> Ще раз
            </Button>
            <button
              onClick={() => navigate('/play')}
              className="mt-2 w-full py-2 text-[13px] font-semibold text-white/70"
            >
              До ігор
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center gap-3 pt-1">
        <button
          onClick={() => navigate('/play')}
          aria-label="Вийти з гри"
          className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-surface"
        >
          <X size={16} />
        </button>
        <div className="flex flex-1 items-center gap-1">
          {Array.from({ length: LIVES }).map((_, index) => (
            <motion.span
              key={index}
              animate={index < lives ? { scale: 1, opacity: 1 } : { scale: 0.85, opacity: 0.3 }}
            >
              <Heart
                size={20}
                className={index < lives ? 'text-danger' : 'text-faint'}
                fill={index < lives ? 'currentColor' : 'none'}
              />
            </motion.span>
          ))}
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[13px] font-extrabold tabular-nums">
          <Flame size={13} className="text-gold-ink" /> {streak}
        </div>
      </header>

      <div className="flex flex-1 flex-col pt-8">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-faint uppercase">
          Питання {step + 1} · рекорд {best}
        </p>
        <h1 className="font-display mt-2 text-[25px] leading-[1.22] font-semibold">
          {question.prompt}
        </h1>

        <div className="mt-6 space-y-2.5">
          {question.options.map((option, index) => {
            const picked = chosen === index;
            const right = index === question.correct;
            return (
              <button
                key={option}
                disabled={answered}
                onClick={() => choose(index)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-tile border px-4 py-3.5 text-left text-[15px] font-semibold backdrop-blur-xl transition-colors',
                  !answered && 'border-line bg-surface active:scale-[0.99]',
                  answered && right &&
                    'border-[color-mix(in_srgb,var(--p-success)_60%,transparent)] bg-[color-mix(in_srgb,var(--p-success)_16%,transparent)]',
                  answered && picked && !right &&
                    'border-[color-mix(in_srgb,var(--p-danger)_60%,transparent)] bg-[color-mix(in_srgb,var(--p-danger)_14%,transparent)]',
                  answered && !picked && !right && 'opacity-45',
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
                    String.fromCharCode(1040 + index)
                  )}
                </span>
                {option}
              </button>
            );
          })}
        </div>
      </div>

      <p className="flex items-center justify-center gap-1.5 py-5 text-[12px] font-semibold text-faint">
        <Zap size={13} /> Кожні 5 правильних поспіль — +1 життя
      </p>
    </div>
  );
}
