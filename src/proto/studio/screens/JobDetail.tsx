import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, FileQuestion, PlayCircle, RotateCcw } from 'lucide-react';
import { DRAFTS, JOBS } from '../lib/mock';
import { useCan } from '../lib/useStudio';
import {
  Badge,
  Bar,
  Button,
  Disclosure,
  EmptyState,
  Grid,
  KeyVal,
  Mono,
  Page,
  Panel,
  Status,
  Term,
} from '../ui/kit';
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
      <Page title="Запуск не знайдено">
        <Panel>
          <EmptyState
            icon={<FileQuestion size={18} />}
            title="Такого запуску немає"
            body="Журнали зберігаються обмежений час — старі записи могли бути прибрані."
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

  return (
    <Page
      title={job.taskLabel}
      subtitle={job.target}
      actions={
        <Link to="../jobs">
          <Button variant="quiet">
            <ArrowLeft size={14} />
            До списку
          </Button>
        </Link>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Status value={job.status} />
        <Badge>{job.step}</Badge>
        <Badge tone="info">
          {job.provider} / {job.model}
        </Badge>
      </div>

      <Panel className="mb-3" title={<Term k="budget">Бюджет і обсяг</Term>}>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <p className="text-[12px] text-faint">Опрацьовано</p>
            <p className="studio-num mt-1 font-display text-[22px] leading-none font-semibold">
              {job.itemsDone}
              <span className="text-[15px] text-faint"> з {job.itemsTotal}</span>
            </p>
          </div>
          {[
            { label: 'Запити', v: job.budget.requests, m: job.budget.requestLimit, f: (x: number) => String(x) },
            { label: 'Токени', v: job.budget.tokens, m: job.budget.tokenLimit, f: (x: number) => x.toLocaleString('uk-UA') },
            { label: 'Гроші', v: job.budget.costUsd, m: job.budget.costLimitUsd, f: (x: number) => `$${x.toFixed(2)}` },
          ].map((b) => (
            <div key={b.label}>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-[12px] text-faint">{b.label}</span>
                <span className="studio-num text-[12.5px] font-semibold">
                  {b.m > 0 ? `${b.f(b.v)} / ${b.f(b.m)}` : 'без оплати'}
                </span>
              </div>
              <Bar value={b.v} max={b.m} />
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        className="mb-3"
        title="Журнал"
        subtitle="Помилки провайдера показуються як є"
        bodyClassName="p-0"
      >
        <div className="studio-scroll studio-log max-h-[300px] overflow-y-auto px-4 py-3">
          {job.logs.map((line, i) => (
            <div key={i} className="flex gap-3">
              <span className="shrink-0 text-faint">{line.at}</span>
              <span className={cn('w-[42px] shrink-0 font-semibold uppercase', LEVEL_CLASS[line.level])}>
                {line.level}
              </span>
              <span className={LEVEL_CLASS[line.level]}>{line.text}</span>
            </div>
          ))}
          {job.status === 'running' && (
            <div className="mt-1 flex gap-3">
              <span className="shrink-0 text-faint">──:──</span>
              <span className="studio-pulse text-indigo">працює…</span>
            </div>
          )}
        </div>
      </Panel>

      <Panel className="mb-3" title="Що з цього вийшло" flush>
        {produced.length === 0 ? (
          <p className="px-4 py-6 text-center text-[12.5px] text-faint">
            Запуск не залишив чернеток. У гру нічого не потрапило — AI туди не пише.
          </p>
        ) : (
          <>
            <Grid head cols="1fr 160px 150px">
              <span>Позиція</span>
              <span>Тема</span>
              <span>Стан</span>
            </Grid>
            {produced.map((d) => (
              <Grid key={d.id} cols="1fr 160px 150px">
                <Link to={`../review/${d.id}`} className="min-w-0">
                  <span className="block truncate font-medium hover:text-indigo">{d.title}</span>
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

      <Disclosure className="mb-4" label="Параметри запуску">
        <dl className="px-4 py-2">
          <KeyVal k="Замовник" v={job.requester} />
          <KeyVal k={<Term k="provider">Провайдер</Term>} v={`${job.provider} / ${job.model}`} />
          <KeyVal k={<Term k="inputHash">Хеш входу</Term>} v={<Mono className="text-muted">{job.inputHash}</Mono>} />
          <KeyVal k="Спроби" v={`${job.attempts} з ${job.maxAttempts}`} />
          <KeyVal
            k={<Term k="checkpoint">Місце зупинки</Term>}
            v={job.checkpoint ? <Mono className="text-muted">{job.checkpoint}</Mono> : '—'}
          />
          <KeyVal k="Початок" v={job.startedAt} />
          <KeyVal k="Кінець" v={job.finishedAt ?? '—'} />
          <KeyVal k="Зберігання чернеток AI" v={job.retention} />
        </dl>
      </Disclosure>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="md"
          denied={
            !can('job.cancel')
              ? 'Потрібне право зупиняти'
              : !canCancel
                ? 'Запуск уже завершено'
                : null
          }
        >
          <Ban size={14} />
          Зупинити
        </Button>
        <Button
          variant="ghost"
          size="md"
          denied={
            !can('job.run')
              ? 'Потрібне право запускати AI'
              : !job.checkpoint
                ? 'Немає місця, з якого продовжити'
                : null
          }
        >
          <PlayCircle size={14} />
          Продовжити
        </Button>
        <Button
          variant="ghost"
          size="md"
          denied={can('job.run') ? null : 'Потрібне право запускати AI'}
        >
          <RotateCcw size={14} />
          Повторити
        </Button>
      </div>
    </Page>
  );
}
