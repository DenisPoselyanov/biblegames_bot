import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, FileQuestion, PlayCircle, RotateCcw } from 'lucide-react';
import { DRAFTS, JOBS } from '../lib/mock';
import { useCan } from '../lib/useStudio';
import { Badge, Bar, Button, EmptyState, Grid, KeyVal, Mono, Page, Panel, Status } from '../ui/kit';
import { cn } from '../../ui/cn';

const LEVEL_CLASS = {
  info: 'text-muted',
  warn: 'text-gold-ink',
  error: 'text-danger',
} as const;

export function JobDetail() {
  const { jobId } = useParams();
  const can = useCan();
  const job = JOBS.find((j) => j.id === jobId);

  if (!job) {
    return (
      <Page title="Джоб не знайдено">
        <Panel>
          <EmptyState
            icon={<FileQuestion size={18} />}
            title="Такого джоба немає"
            body="Журнали джобів зберігаються за політикою retention — старі записи могли бути прибрані."
            action={
              <Link to="../jobs">
                <Button variant="ghost">← До списку</Button>
              </Link>
            }
          />
        </Panel>
      </Page>
    );
  }

  const produced = DRAFTS.filter((d) => d.jobId === job.id);
  const canCancel = job.status === 'running' || job.status === 'queued';
  const canResume = Boolean(job.checkpoint) && job.status !== 'running';

  return (
    <Page
      wide
      title={job.taskLabel}
      subtitle={
        <span className="flex items-center gap-2">
          <Mono>{job.id}</Mono>
          <span>·</span>
          <span>{job.target}</span>
        </span>
      }
      actions={
        <>
          <Link to="../jobs">
            <Button variant="quiet">
              <ArrowLeft size={14} />
              До списку
            </Button>
          </Link>
          <Button
            variant="ghost"
            denied={
              !can('job.cancel')
                ? 'Потрібне право job.cancel'
                : !canCancel
                  ? 'Джоб уже не виконується'
                  : null
            }
          >
            <Ban size={14} />
            Скасувати
          </Button>
          <Button
            variant="ghost"
            denied={
              !can('job.run')
                ? 'Потрібне право job.run'
                : !canResume
                  ? 'Немає checkpoint для продовження'
                  : null
            }
          >
            <PlayCircle size={14} />
            Продовжити з checkpoint
          </Button>
          <Button variant="ghost" denied={can('job.run') ? null : 'Потрібне право job.run'}>
            <RotateCcw size={14} />
            Повторити
          </Button>
        </>
      }
    >
      <div className="mb-4 flex items-center gap-2">
        <Status value={job.status} />
        <Badge>{job.step}</Badge>
        <Badge tone="info">
          {job.provider} / {job.model}
        </Badge>
        <Badge>
          спроба {job.attempts} з {job.maxAttempts}
        </Badge>
      </div>

      <div className="grid grid-cols-[1fr_360px] items-start gap-4">
        <div className="flex flex-col gap-4">
          <Panel title="Бюджет" subtitle="Жорсткі ліміти: при досягненні джоб зупиняється">
            <div className="grid grid-cols-3 gap-4">
              {[
                {
                  label: 'Запити',
                  value: job.budget.requests,
                  max: job.budget.requestLimit,
                  fmt: (v: number) => v.toLocaleString('uk-UA'),
                },
                {
                  label: 'Токени',
                  value: job.budget.tokens,
                  max: job.budget.tokenLimit,
                  fmt: (v: number) => v.toLocaleString('uk-UA'),
                },
                {
                  label: 'Вартість',
                  value: job.budget.costUsd,
                  max: job.budget.costLimitUsd,
                  fmt: (v: number) => `$${v.toFixed(2)}`,
                },
              ].map((b) => (
                <div key={b.label}>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <span className="text-[12px] text-faint">{b.label}</span>
                    <span className="studio-num text-[12.5px] font-semibold">
                      {b.max > 0 ? `${b.fmt(b.value)} / ${b.fmt(b.max)}` : 'без тарифікації'}
                    </span>
                  </div>
                  <Bar value={b.value} max={b.max} />
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4 border-t border-line pt-3">
              <div>
                <p className="text-[12px] text-faint">Опрацьовано позицій</p>
                <p className="studio-num font-display text-[22px] leading-none font-semibold">
                  {job.itemsDone}
                  <span className="text-[15px] text-faint">/{job.itemsTotal}</span>
                </p>
              </div>
              <div>
                <p className="text-[12px] text-faint">Checkpoint</p>
                <p className="mt-1">
                  {job.checkpoint ? <Mono className="text-muted">{job.checkpoint}</Mono> : <span className="text-[13px] text-faint">—</span>}
                </p>
              </div>
              <div>
                <p className="text-[12px] text-faint">Raw-артефакти</p>
                <p className="mt-1 text-[12.5px] text-muted">{job.retention}</p>
              </div>
            </div>
          </Panel>

          <Panel
            title="Журнал"
            subtitle="Помилки провайдера не приховуються й не підмінюються fallback-значеннями"
            bodyClassName="bg-[color-mix(in_srgb,var(--p-canvas)_70%,black)] p-0"
          >
            <div className="studio-scroll studio-log max-h-[320px] overflow-y-auto px-4 py-3">
              {job.logs.map((line, i) => (
                <div key={i} className="flex gap-3">
                  <span className="shrink-0 text-faint">{line.at}</span>
                  <span
                    className={cn(
                      'w-[44px] shrink-0 font-semibold uppercase',
                      LEVEL_CLASS[line.level],
                    )}
                  >
                    {line.level}
                  </span>
                  <span className={LEVEL_CLASS[line.level]}>{line.text}</span>
                </div>
              ))}
              {job.status === 'running' && (
                <div className="mt-1 flex gap-3">
                  <span className="shrink-0 text-faint">──:──</span>
                  <span className="studio-pulse text-indigo">виконується…</span>
                </div>
              )}
            </div>
          </Panel>

          <Panel title="Що створив цей джоб" flush>
            {produced.length === 0 ? (
              <p className="px-4 py-6 text-center text-[12.5px] text-faint">
                Джоб не залишив чернеток. Нічого не записано у published store —
                це гарантія рівня сховища, а не домовленість.
              </p>
            ) : (
              <>
                <Grid head cols="1fr 150px 110px">
                  <span>Позиція</span>
                  <span>Тема</span>
                  <span>Статус</span>
                </Grid>
                {produced.map((d) => (
                  <Grid key={d.id} cols="1fr 150px 110px">
                    <Link to={`../review/${d.id}`} className="min-w-0">
                      <span className="block truncate font-medium hover:text-indigo">
                        {d.title}
                      </span>
                      <Mono>{d.id}</Mono>
                    </Link>
                    <span className="truncate text-[12.5px] text-muted">
                      {d.topicPath.split(' · ').slice(-1)[0]}
                    </span>
                    <Status value={d.status} />
                  </Grid>
                ))}
              </>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <Panel title="Параметри запуску">
            <dl>
              <KeyVal k="Завдання" v={<Mono className="text-muted">{job.task}</Mono>} />
              <KeyVal k="Замовник" v={job.requester} />
              <KeyVal k="Провайдер" v={job.provider} />
              <KeyVal k="Модель" v={job.model} />
              <KeyVal k="Хеш входу" v={<Mono className="text-muted">{job.inputHash}</Mono>} />
              <KeyVal k="Старт" v={job.startedAt} />
              <KeyVal k="Завершення" v={job.finishedAt ?? '—'} />
              <KeyVal k="Retry-політика" v={`до ${job.maxAttempts} спроб, backoff 20s → 40s`} />
            </dl>
          </Panel>

          <Panel title="Результат">
            {job.resultRef ? (
              <p className="text-[13px] text-muted">{job.resultRef}</p>
            ) : (
              <p className="text-[13px] text-faint">
                {job.status === 'running'
                  ? 'Ще виконується.'
                  : 'Результату немає — джоб не дійшов до кінця.'}
              </p>
            )}
            <p className="mt-3 border-t border-line pt-3 text-[12px] leading-relaxed text-faint">
              Той самий хеш входу з тим самим промптом дасть той самий джоб —
              повтор не створює нової сутності, а доповнює спроби.
            </p>
          </Panel>
        </div>
      </div>
    </Page>
  );
}
