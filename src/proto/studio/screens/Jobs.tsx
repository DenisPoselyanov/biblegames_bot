import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { JOBS } from '../lib/mock';
import { useCan } from '../lib/useStudio';
import type { JobStatus } from '../lib/types';
import { Bar, Button, Chip, Grid, Mono, Page, Panel, Status, Toolbar } from '../ui/kit';

const FILTERS: Array<{ id: string; label: string; match: (s: JobStatus) => boolean }> = [
  { id: 'all', label: 'Усі', match: () => true },
  { id: 'active', label: 'Активні', match: (s) => s === 'running' || s === 'queued' },
  { id: 'failed', label: 'З відхиленнями', match: (s) => s === 'failed' || s === 'partial' },
  { id: 'completed', label: 'Завершені', match: (s) => s === 'completed' },
  { id: 'cancelled', label: 'Скасовані', match: (s) => s === 'cancelled' },
];

const COLS = '96px 1fr 190px 130px 108px 132px 118px';

export function Jobs() {
  const navigate = useNavigate();
  const can = useCan();
  const [filter, setFilter] = useState('all');
  const active = FILTERS.find((f) => f.id === filter) ?? FILTERS[0];
  const rows = JOBS.filter((j) => active.match(j.status));

  return (
    <Page
      wide
      title="AI-джоби"
      subtitle="Кожен запуск має бюджет, checkpoint і журнал. Нескінченних повторів немає."
      actions={
        <Link to="new">
          <Button
            variant="primary"
            size="md"
            denied={can('job.run') ? null : 'Потрібне право job.run'}
          >
            <Plus size={14} />
            Новий джоб
          </Button>
        </Link>
      }
    >
      <Toolbar className="mb-3">
        {FILTERS.map((f) => (
          <Chip
            key={f.id}
            active={f.id === filter}
            onClick={() => setFilter(f.id)}
            count={JOBS.filter((j) => f.match(j.status)).length}
          >
            {f.label}
          </Chip>
        ))}
      </Toolbar>

      <Panel flush>
        <Grid head cols={COLS}>
          <span>ID</span>
          <span>Завдання</span>
          <span>Провайдер / модель</span>
          <span>Статус</span>
          <span>Позиції</span>
          <span>Бюджет</span>
          <span className="text-right">Старт</span>
        </Grid>

        {rows.map((j) => (
          <Grid key={j.id} cols={COLS} onClick={() => navigate(j.id)}>
            <Mono className="text-muted">{j.id}</Mono>
            <span className="min-w-0">
              <span className="block truncate font-medium">{j.taskLabel}</span>
              <Mono>{j.target}</Mono>
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[12.5px] text-muted">{j.model}</span>
              <Mono>{j.provider}</Mono>
            </span>
            <span>
              <Status value={j.status} />
              {j.status === 'running' && (
                <span className="studio-live relative mt-1.5 block h-0.5 w-full overflow-hidden rounded-full bg-line-strong" />
              )}
            </span>
            <span className="studio-num text-[12.5px]">
              {j.itemsDone}
              <span className="text-faint">/{j.itemsTotal}</span>
            </span>
            <span className="min-w-0">
              <Bar value={j.budget.requests} max={j.budget.requestLimit} />
              <Mono className="mt-1 block">
                {j.budget.requests}/{j.budget.requestLimit} запитів
              </Mono>
            </span>
            <Mono className="text-right">{j.startedAt.slice(11) || j.startedAt}</Mono>
          </Grid>
        ))}
      </Panel>

      <p className="mt-3 text-[12px] text-faint">
        Стовпець «Позиції» показує реальні лічильники, а не відсоток виконання:
        runner не знає, скільки залишилось, доки провайдер не поверне партію.
      </p>
    </Page>
  );
}
