import { useNavigate, useParams } from 'react-router-dom';
import { Ban, ChevronLeft } from 'lucide-react';
import { useCancelJobMutation, useJobQuery } from '../lib/queries';
import { useCan } from '../lib/useStudio';
import { Bar, Button, KeyVal, Mono, Note, Page, Panel, Status, Term } from '../ui/kit';

export function JobDetail() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const can = useCan();
  const query = useJobQuery(jobId);
  const cancelMutation = useCancelJobMutation();

  if (query.isLoading) {
    return (
      <Page title="Завдання">
        <p className="text-[13px] text-faint">Завантаження…</p>
      </Page>
    );
  }

  if (!query.data?.available) {
    return (
      <Page title="Завдання">
        <Note tone="danger">
          Черга завдань недоступна в цьому середовищі — API-процес не бачить фонового worker'а.
        </Note>
      </Page>
    );
  }

  const job = query.data.job;
  if (!job) {
    return (
      <Page title="Завдання">
        <Note>Такого завдання немає.</Note>
      </Page>
    );
  }

  const cancellable = job.status === 'active' || job.status === 'pending' || job.status === 'retry';

  return (
    <Page
      title={job.typeLabel}
      subtitle={job.label ?? job.type}
      actions={
        <>
          <Button variant="quiet" onClick={() => navigate('..')}>
            <ChevronLeft size={13} />
            Назад до списку
          </Button>
          <Button
            variant="danger"
            denied={
              !can('content:ai:run')
                ? 'Потрібне право зупиняти'
                : !cancellable
                  ? 'Запуск уже завершено'
                  : null
            }
            onClick={() => cancelMutation.mutate(job.id)}
          >
            <Ban size={13} />
            Зупинити
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-[1fr_1.2fr] gap-4">
        <Panel title="Стан">
          <div className="mb-3">
            <Status value={job.status} />
          </div>
          <dl>
            <KeyVal k="Спроб" v={`${job.attempts} / ${job.maxAttempts}`} />
            <KeyVal k="Створено" v={<Mono>{new Date(job.createdAt).toLocaleString('uk-UA')}</Mono>} />
            {job.startedAt && (
              <KeyVal k="Почато" v={<Mono>{new Date(job.startedAt).toLocaleString('uk-UA')}</Mono>} />
            )}
            {job.completedAt && (
              <KeyVal
                k="Завершено"
                v={<Mono>{new Date(job.completedAt).toLocaleString('uk-UA')}</Mono>}
              />
            )}
            {job.artifactKey && <KeyVal k="Артефакт" v={<Mono>{job.artifactKey}</Mono>} />}
          </dl>
          {job.error && (
            <p className="mt-3 rounded-[var(--s-radius-sm)] border border-[color-mix(in_srgb,var(--p-danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--p-danger)_8%,transparent)] px-3 py-2 text-[12.5px] text-danger">
              {job.error}
            </p>
          )}
        </Panel>

        {job.budget && job.usage && (
          <Panel
            title={
              <>
                <Term k="budget" iconOnly />
                Бюджет
              </>
            }
          >
            <div className="grid gap-2.5">
              {job.budget.maxRequests !== undefined && (
                <div>
                  <div className="mb-1 flex items-baseline justify-between">
                    <span className="text-[12px] text-faint">Запити</span>
                    <span className="studio-num text-[12.5px] font-semibold">
                      {job.usage.requests} / {job.budget.maxRequests}
                    </span>
                  </div>
                  <Bar value={job.usage.requests} max={job.budget.maxRequests} />
                </div>
              )}
              {job.budget.maxTokens !== undefined && (
                <div>
                  <div className="mb-1 flex items-baseline justify-between">
                    <span className="text-[12px] text-faint">Токени</span>
                    <span className="studio-num text-[12.5px] font-semibold">
                      {job.usage.tokens.toLocaleString('uk-UA')} /{' '}
                      {job.budget.maxTokens.toLocaleString('uk-UA')}
                    </span>
                  </div>
                  <Bar value={job.usage.tokens} max={job.budget.maxTokens} />
                </div>
              )}
              {job.budget.maxCostUsd !== undefined && (
                <div>
                  <div className="mb-1 flex items-baseline justify-between">
                    <span className="text-[12px] text-faint">Гроші</span>
                    <span className="studio-num text-[12.5px] font-semibold">
                      ${job.usage.costUsd.toFixed(2)} / ${job.budget.maxCostUsd.toFixed(2)}
                    </span>
                  </div>
                  <Bar value={job.usage.costUsd} max={job.budget.maxCostUsd} />
                </div>
              )}
            </div>
          </Panel>
        )}
      </div>
    </Page>
  );
}
