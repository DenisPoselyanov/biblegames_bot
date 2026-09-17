import { motion } from 'framer-motion';
import {
  ChevronRight,
  Clock,
  Crown,
  Flame,
  Moon,
  Play,
  RotateCcw,
  Sun,
  Target,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PLANS, REVIEW_DUE, TODAY_LESSON, VERSE_OF_DAY, WEEK } from '../lib/mock';
import { levelProgress, useProto } from '../lib/useProto';
import { Button, Card, Cover, Meter, Ring, SectionTitle } from '../ui/kit';
import { cn } from '../ui/cn';

const TODAY_INDEX = 3; // Чт — fixed so the prototype always looks mid-week.
const DAILY_GOAL = 3;

export function Today() {
  const navigate = useNavigate();
  const { theme, toggleTheme, streak, coins, xp, lessonBlock, lessonDone, answeredToday } =
    useProto();
  const plan = PLANS.find((item) => item.id === TODAY_LESSON.planId)!;
  const level = levelProgress(xp);
  const goalDone = Math.min(DAILY_GOAL, (lessonDone ? 1 : 0) + Math.ceil(answeredToday / 5));
  const started = lessonBlock > 0 && !lessonDone;

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3 pt-1">
        <div>
          <p className="text-[12px] font-semibold tracking-[0.14em] text-faint uppercase">
            Четвер, 17 вересня
          </p>
          <h1 className="font-display mt-1 text-[27px] leading-[1.15] font-semibold">
            Доброго ранку,
            <br />
            Денисе
          </h1>
        </div>
        <button
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'}
          className="grid size-11 shrink-0 place-items-center rounded-full border border-line bg-surface backdrop-blur-xl"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      {/* Streak + daily goal: the one place gamification is allowed to be loud. */}
      <Card className="flex items-center gap-4 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full bg-[color-mix(in_srgb,var(--p-gold)_18%,transparent)]">
              <Flame size={17} className="text-gold-ink" />
            </span>
            <p className="text-[15px] font-bold">{streak} днів поспіль</p>
          </div>
          <div className="mt-3 flex gap-1.5">
            {WEEK.map((day, index) => {
              const past = index < TODAY_INDEX;
              const today = index === TODAY_INDEX;
              return (
                <div key={day} className="flex-1 text-center">
                  <div
                    className={cn(
                      'mx-auto grid h-7 w-full place-items-center rounded-[9px] text-[10px] font-bold transition-colors',
                      past && 'bg-[color-mix(in_srgb,var(--p-gold)_22%,transparent)] text-gold-ink',
                      today &&
                        'border border-[color-mix(in_srgb,var(--p-gold)_55%,transparent)] text-gold-ink',
                      !past && !today && 'bg-line text-faint',
                    )}
                  >
                    {day}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <Ring value={goalDone / DAILY_GOAL} size={64} stroke={6}>
          <div className="leading-none">
            <p className="text-[15px] font-extrabold">{goalDone}</p>
            <p className="text-[9px] font-semibold text-faint">із {DAILY_GOAL}</p>
          </div>
        </Ring>
      </Card>

      {/* Hero — the single decision the screen wants you to make. */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.04, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* The day's single decision. The whole card carries the plan's colour,
            so it stays the loudest object on the light theme too. */}
        <Card className="relative overflow-hidden p-0">
          <Cover
            hue={plan.hue}
            glyph="rays"
            fade={false}
            scrim
            className="absolute inset-0 h-full w-full"
          />
          <div className="relative flex min-h-[286px] flex-col justify-end p-4">
            <div className="absolute inset-x-4 top-4 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[12px] font-semibold text-white backdrop-blur-md">
                <Crown size={12} /> Урок дня
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/20 px-3 py-1 text-[12px] font-semibold text-white/85 backdrop-blur-md">
                <Clock size={12} /> {TODAY_LESSON.minutes} хв
              </span>
            </div>

            <p className="text-[12px] font-semibold text-white/72">
              {plan.title} · {TODAY_LESSON.moduleTitle}
            </p>
            <h2 className="font-display mt-1 text-[24px] leading-tight font-semibold text-white">
              {TODAY_LESSON.title}
            </h2>
            <p className="mt-1 text-[13px] text-white/70">{TODAY_LESSON.reference}</p>

            {started && (
              <div className="mt-4">
                <div className="mb-1.5 flex justify-between text-[11px] font-semibold text-white/70">
                  <span>Прочитано</span>
                  <span>
                    {lessonBlock} з {TODAY_LESSON.blocks.length}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-white"
                    style={{ width: `${(lessonBlock / TODAY_LESSON.blocks.length) * 100}%` }}
                  />
                </div>
              </div>
            )}

            <Button
              variant="onColor"
              size="lg"
              full
              className="mt-4"
              onClick={() => navigate('/lesson')}
            >
              <Play size={17} />
              {lessonDone ? 'Перечитати урок' : started ? 'Продовжити урок' : 'Почати урок'}
            </Button>
          </div>
        </Card>
      </motion.section>

      <section>
        <SectionTitle>Швидкий підхід</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <QuickTile
            icon={<Target size={18} />}
            title="Практика"
            meta="8 питань · 4 хв"
            onClick={() => navigate('/practice')}
            emphasis
          />
          <QuickTile
            icon={<RotateCcw size={18} />}
            title="Повторення"
            meta={`${REVIEW_DUE} на сьогодні`}
            onClick={() => navigate('/practice')}
          />
        </div>
      </section>

      <Card
        tone="outline"
        className="relative overflow-hidden bg-[color-mix(in_srgb,var(--p-parchment)_10%,transparent)] p-5"
      >
        <div className="absolute inset-y-0 left-0 w-[3px] bg-[linear-gradient(180deg,var(--p-gold),transparent)]" />
        <p className="text-[11px] font-semibold tracking-[0.16em] text-faint uppercase">
          Вірш дня
        </p>
        <blockquote className="font-display mt-2 text-[18px] leading-[1.45] italic">
          «{VERSE_OF_DAY.text}»
        </blockquote>
        <p className="mt-2 text-[13px] font-semibold text-gold-ink">{VERSE_OF_DAY.reference}</p>
      </Card>

      <button
        onClick={() => navigate('/progress')}
        className="flex w-full items-center justify-between rounded-tile border border-line bg-surface px-4 py-3 text-left backdrop-blur-xl"
      >
        <div>
          <p className="text-[13px] font-bold">Рівень {level.level}</p>
          <p className="text-[11px] text-faint">
            {level.toNext} XP до наступного · {coins} монет
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-20">
            <Meter value={level.pct} />
          </div>
          <ChevronRight size={16} className="text-faint" />
        </div>
      </button>
    </div>
  );
}

function QuickTile({
  icon,
  title,
  meta,
  onClick,
  emphasis,
}: {
  icon: React.ReactNode;
  title: string;
  meta: string;
  onClick: () => void;
  emphasis?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-tile border p-4 text-left backdrop-blur-xl transition-transform active:scale-[0.98]',
        emphasis
          ? 'border-[color-mix(in_srgb,var(--p-violet)_38%,transparent)] bg-[linear-gradient(140deg,color-mix(in_srgb,var(--p-indigo)_22%,transparent),color-mix(in_srgb,var(--p-violet)_12%,transparent))]'
          : 'border-line bg-surface',
      )}
    >
      <span className="grid size-9 place-items-center rounded-full border border-line bg-surface-2 text-gold-ink">
        {icon}
      </span>
      <p className="mt-3 text-[15px] font-bold">{title}</p>
      <p className="text-[12px] text-faint">{meta}</p>
    </button>
  );
}
