import { motion } from 'framer-motion';
import { ArrowLeft, Check, Clock, Lock, Play, Target } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { MODULES, PLANS, type ModuleSummary } from '../lib/mock';
import { Button, Card, Cover, Meter, Pill } from '../ui/kit';
import { cn } from '../ui/cn';

export function PlanDetail() {
  const navigate = useNavigate();
  const { planId } = useParams();
  const plan = PLANS.find((item) => item.id === planId) ?? PLANS[0];
  const modules = MODULES.filter((module) => module.planId === plan.id);
  const progress = plan.modulesDone / plan.modulesTotal;

  return (
    <div className="-mx-4 -mt-[max(18px,env(safe-area-inset-top))]">
      <div className="relative">
        <Cover
          hue={plan.hue}
          glyph={plan.id === 'psalms' ? 'wave' : plan.id === 'genesis' ? 'path' : 'rays'}
          className="h-52 w-full"
        />
        <button
          onClick={() => navigate(-1)}
          aria-label="Назад"
          className="absolute top-[max(16px,env(safe-area-inset-top))] left-4 grid size-10 place-items-center rounded-full border border-line bg-[color-mix(in_srgb,var(--p-canvas)_55%,transparent)] backdrop-blur-xl"
        >
          <ArrowLeft size={18} />
        </button>
      </div>

      <div className="relative -mt-12 px-4 pb-4">
        <h1 className="font-display text-[26px] leading-tight font-semibold">{plan.title}</h1>
        <p className="mt-1 text-[13px] text-muted">{plan.subtitle}</p>

        <div className="mt-3 flex flex-wrap gap-2">
          <Pill>
            <Clock size={12} /> {plan.minutesPerDay} хв/день
          </Pill>
          <Pill>
            <Target size={12} /> {plan.modulesTotal} модулів
          </Pill>
          <Pill tone="gold">{Math.round(progress * 100)}% пройдено</Pill>
        </div>

        <Card className="mt-4 p-4">
          <div className="mb-2 flex items-center justify-between text-[12px] font-semibold">
            <span className="text-muted">Прогрес плану</span>
            <span className="text-gold-ink">
              {plan.modulesDone} з {plan.modulesTotal}
            </span>
          </div>
          <Meter value={progress} />
          <Button
            variant="primary"
            full
            className="mt-4"
            onClick={() => navigate(`/learn/${plan.id}/luke-6`)}
          >
            <Play size={16} /> Продовжити модуль 6
          </Button>
        </Card>

        <h2 className="font-display mt-6 mb-3 text-[18px] font-semibold">Модулі</h2>

        <ol className="relative space-y-2.5 pl-7">
          <span className="absolute top-3 bottom-3 left-[13px] w-px bg-line-strong" />
          {modules.map((module, index) => (
            <ModuleRow
              key={module.id}
              module={module}
              index={index}
              onOpen={() => module.state !== 'locked' && navigate(`/learn/${plan.id}/${module.id}`)}
            />
          ))}
        </ol>
      </div>
    </div>
  );
}

function ModuleRow({
  module,
  index,
  onOpen,
}: {
  module: ModuleSummary;
  index: number;
  onOpen: () => void;
}) {
  const locked = module.state === 'locked';
  const active = module.state === 'active';

  return (
    <motion.li
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.03 * index, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="relative"
    >
      <span
        className={cn(
          'absolute top-1/2 -left-7 grid size-[26px] -translate-y-1/2 place-items-center rounded-full border text-[11px] font-bold',
          module.state === 'done' &&
            'border-[color-mix(in_srgb,var(--p-gold)_50%,transparent)] bg-[color-mix(in_srgb,var(--p-gold)_20%,transparent)] text-gold-ink',
          active &&
            'border-[color-mix(in_srgb,var(--p-violet)_60%,transparent)] bg-[linear-gradient(135deg,var(--p-indigo),var(--p-violet))] text-white shadow-[0_0_0_5px_color-mix(in_srgb,var(--p-violet)_18%,transparent)]',
          locked && 'border-line bg-canvas text-faint',
        )}
      >
        {module.state === 'done' ? (
          <Check size={13} strokeWidth={3} />
        ) : locked ? (
          <Lock size={11} />
        ) : (
          index + 1
        )}
      </span>

      <button
        onClick={onOpen}
        disabled={locked}
        className={cn(
          'w-full rounded-tile border px-4 py-3 text-left backdrop-blur-xl transition-transform',
          active
            ? 'border-[color-mix(in_srgb,var(--p-violet)_34%,transparent)] bg-[color-mix(in_srgb,var(--p-violet)_12%,transparent)]'
            : 'border-line bg-surface',
          locked ? 'opacity-45' : 'active:scale-[0.99]',
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-[15px] font-bold">{module.title}</p>
          {active && <Pill tone="gold" className="!px-2 !py-0.5 !text-[10px]">зараз</Pill>}
        </div>
        <p className="mt-0.5 text-[12px] text-faint">
          {module.objectives} цілей · {module.minutes} хв
        </p>
        {module.mastery > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <Meter value={module.mastery} className="flex-1 !h-1" />
            <span className="text-[10px] font-bold text-faint">
              {Math.round(module.mastery * 100)}%
            </span>
          </div>
        )}
      </button>
    </motion.li>
  );
}
