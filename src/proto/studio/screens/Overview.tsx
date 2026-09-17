import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Plus, ShieldAlert } from 'lucide-react';
import { AUDIT, DRAFTS, JOBS, PROVIDERS, ROLE_LABEL } from '../lib/mock';
import { useCan, useStudio } from '../lib/useStudio';
import { plural } from '../lib/plural';
import type { DraftStatus } from '../lib/types';
import { Badge, Bar, Button, Grid, Metric, Mono, Page, Panel, Status } from '../ui/kit';

/** The lifecycle from the spec, collapsed into the five stages worth a number. */
const STAGES: Array<{ key: string; label: string; match: DraftStatus[] }> = [
  { key: 'generated', label: 'Згенеровано', match: ['draft', 'generated'] },
  { key: 'validation_failed', label: 'Валідація провалена', match: ['validation_failed'] },
  { key: 'ready_for_review', label: 'На ревʼю', match: ['ready_for_review', 'changes_requested'] },
  { key: 'approved', label: 'Схвалено', match: ['approved', 'scheduled'] },
  { key: 'published', label: 'Опубліковано', match: ['published'] },
];

export function Overview() {
  const { role } = useStudio();
  const can = useCan();
  const navigate = useNavigate();

  const running = JOBS.filter((j) => j.status === 'running');
  const queued = JOBS.filter((j) => j.status === 'queued');
  const failed = JOBS.filter((j) => j.status === 'failed' || j.status === 'partial');
  const blocked = DRAFTS.filter((d) => d.status === 'validation_failed');

  /* What the current role can actually act on — the queue is different work
     for an author than for a reviewer. */
  const mine = DRAFTS.filter((d) =>
    role === 'author'
      ? d.status === 'changes_requested' || d.status === 'validation_failed'
      : role === 'reviewer'
        ? d.status === 'ready_for_review'
        : d.status === 'ready_for_review' || d.status === 'approved',
  );

  const monthTokens = PROVIDERS.reduce((sum, p) => sum + p.monthly.costUsd, 0);
  const monthLimit = PROVIDERS.reduce((sum, p) => sum + p.monthly.costLimitUsd, 0);

  return (
    <Page
      wide
      title="Огляд"
      subtitle={`17 вересня 2026 · ти в ролі «${ROLE_LABEL[role]}»`}
      actions={
        <Link to="jobs/new">
          <Button
            variant="primary"
            size="md"
            denied={can('job.run') ? null : 'Потрібне право job.run'}
          >
            <Plus size={14} />
            Запустити джоб
          </Button>
        </Link>
      }
    >
      {/* Pipeline ---------------------------------------------------------- */}
      <Panel
        title="Конвеєр контенту"
        subtitle="Стан життєвого циклу на цю хвилину"
        className="mb-4"
      >
        <div className="flex items-stretch gap-2">
          {STAGES.map((stage, i) => {
            const count = DRAFTS.filter((d) => stage.match.includes(d.status)).length;
            const isPublished = stage.key === 'published';
            return (
              <div key={stage.key} className="flex flex-1 items-center gap-2">
                <div className="flex-1 rounded-[var(--s-radius-sm)] border border-line bg-[var(--s-panel-2)] px-3 py-2.5">
                  <Status value={stage.key} />
                  <p className="studio-num mt-2 font-display text-[26px] leading-none font-semibold">
                    {isPublished ? '4 100' : count}
                  </p>
                  <p className="mt-1 text-[11.5px] text-faint">
                    {isPublished
                      ? 'усього в продакшені'
                      : plural(count, 'позиція', 'позиції', 'позицій')}
                  </p>
                </div>
                {i < STAGES.length - 1 && (
                  <ArrowRight size={14} className="shrink-0 text-faint" />
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[12px] text-faint">
          AI не має доступу на запис у published store. Кожен перехід праворуч —
          окрема операція з власним правом:{' '}
          <Mono className="text-muted">repair</Mono> ·{' '}
          <Mono className="text-muted">approve</Mono> ·{' '}
          <Mono className="text-muted">publish</Mono>.
        </p>
      </Panel>

      {/* Metrics ----------------------------------------------------------- */}
      <div className="mb-4 grid grid-cols-4 gap-3">
        <Metric
          label="Чекає на ревʼю"
          value={DRAFTS.filter((d) => d.status === 'ready_for_review').length}
          delta={`${mine.length} у твоїй черзі`}
          tone="warn"
          hint="Позиції зі статусом ready_for_review."
        />
        <Metric
          label="Заблоковано валідацією"
          value={blocked.length}
          delta="Писання: 2 помилки"
          tone="bad"
          hint="Не потрапляють на ревʼю, поки чек не пройдено."
        />
        <Metric
          label="Активні джоби"
          value={running.length + queued.length}
          delta={`${running.length} виконується · ${queued.length} у черзі`}
          tone="neutral"
        />
        <Metric
          label="Витрати за місяць"
          value={`$${monthTokens.toFixed(2)}`}
          delta={`ліміт $${monthLimit.toFixed(0)}`}
          tone="good"
          hint="Сума по всіх провайдерах. Ollama і Mock не тарифікуються."
        />
      </div>

      <div className="grid grid-cols-[1.35fr_1fr] gap-4">
        {/* Attention ------------------------------------------------------- */}
        <div className="flex flex-col gap-4">
          <Panel
            title="Потребує твоєї уваги"
            subtitle={`Відібрано за роллю «${ROLE_LABEL[role]}»`}
            flush
            action={
              <Link to="review">
                <Button variant="quiet">Уся черга →</Button>
              </Link>
            }
          >
            <Grid head cols="1fr 150px 130px 92px">
              <span>Позиція</span>
              <span>Тема</span>
              <span>Статус</span>
              <span className="text-right">Оновлено</span>
            </Grid>
            {mine.map((d) => (
              <Grid
                key={d.id}
                cols="1fr 150px 130px 92px"
                onClick={() => navigate(`review/${d.id}`)}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{d.title}</span>
                  <Mono>{d.id} · ревізія {d.revision}</Mono>
                </span>
                <span className="truncate text-[12px] text-muted">
                  {d.topicPath.split(' · ').slice(-1)[0]}
                </span>
                <Status value={d.status} />
                <Mono className="text-right">{d.updatedAt.slice(11)}</Mono>
              </Grid>
            ))}
            {mine.length === 0 && (
              <p className="px-4 py-8 text-center text-[13px] text-faint">
                Для цієї ролі зараз нічого немає.
              </p>
            )}
          </Panel>

          <Panel title="Заблоковано перевірками" flush>
            {blocked.map((d) => {
              const fail = d.checks.find((c) => c.severity === 'fail');
              return (
                <Grid key={d.id} cols="1fr 1.1fr 110px" onClick={() => navigate(`review/${d.id}`)}>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{d.title}</span>
                    <Mono>{d.id}</Mono>
                  </span>
                  <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-danger">
                    <ShieldAlert size={13} className="shrink-0" />
                    <span className="truncate">{fail?.detail}</span>
                  </span>
                  <Status value={d.status} className="justify-self-end" />
                </Grid>
              );
            })}
          </Panel>
        </div>

        {/* Right rail ------------------------------------------------------ */}
        <div className="flex flex-col gap-4">
          <Panel
            title="Джоби"
            flush
            action={
              <Link to="jobs">
                <Button variant="quiet">Усі →</Button>
              </Link>
            }
          >
            {[...running, ...queued, ...failed].slice(0, 5).map((j) => (
              <button
                key={j.id}
                type="button"
                onClick={() => navigate(`jobs/${j.id}`)}
                className="studio-row block w-full border-b border-line px-4 py-2.5 text-left last:border-b-0"
              >
                <div className="flex items-center gap-2">
                  <span className="flex-1 truncate text-[13px] font-medium">{j.taskLabel}</span>
                  <Status value={j.status} />
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <Mono>{j.id}</Mono>
                  <Mono>·</Mono>
                  <Mono>{j.model}</Mono>
                  <span className="studio-num ml-auto text-[12px] text-muted">
                    {j.itemsDone}/{j.itemsTotal}
                  </span>
                </div>
                {/* Liveness, not progress: the runner cannot know what share of
                    the work is done until an item comes back. */}
                {j.status === 'running' && (
                  <div className="studio-live relative mt-2 h-0.5 w-full overflow-hidden rounded-full bg-line-strong" />
                )}
              </button>
            ))}
          </Panel>

          <Panel title="Провайдери" flush>
            {PROVIDERS.map((p) => (
              <div key={p.id} className="border-b border-line px-4 py-2.5 last:border-b-0">
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-[13px] font-medium">{p.label}</span>
                  <Status value={p.status} />
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <Bar value={p.monthly.costUsd} max={p.monthly.costLimitUsd} />
                  <Mono className="shrink-0">
                    {p.monthly.costLimitUsd > 0
                      ? `$${p.monthly.costUsd.toFixed(2)} / $${p.monthly.costLimitUsd}`
                      : 'локально'}
                  </Mono>
                </div>
              </div>
            ))}
          </Panel>

          <Panel title="Останні дії" flush>
            {AUDIT.slice(0, 5).map((a) => (
              <div key={a.id} className="border-b border-line px-4 py-2 last:border-b-0">
                <div className="flex items-baseline gap-2">
                  <Mono className="shrink-0">{a.at.slice(11)}</Mono>
                  <span className="flex-1 truncate text-[12.5px]">
                    <span className="text-muted">{a.actor}</span>{' '}
                    <Mono className="text-gold-ink">{a.action}</Mono>{' '}
                    <span className="text-faint">{a.target}</span>
                  </span>
                </div>
              </div>
            ))}
            <div className="px-4 py-2">
              <Link to="audit">
                <Button variant="quiet">Повний журнал →</Button>
              </Link>
            </div>
          </Panel>
        </div>
      </div>

      {!can('content.publish') && (
        <div className="mt-4 flex items-center gap-2 rounded-[var(--s-radius)] border border-dashed border-line-strong px-4 py-3 text-[12.5px] text-faint">
          <AlertTriangle size={14} className="shrink-0 text-gold" />
          Роль «{ROLE_LABEL[role]}» не публікує контент. Дії публікації й відкату
          лишаються видимими, але заблокованими — щоб було ясно, чого бракує.
          <Badge className="ml-auto">RBAC</Badge>
        </div>
      )}
    </Page>
  );
}
