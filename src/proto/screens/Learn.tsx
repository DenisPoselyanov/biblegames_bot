import { BookOpen, Compass, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MODULES, PLANS } from '../lib/mock';
import { Card, Cover, Meter, Pill, Segmented } from '../ui/kit';
import { cn } from '../ui/cn';

type Tab = 'mine' | 'catalog';

export function Learn() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('mine');
  const [query, setQuery] = useState('');

  const plans = useMemo(() => {
    const scoped = PLANS.filter((plan) => (tab === 'mine' ? plan.modulesDone > 0 : true));
    const needle = query.trim().toLowerCase();
    return needle
      ? scoped.filter((plan) => `${plan.title} ${plan.subtitle}`.toLowerCase().includes(needle))
      : scoped;
  }, [tab, query]);

  const activeModule = MODULES.find((module) => module.state === 'active');

  return (
    <div className="space-y-5">
      <header className="pt-1">
        <h1 className="font-display text-[27px] leading-tight font-semibold">Навчання</h1>
        <p className="mt-1 text-[13px] text-muted">
          Плани, модулі та цілі — від першого читання до майстерності
        </p>
      </header>

      <div className="flex items-center gap-2 rounded-control border border-line bg-surface px-3.5 backdrop-blur-xl">
        <Search size={16} className="shrink-0 text-faint" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Пошук плану або книги"
          className="h-12 w-full text-[14px] placeholder:text-faint"
        />
      </div>

      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'mine', label: 'Мої плани' },
          { value: 'catalog', label: 'Каталог' },
        ]}
      />

      {tab === 'mine' && activeModule && (
        <Card
          tone="solid"
          className="flex items-center gap-3 p-4"
          role="status"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--p-violet)_24%,transparent)]">
            <Compass size={18} className="text-ink" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-faint uppercase">
              Ви зупинились тут
            </p>
            <p className="truncate text-[15px] font-bold">{activeModule.title}</p>
          </div>
          <button
            onClick={() => navigate(`/learn/${activeModule.planId}`)}
            className="rounded-full border border-line-strong px-4 py-2 text-[13px] font-semibold"
          >
            Далі
          </button>
        </Card>
      )}

      <div className="space-y-3">
        {plans.map((plan) => {
          const progress = plan.modulesDone / plan.modulesTotal;
          return (
            <button
              key={plan.id}
              onClick={() => navigate(`/learn/${plan.id}`)}
              className="block w-full text-left transition-transform active:scale-[0.99]"
            >
              <Card className="overflow-hidden p-0">
                <div className="flex gap-3.5 p-3.5">
                  <Cover
                    hue={plan.hue}
                    glyph={plan.id === 'psalms' ? 'wave' : plan.id === 'genesis' ? 'path' : 'rays'}
                    className="size-[78px] shrink-0 rounded-[18px]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Pill className="!px-2 !py-0.5 !text-[10px]">{plan.book}</Pill>
                      <span className="text-[11px] text-faint">
                        {plan.minutesPerDay} хв/день
                      </span>
                    </div>
                    <h2 className="font-display mt-1.5 text-[17px] leading-tight font-semibold">
                      {plan.title}
                    </h2>
                    <p className="mt-0.5 line-clamp-1 text-[12px] text-faint">{plan.subtitle}</p>
                    <div className="mt-2.5 flex items-center gap-2.5">
                      <Meter value={progress} className="flex-1" />
                      <span
                        className={cn(
                          'text-[11px] font-bold',
                          progress > 0 ? 'text-gold-ink' : 'text-faint',
                        )}
                      >
                        {plan.modulesDone}/{plan.modulesTotal}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </button>
          );
        })}

        {plans.length === 0 && (
          <Card tone="outline" className="grid place-items-center gap-2 px-6 py-10 text-center">
            <BookOpen size={22} className="text-faint" />
            <p className="text-[14px] font-semibold">Нічого не знайшли</p>
            <p className="text-[12px] text-faint">Спробуйте іншу назву книги або теми</p>
          </Card>
        )}
      </div>
    </div>
  );
}
