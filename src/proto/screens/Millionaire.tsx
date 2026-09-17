import { AnimatePresence, motion } from 'framer-motion';
import { BookMarked, Check, Coins, Home, RotateCcw, Scissors, Users, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LADDER, PRACTICE_QUESTIONS } from '../lib/mock';
import { useProto } from '../lib/useProto';
import { Button, Card, Cover } from '../ui/kit';
import { cn } from '../ui/cn';

type Lifeline = 'half' | 'crowd' | 'verse';

const LIFELINES: Array<{ id: Lifeline; label: string; icon: typeof Scissors }> = [
  { id: 'half', label: '50 на 50', icon: Scissors },
  { id: 'crowd', label: 'Спільнота', icon: Users },
  { id: 'verse', label: 'Вірш', icon: BookMarked },
];

export function Millionaire() {
  const navigate = useNavigate();
  const { finishPractice } = useProto();
  const [step, setStep] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [used, setUsed] = useState<Lifeline[]>([]);
  const [hidden, setHidden] = useState<number[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [over, setOver] = useState<'won' | 'lost' | null>(null);

  const question = PRACTICE_QUESTIONS[step % PRACTICE_QUESTIONS.length];
  const rung = LADDER[step];
  const answered = chosen !== null;
  const banked = step === 0 ? 0 : LADDER[step - 1].prize;

  function spendLifeline(id: Lifeline) {
    if (used.includes(id) || answered) return;
    setUsed((value) => [...value, id]);
    if (id === 'half') {
      const wrong = question.options
        .map((_, index) => index)
        .filter((index) => index !== question.correct)
        .slice(0, 2);
      setHidden(wrong);
    }
    if (id === 'crowd') {
      setHint(`Спільнота: ${68}% обрали «${question.options[question.correct]}»`);
    }
    if (id === 'verse') setHint(`Шукайте відповідь у ${question.reference}`);
  }

  function choose(index: number) {
    if (answered) return;
    setChosen(index);
    window.setTimeout(() => {
      if (index === question.correct) {
        if (step + 1 >= LADDER.length) {
          setOver('won');
          finishPractice({
            total: LADDER.length,
            correct: LADDER.length,
            xp: 240,
            coins: LADDER[LADDER.length - 1].prize,
            durationSec: 0,
            wrongIds: [],
          });
          return;
        }
        setStep((value) => value + 1);
        setChosen(null);
        setHidden([]);
        setHint(null);
      } else {
        setOver('lost');
      }
    }, 1400);
  }

  if (over) {
    const prize = over === 'won' ? LADDER[LADDER.length - 1].prize : lastSafe(step);
    return (
      <div className="grid h-full place-items-center">
        <Card className="relative w-full overflow-hidden p-0">
          <Cover hue={268} glyph="rays" fade={false} scrim className="absolute inset-0 h-full w-full" />
          <div className="relative grid place-items-center px-5 py-8 text-center">
            <p className="text-[12px] font-semibold tracking-[0.16em] text-white/70 uppercase">
              {over === 'won' ? 'Усі 15 питань' : `Зупинились на питанні ${step + 1}`}
            </p>
            <h1 className="font-display mt-2 text-[26px] font-semibold text-white">
              {over === 'won' ? 'Мільйонер!' : 'Гру завершено'}
            </h1>
            <div className="mt-4 flex items-center gap-2 rounded-full border border-white/20 bg-white/12 px-4 py-2 text-white">
              <Coins size={16} />
              <span className="text-[18px] font-extrabold tabular-nums">{prize}</span>
              <span className="text-[13px] text-white/70">монет</span>
            </div>
            <Button
              variant="onColor"
              size="lg"
              full
              className="mt-6"
              onClick={() => {
                setOver(null);
                setStep(0);
                setChosen(null);
                setUsed([]);
                setHidden([]);
                setHint(null);
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
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-faint uppercase">
            Мільйонер · питання {rung.level}
          </p>
          <p className="text-[13px] font-bold">
            У банку <span className="tabular-nums text-gold-ink">{banked}</span> монет
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--p-gold)_40%,transparent)] bg-[color-mix(in_srgb,var(--p-gold)_12%,transparent)] px-3 py-1.5 text-[13px] font-extrabold text-gold-ink tabular-nums">
          <Coins size={13} /> {rung.prize}
        </div>
      </header>

      {/* Ladder — a horizontal strip keeps the question the hero on a phone. */}
      <div className="proto-scroll mt-4 flex gap-1 overflow-x-auto pb-1">
        {LADDER.map((item, index) => (
          <span
            key={item.level}
            className={cn(
              'grid h-7 min-w-9 shrink-0 place-items-center rounded-[9px] border px-1.5 text-[11px] font-bold tabular-nums',
              index < step && 'border-transparent bg-[color-mix(in_srgb,var(--p-success)_22%,transparent)] text-success',
              index === step && 'border-transparent bg-[linear-gradient(135deg,var(--p-indigo),var(--p-violet))] text-white',
              index > step && item.safe && 'border-[color-mix(in_srgb,var(--p-gold)_45%,transparent)] text-gold-ink',
              index > step && !item.safe && 'border-line text-faint',
            )}
          >
            {item.level}
          </span>
        ))}
      </div>

      <h1 className="font-display mt-6 text-[24px] leading-[1.24] font-semibold">
        {question.prompt}
      </h1>

      <AnimatePresence>
        {hint && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 rounded-tile border border-[color-mix(in_srgb,var(--p-gold)_35%,transparent)] bg-[color-mix(in_srgb,var(--p-gold)_10%,transparent)] px-3.5 py-2.5 text-[13px] font-semibold text-gold-ink"
          >
            {hint}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="mt-5 space-y-2.5">
        {question.options.map((option, index) => {
          const gone = hidden.includes(index);
          const picked = chosen === index;
          const right = index === question.correct;
          return (
            <button
              key={option}
              disabled={answered || gone}
              onClick={() => choose(index)}
              className={cn(
                'flex w-full items-center gap-3 rounded-tile border px-4 py-3.5 text-left text-[15px] font-semibold backdrop-blur-xl transition-colors',
                gone && 'pointer-events-none opacity-25',
                !answered && !gone && 'border-line bg-surface active:scale-[0.99]',
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

      <div className="mt-auto grid grid-cols-3 gap-2 pt-6 pb-1">
        {LIFELINES.map(({ id, label, icon: Icon }) => {
          const spent = used.includes(id);
          return (
            <button
              key={id}
              disabled={spent || answered}
              onClick={() => spendLifeline(id)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-tile border px-2 py-3 text-[11px] font-semibold',
                spent ? 'border-line text-faint line-through opacity-45' : 'border-line bg-surface',
              )}
            >
              <Icon size={16} className={cn(!spent && 'text-gold-ink')} />
              {label}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => navigate('/play')}
        className="mb-1 flex items-center justify-center gap-2 py-2 text-[13px] font-semibold text-faint"
      >
        <Home size={14} /> Забрати {banked} монет і вийти
      </button>
    </div>
  );
}

/** Falling below a guaranteed rung still pays the last one reached. */
function lastSafe(step: number): number {
  const safe = LADDER.slice(0, step).filter((item) => item.safe);
  return safe.length ? safe[safe.length - 1].prize : 0;
}
