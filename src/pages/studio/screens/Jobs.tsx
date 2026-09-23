import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Ban, Plus } from 'lucide-react';
import { useCancelJobMutation, useJobsQuery } from '../lib/queries';
import { useCan } from '../lib/useStudio';
import type { StudioJobSummary } from '../../../repos/studioRepo';
import { Button, Chip, Drawer, Grid, Mono, Note, Page, Panel, Status, Toolbar } from '../ui/kit';

const FILTERS: Array<{ id: string; label: string; match: (s: StudioJobSummary['status']) => boolean }> = [
  { id: 'active', label: 'Зараз', match: (s) => s === 'active' || s === 'pending' || s === 'retry' },
  { id: 'problem', label: 'З відхиленнями', match: (s) => s === 'failed' },
  { id: 'all', label: 'Усі', match: () => true },
];

const COLS = '1fr 150px 130px';

export function Jobs() {
  const navigate = useNavigate();
  const can = useCan();
  const [filter, setFilter] = useState('active');
  const [open, setOpen] = useState<StudioJobSummary | null>(null);
  const jobsQuery = useJobsQuery();
  const cancelMutation = useCancelJobMutation();

  const jobs = jobsQuery.data?.jobs ?? [];
  const available = jobsQuery.data?.available ?? true;
  const active = FILTERS.find((f) => f.id === filter) ?? FILTERS[0];
  const rows = jobs.filter((j) => active.match(j.status));

  return (
    <Page
      wide
      title="Робота AI"
      actions={
        <Link to="new">
          <Button
            variant="primary"
            size="md"
            denied={can('content:ai:run') ? null : 'Потрібне право запускати AI'}
          >
            <Plus size={14} />
            Новий запуск
          </Button>
        </Link>
      }
    >
      {!available ? (
        <Note tone="danger">
          Черга завдань недоступна в цьому середовищі: API-процес не запускає джоби напряму (вони
          йдуть у фоновому worker'і без спільного сховища між процесами). Список тут порожній, доки
          не з'явиться спільна черга.
        </Note>
      ) : (
        <>
          <Toolbar className="mb-3">
            {FILTERS.map((f) => (
              <Chip
                key={f.id}
                active={f.id === filter}
                onClick={() => setFilter(f.id)}
                count={jobs.filter((j) => f.match(j.status)).length}
              >
                {f.label}
              </Chip>
            ))}
          </Toolbar>

          <Panel flush>
            <Grid head cols={COLS}>
              <span>Завдання</span>
              <span>Стан</span>
              <span className="text-right">Спроби</span>
            </Grid>
            {rows.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-faint">Нічого немає.</p>
            ) : (
              rows.map((j) => (
                <Grid key={j.id} cols={COLS} onClick={() => setOpen(j)}>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{j.typeLabel}</span>
                    {j.label && <span className="block truncate text-[12px] text-faint">{j.label}</span>}
                  </span>
                  <span>
                    <Status value={j.status} />
                    {j.status === 'active' && (
                      <span className="studio-live relative mt-1.5 block h-0.5 w-full overflow-hidden rounded-full bg-line-strong" />
                    )}
                  </span>
                  <Mono className="text-right">
                    {j.attempts}/{j.maxAttempts}
                  </Mono>
                </Grid>
              ))
            )}
          </Panel>
        </>
      )}

      <Drawer
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        title={open?.typeLabel ?? ''}
        subtitle={open?.label ?? undefined}
        status={open && <Status value={open.status} />}
        footer={
          open && (
            <>
              <Button
                variant="ghost"
                denied={
                  !can('content:ai:run')
                    ? 'Потрібне право зупиняти'
                    : open.status !== 'active' && open.status !== 'pending' && open.status !== 'retry'
                      ? 'Запуск уже завершено'
                      : null
                }
                onClick={() => cancelMutation.mutate(open.id, { onSuccess: () => setOpen(null) })}
              >
                <Ban size={13} />
                Зупинити
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
              Спроба {open.attempts} із {open.maxAttempts}.
            </p>
            {open.error && (
              <p className="mt-3 rounded-[var(--s-radius-sm)] border border-[color-mix(in_srgb,var(--p-danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--p-danger)_8%,transparent)] px-3 py-2 text-[12.5px] text-danger">
                {open.error}
              </p>
            )}
            <p className="mt-4 mb-2 text-[11.5px] font-semibold tracking-[0.02em] text-faint uppercase">
              Час
            </p>
            <div className="grid gap-1 text-[12.5px]">
              <div className="flex justify-between">
                <span className="text-faint">Створено</span>
                <Mono>{new Date(open.createdAt).toLocaleString('uk-UA')}</Mono>
              </div>
              {open.startedAt && (
                <div className="flex justify-between">
                  <span className="text-faint">Почато</span>
                  <Mono>{new Date(open.startedAt).toLocaleString('uk-UA')}</Mono>
                </div>
              )}
              {open.completedAt && (
                <div className="flex justify-between">
                  <span className="text-faint">Завершено</span>
                  <Mono>{new Date(open.completedAt).toLocaleString('uk-UA')}</Mono>
                </div>
              )}
            </div>
          </>
        )}
      </Drawer>
    </Page>
  );
}
