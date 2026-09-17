import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Ban, PlayCircle, Plus } from 'lucide-react';
import { JOBS } from '../lib/mock';
import { useCan } from '../lib/useStudio';
import type { Job, JobStatus } from '../lib/types';
import {
  Badge,
  Bar,
  Button,
  Chip,
  Drawer,
  Grid,
  Mono,
  Note,
  Page,
  Panel,
  Status,
  Term,
  Toolbar,
} from '../ui/kit';

const FILTERS: Array<{ id: string; label: string; match: (s: JobStatus) => boolean }> = [
  { id: 'active', label: 'Зараз', match: (s) => s === 'running' || s === 'queued' },
  { id: 'problem', label: 'З відхиленнями', match: (s) => s === 'failed' || s === 'partial' },
  { id: 'all', label: 'Усі', match: () => true },
];

const COLS = '1fr 150px 130px 130px';

export function Jobs() {
  const navigate = useNavigate();
  const can = useCan();
  const [filter, setFilter] = useState('active');
  const [open, setOpen] = useState<Job | null>(null);

  const active = FILTERS.find((f) => f.id === filter) ?? FILTERS[0];
  const rows = JOBS.filter((j) => active.match(j.status));

  return (
    <Page
      wide
      title="Робота AI"
      actions={
        <Link to="new">
          <Button
            variant="primary"
            size="md"
            denied={can('job.run') ? null : 'Потрібне право запускати AI'}
          >
            <Plus size={14} />
            Новий запуск
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
          <span>Завдання</span>
          <span>Стан</span>
          <span>Зроблено</span>
          <span className="text-right">Початок</span>
        </Grid>
        {rows.map((j) => (
          <Grid key={j.id} cols={COLS} onClick={() => setOpen(j)}>
            <span className="min-w-0">
              <span className="block truncate font-medium">{j.taskLabel}</span>
              <span className="block truncate text-[12px] text-faint">{j.target}</span>
            </span>
            <span>
              <Status value={j.status} />
              {j.status === 'running' && (
                <span className="studio-live relative mt-1.5 block h-0.5 w-full overflow-hidden rounded-full bg-line-strong" />
              )}
            </span>
            <span className="studio-num text-[12.5px]">
              {j.itemsDone} <span className="text-faint">з {j.itemsTotal}</span>
            </span>
            <Mono className="text-right">{j.startedAt.slice(11) || j.startedAt}</Mono>
          </Grid>
        ))}
      </Panel>

      <Note className="mt-3">
        Стовпець «Зроблено» — реальний лічильник, а не відсоток: поки провайдер не
        повернув партію, ніхто не знає, скільки лишилось. Тому смужка показує
        лише те, що робота триває.
      </Note>

      <Drawer
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        title={open?.taskLabel ?? ''}
        subtitle={open?.target}
        status={open && <Status value={open.status} />}
        footer={
          open && (
            <>
              <Button
                variant="ghost"
                denied={
                  !can('job.cancel')
                    ? 'Потрібне право зупиняти'
                    : open.status !== 'running' && open.status !== 'queued'
                      ? 'Запуск уже завершено'
                      : null
                }
              >
                <Ban size={13} />
                Зупинити
              </Button>
              <Button
                variant="ghost"
                denied={
                  !can('job.run')
                    ? 'Потрібне право запускати AI'
                    : !open.checkpoint
                      ? 'Немає місця, з якого продовжити'
                      : null
                }
              >
                <PlayCircle size={13} />
                Продовжити
              </Button>
              <Button variant="quiet" className="ml-auto" onClick={() => navigate(open.id)}>
                Усі подробиці
                <ArrowRight size={13} />
              </Button>
            </>
          )
        }
      >
        {open && (
          <>
            <p className="text-[13px] leading-relaxed text-muted">
              {open.step}. Опрацьовано{' '}
              <span className="studio-num font-semibold text-ink">
                {open.itemsDone} з {open.itemsTotal}
              </span>
              .
            </p>

            <p className="mt-4 mb-2 flex items-center gap-1.5 text-[11.5px] font-semibold tracking-[0.02em] text-faint uppercase">
              <Term k="budget">Бюджет</Term>
            </p>
            <div className="grid gap-2.5">
              {[
                { label: 'Запити', v: open.budget.requests, m: open.budget.requestLimit, f: (x: number) => String(x) },
                { label: 'Токени', v: open.budget.tokens, m: open.budget.tokenLimit, f: (x: number) => x.toLocaleString('uk-UA') },
                { label: 'Гроші', v: open.budget.costUsd, m: open.budget.costLimitUsd, f: (x: number) => `$${x.toFixed(2)}` },
              ].map((b) => (
                <div key={b.label}>
                  <div className="mb-1 flex items-baseline justify-between">
                    <span className="text-[12px] text-faint">{b.label}</span>
                    <span className="studio-num text-[12.5px] font-semibold">
                      {b.m > 0 ? `${b.f(b.v)} / ${b.f(b.m)}` : 'без оплати'}
                    </span>
                  </div>
                  <Bar value={b.v} max={b.m} />
                </div>
              ))}
            </div>

            {open.checkpoint && (
              <p className="mt-4 text-[12.5px] text-faint">
                <Term k="checkpoint">Місце зупинки</Term>:{' '}
                <Mono className="text-muted">{open.checkpoint}</Mono>
              </p>
            )}

            <p className="mt-4 mb-2 text-[11.5px] font-semibold tracking-[0.02em] text-faint uppercase">
              Останнє в журналі
            </p>
            <div className="studio-log rounded-[var(--s-radius-sm)] border border-line px-3 py-2">
              {open.logs.slice(-3).map((line, i) => (
                <div key={i} className="flex gap-2">
                  <span className="shrink-0 text-faint">{line.at}</span>
                  <span
                    className={
                      line.level === 'error'
                        ? 'text-danger'
                        : line.level === 'warn'
                          ? 'text-gold-ink'
                          : 'text-muted'
                    }
                  >
                    {line.text}
                  </span>
                </div>
              ))}
            </div>

            {open.resultRef && (
              <p className="mt-4 border-t border-line pt-3 text-[12.5px]">
                <Badge tone="success">Результат</Badge>{' '}
                <span className="text-muted">{open.resultRef}</span>
              </p>
            )}
          </>
        )}
      </Drawer>
    </Page>
  );
}
