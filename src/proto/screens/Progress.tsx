import { motion } from 'framer-motion';
import { Award, BookOpen, Flame, Moon, Sparkles, Target, Zap } from 'lucide-react';
import { ACHIEVEMENTS, ACTIVITY, MASTERY_BY_THEME } from '../lib/mock';
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

export function Progress() {
  const { xp, streak, coins } = useProto();
  const level = levelProgress(xp);

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
          action={<span className="text-[11px] font-semibold text-faint">останні 3 тижні</span>}
        >
          Активність
        </SectionTitle>
        <Card className="p-4">
          <div className="grid grid-cols-7 gap-1.5">
            {ACTIVITY.map((value, index) => (
              <motion.span
                key={index}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.012, duration: 0.25 }}
                title={`${value} сесій`}
                className={cn(
                  'aspect-square rounded-[7px]',
                  value === 0 && 'bg-line',
                  value === 1 && 'bg-[color-mix(in_srgb,var(--p-violet)_26%,transparent)]',
                  value === 2 && 'bg-[color-mix(in_srgb,var(--p-violet)_45%,transparent)]',
                  value === 3 && 'bg-[color-mix(in_srgb,var(--p-violet)_65%,transparent)]',
                  value >= 4 &&
                    'bg-[linear-gradient(135deg,var(--p-violet),var(--p-gold))] shadow-[0_0_14px_-4px_var(--p-gold)]',
                )}
              />
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-faint">
            <span>менше</span>
            <span className="font-semibold text-gold-ink">
              {ACTIVITY.filter((value) => value > 0).length} активних днів
            </span>
            <span>більше</span>
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
