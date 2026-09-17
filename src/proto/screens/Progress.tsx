import { motion } from 'framer-motion';
import { Fragment } from 'react';
import { Award, BookOpen, Flame, Moon, Sparkles, Target, Zap } from 'lucide-react';
import {
  ACHIEVEMENTS,
  ACTIVITY,
  ACTIVITY_START,
  MASTERY_BY_THEME,
  TODAY_DATE,
  WEEK,
} from '../lib/mock';
import { levelProgress, useProto } from '../lib/useProto';
import { Card, Meter, Ring, SectionTitle } from '../ui/kit';
import { cn } from '../ui/cn';

const ICONS: Record<string, React.ReactNode> = {
  flame: <Flame size={18} />,
  book: <BookOpen size={18} />,
  target: <Target size={18} />,
  sparkles: <Sparkles size={18} />,
  moon: <Moon size={18} />,
};

const MONTHS = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'];

interface Day {
  date: Date;
  count: number;
  future: boolean;
  today: boolean;
}

/** Turns the flat activity array into three Mon–Sun rows with real dates. */
function buildWeeks(): Day[][] {
  const start = new Date(ACTIVITY_START.year, ACTIVITY_START.month, ACTIVITY_START.day);
  const today = new Date(TODAY_DATE.year, TODAY_DATE.month, TODAY_DATE.day);
  const days: Day[] = ACTIVITY.map((count, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date,
      count,
      future: date > today,
      today: date.getTime() === today.getTime(),
    };
  });
  return [days.slice(0, 7), days.slice(7, 14), days.slice(14, 21)];
}

function rangeLabel(week: Day[]): string {
  const from = week[0].date;
  const to = week[6].date;
  return from.getMonth() === to.getMonth()
    ? `${from.getDate()}–${to.getDate()} ${MONTHS[to.getMonth()]}`
    : `${from.getDate()} ${MONTHS[from.getMonth()]} – ${to.getDate()} ${MONTHS[to.getMonth()]}`;
}

function levelClass(count: number): string {
  if (count === 0) return 'bg-line text-faint';
  if (count <= 2) return 'bg-[color-mix(in_srgb,var(--p-violet)_30%,transparent)] text-ink';
  if (count <= 3) return 'bg-[color-mix(in_srgb,var(--p-violet)_55%,transparent)] text-white';
  return 'bg-[var(--p-ramp-end)] text-white';
}

export function Progress() {
  const { xp, streak, coins } = useProto();
  const level = levelProgress(xp);
  const weeks = buildWeeks();
  const activeDays = ACTIVITY.filter((count) => count > 0).length;

  return (
    <div className="space-y-5">
      <header className="pt-1">
        <h1 className="font-display text-[27px] leading-tight font-semibold">Прогрес</h1>
        <p className="mt-1 text-[13px] text-muted">Що вже міцно, а що почало забуватися</p>
      </header>

      <Card className="flex items-center gap-4 p-5">
        <Ring value={level.pct} size={92} stroke={8}>
          <div>
            <p className="text-[22px] leading-none font-extrabold">{level.level}</p>
            <p className="text-[9px] font-semibold text-faint">рівень</p>
          </div>
        </Ring>
        <div className="min-w-0 flex-1 space-y-2.5">
          <Row icon={<Zap size={14} />} label="Досвід" value={`${xp} XP`} />
          <Row icon={<Flame size={14} />} label="Серія" value={`${streak} днів`} />
          <Row icon={<Award size={14} />} label="Монети" value={String(coins)} />
        </div>
      </Card>

      <section>
        <SectionTitle
          action={<span className="text-[11px] font-semibold text-faint">{activeDays} активних днів</span>}
        >
          Активність
        </SectionTitle>
        <Card className="p-4">
          <div className="grid grid-cols-[4.5rem_repeat(7,1fr)] items-center gap-x-1.5 gap-y-1.5">
            <span />
            {WEEK.map((day) => (
              <span key={day} className="text-center text-[10px] font-bold text-faint">
                {day}
              </span>
            ))}

            {weeks.map((week) => (
              <Fragment key={week[0].date.toISOString()}>
                <span className="text-[9px] leading-tight font-semibold whitespace-nowrap text-faint">
                  {rangeLabel(week)}
                </span>
                {week.map((day, index) => (
                  <motion.span
                    key={day.date.toISOString()}
                    initial={{ opacity: 0, scale: 0.75 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.015, duration: 0.22 }}
                    title={
                      day.future
                        ? 'Ще попереду'
                        : `${day.date.getDate()} ${MONTHS[day.date.getMonth()]} — ${day.count} сесій`
                    }
                    className={cn(
                      'grid aspect-square place-items-center rounded-[9px] text-[11px] font-bold tabular-nums',
                      day.future
                        ? 'border border-dashed border-line-strong text-faint opacity-50'
                        : levelClass(day.count),
                      day.today &&
                        'ring-2 ring-[var(--p-gold)] ring-offset-2 ring-offset-[var(--p-canvas)]',
                    )}
                  >
                    {day.date.getDate()}
                  </motion.span>
                ))}
              </Fragment>
            ))}
          </div>

          <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line pt-3 text-[10px] font-semibold text-faint">
            <Legend className="bg-line">немає</Legend>
            <Legend className="bg-[color-mix(in_srgb,var(--p-violet)_30%,transparent)]">1–2</Legend>
            <Legend className="bg-[color-mix(in_srgb,var(--p-violet)_55%,transparent)]">3</Legend>
            <Legend className="bg-[var(--p-ramp-end)]">4+</Legend>
            <Legend className="ring-2 ring-[var(--p-gold)]">сьогодні</Legend>
          </div>
        </Card>
      </section>

      <section>
        <SectionTitle>Майстерність за темами</SectionTitle>
        <Card className="space-y-3.5 p-4">
          {MASTERY_BY_THEME.map((item) => (
            <div key={item.theme}>
              <div className="mb-1.5 flex items-center justify-between text-[13px]">
                <span className="font-semibold">{item.theme}</span>
                <span
                  className={cn(
                    'text-[12px] font-bold tabular-nums',
                    item.value >= 0.7 ? 'text-success' : item.value >= 0.4 ? 'text-gold-ink' : 'text-faint',
                  )}
                >
                  {Math.round(item.value * 100)}%
                </span>
              </div>
              <Meter value={item.value} />
            </div>
          ))}
        </Card>
      </section>

      <section>
        <SectionTitle>Досягнення</SectionTitle>
        <div className="grid grid-cols-3 gap-2.5">
          {ACHIEVEMENTS.map((item) => (
            <Card
              key={item.id}
              tone={item.earned ? 'glass' : 'outline'}
              className={cn(
                'grid place-items-center gap-2 px-2 py-4 text-center',
                !item.earned && 'opacity-45',
              )}
            >
              <span
                className={cn(
                  'grid size-10 place-items-center rounded-full',
                  item.earned
                    ? 'bg-[linear-gradient(135deg,color-mix(in_srgb,var(--p-gold)_30%,transparent),color-mix(in_srgb,var(--p-violet)_30%,transparent))] text-gold-ink'
                    : 'bg-line text-faint',
                )}
              >
                {ICONS[item.icon]}
              </span>
              <p className="text-[11px] leading-tight font-semibold">{item.title}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

function Legend({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('size-3 rounded-[4px]', className)} />
      {children}
    </span>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <span className="text-faint">{icon}</span>
      <span className="text-muted">{label}</span>
      <span className="ml-auto font-bold tabular-nums">{value}</span>
    </div>
  );
}
