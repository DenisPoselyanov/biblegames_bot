import { useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { AUDIT, ROLE_LABEL } from '../lib/mock';
import { Badge, Button, Chip, Grid, Input, Mono, Page, Panel, Toolbar } from '../ui/kit';

const FILTERS = [
  { id: 'all', label: 'Усі', match: () => true },
  { id: 'content', label: 'Контент', match: (a: string) => a.startsWith('content.') },
  { id: 'review', label: 'Ревʼю', match: (a: string) => a.startsWith('review.') || a.startsWith('draft.') },
  { id: 'job', label: 'Джоби', match: (a: string) => a.startsWith('job.') },
  { id: 'settings', label: 'Налаштування', match: (a: string) => a.startsWith('settings.') },
];

const COLS = '140px 150px 108px 190px 1fr 190px';

/** Actions that changed what players see get a stronger badge than routine ones. */
function actionTone(action: string) {
  if (action.startsWith('content.')) return 'gold' as const;
  if (action.includes('reject') || action.includes('budget_exceeded')) return 'danger' as const;
  if (action.includes('approve')) return 'success' as const;
  return 'neutral' as const;
}

export function Audit() {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  const active = FILTERS.find((f) => f.id === filter) ?? FILTERS[0];

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return AUDIT.filter((a) => active.match(a.action)).filter(
      (a) =>
        !q ||
        a.actor.toLowerCase().includes(q) ||
        a.action.toLowerCase().includes(q) ||
        a.target.toLowerCase().includes(q),
    );
  }, [active, query]);

  return (
    <Page
      wide
      title="Аудит"
      subtitle="Хто, коли і що змінив. Журнал доповнюється, але не редагується."
      actions={
        <Button variant="ghost">
          <Download size={14} />
          Експорт за період
        </Button>
      }
    >
      <Toolbar className="mb-3">
        {FILTERS.map((f) => (
          <Chip
            key={f.id}
            active={f.id === filter}
            onClick={() => setFilter(f.id)}
            count={AUDIT.filter((a) => f.match(a.action)).length}
          >
            {f.label}
          </Chip>
        ))}
        <div className="relative ml-auto w-[260px]">
          <Search size={14} className="absolute top-2.5 left-2.5 text-faint" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Актор, дія або обʼєкт"
            className="pl-8"
          />
        </div>
      </Toolbar>

      <Panel flush>
        <Grid head cols={COLS}>
          <span>Час</span>
          <span>Хто</span>
          <span>Роль</span>
          <span>Дія</span>
          <span>Деталі</span>
          <span>Обʼєкт / evidence</span>
        </Grid>
        {rows.map((a) => (
          <Grid key={a.id} cols={COLS}>
            <Mono className="text-muted">{a.at}</Mono>
            <span className="truncate text-[12.5px]">{a.actor}</span>
            <span className="text-[12px] text-faint">{ROLE_LABEL[a.role]}</span>
            <Badge tone={actionTone(a.action)}>{a.action}</Badge>
            <span className="truncate text-[12.5px] text-muted" title={a.detail}>
              {a.detail}
            </span>
            <span className="min-w-0">
              <Mono className="block truncate text-muted">{a.target}</Mono>
              {a.evidence && <Mono className="block truncate">{a.evidence}</Mono>}
            </span>
          </Grid>
        ))}
      </Panel>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="rounded-[var(--s-radius)] border border-dashed border-line-strong p-4 text-[12.5px] leading-relaxed text-faint">
          <p className="mb-1 font-semibold text-muted">Відмови теж у журналі</p>
          Останній запис — спроба змінити модель провайдера без права
          <Mono className="mx-1 text-muted">settings.write</Mono>. Такі події
          записуються так само, як успішні.
        </div>
        <div className="rounded-[var(--s-radius)] border border-dashed border-line-strong p-4 text-[12.5px] leading-relaxed text-faint">
          <p className="mb-1 font-semibold text-muted">Evidence живе з ревізією</p>
          Для перевірок Писання зберігається сам текст джерела на момент
          перевірки — інакше через рік доказ нічого не доводить.
        </div>
        <div className="rounded-[var(--s-radius)] border border-dashed border-line-strong p-4 text-[12.5px] leading-relaxed text-faint">
          <p className="mb-1 font-semibold text-muted">Системні дії названі</p>
          <Mono className="text-muted">system</Mono> — це runner і валідатори.
          Вони можуть відхиляти чернетки, але не схвалювати їх.
        </div>
      </div>
    </Page>
  );
}
