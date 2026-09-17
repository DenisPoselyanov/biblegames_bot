import { ArrowLeft, Check, Clock, Lock, Play, Target } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { MODULES, MODULE_DETAIL, PLANS } from '../lib/mock';
import { Button, Card, Cover, Meter, Pill } from '../ui/kit';
import { cn } from '../ui/cn';

export function ModuleDetail() {
  const navigate = useNavigate();
  const { planId, moduleId } = useParams();
  const plan = PLANS.find((item) => item.id === planId) ?? PLANS[0];
  const module = MODULES.find((item) => item.id === moduleId) ?? MODULES[5];
  const done = MODULE_DETAIL.objectives.filter((objective) => objective.mastery >= 0.8).length;

  return (
    <div className="-mx-4 -mt-[max(18px,env(safe-area-inset-top))]">
      <div className="relative">
        <Cover hue={plan.hue} glyph="path" className="h-40 w-full" />
        <button
          onClick={() => navigate(-1)}
          aria-label="Назад"
          className="absolute top-[max(16px,env(safe-area-inset-top))] left-4 grid size-10 place-items-center rounded-full border border-line bg-[color-mix(in_srgb,var(--p-canvas)_55%,transparent)] backdrop-blur-xl"
        >
          <ArrowLeft size={18} />
        </button>
      </div>

      <div className="relative -mt-10 px-4 pb-4">
        <p className="text-[12px] font-semibold text-faint">{plan.title}</p>
        <h1 className="font-display mt-1 text-[24px] leading-tight font-semibold">{module.title}</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">{MODULE_DETAIL.summary}</p>

        <div className="mt-3 flex flex-wrap gap-2">
          <Pill>
            <Target size={12} /> {MODULE_DETAIL.objectives.length} цілей
          </Pill>
          <Pill>
            <Clock size={12} /> {module.minutes} хв
          </Pill>
          <Pill tone="gold">{Math.round(module.mastery * 100)}% майстерності</Pill>
        </div>

        <Card className="mt-4 p-4">
          <div className="mb-2.5 flex items-center justify-between">
            <p className="text-[13px] font-bold">Цілі навчання</p>
            <span className="text-[12px] font-semibold text-faint tabular-nums">
              {done} з {MODULE_DETAIL.objectives.length} засвоєно
            </span>
          </div>
          <ul className="space-y-2.5">
            {MODULE_DETAIL.objectives.map((objective) => (
              <li key={objective.id} className="flex items-center gap-3">
                <span
                  className={cn(
                    'grid size-5 shrink-0 place-items-center rounded-full border',
                    objective.mastery >= 0.8
                      ? 'border-transparent bg-success text-canvas'
                      : 'border-line-strong',
                  )}
                >
                  {objective.mastery >= 0.8 && <Check size={11} strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] leading-snug font-semibold">
                    {objective.title}
                  </span>
                  <Meter value={objective.mastery} className="mt-1.5 !h-1" />
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <h2 className="font-display mt-6 mb-3 text-[18px] font-semibold">Уроки модуля</h2>
        <div className="space-y-2.5">
          {MODULE_DETAIL.lessons.map((lesson, index) => {
            const locked = lesson.state === 'locked';
            return (
              <button
                key={lesson.id}
                disabled={locked}
                onClick={() => navigate('/lesson')}
                className={cn(
                  'flex w-full items-center gap-3 rounded-tile border px-4 py-3 text-left backdrop-blur-xl',
                  lesson.state === 'active'
                    ? 'border-[color-mix(in_srgb,var(--p-violet)_34%,transparent)] bg-[color-mix(in_srgb,var(--p-violet)_12%,transparent)]'
                    : 'border-line bg-surface',
                  locked ? 'opacity-45' : 'active:scale-[0.99]',
                )}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line-strong text-[12px] font-bold">
                  {locked ? <Lock size={12} /> : index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-bold">{lesson.title}</span>
                  <span className="block text-[12px] text-faint">
                    {lesson.reference} · {lesson.minutes} хв
                  </span>
                </span>
                {lesson.state === 'active' && <Play size={15} className="text-gold-ink" />}
              </button>
            );
          })}
        </div>

        <Button variant="primary" size="lg" full className="mt-5" onClick={() => navigate('/lesson')}>
          <Play size={17} /> Продовжити модуль
        </Button>
      </div>
    </div>
  );
}
