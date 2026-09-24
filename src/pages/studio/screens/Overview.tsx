import { Link, useNavigate } from 'react-router-dom';
import { Compass, Plus } from 'lucide-react';
import { useDashboardQuery, useJobsQuery } from '../lib/queries';
import { useCan, useStudio } from '../lib/useStudio';
import { ROLE_LABEL, type Role } from '../lib/rbac';
import { Button, Mono, Note, Page, Panel, Status } from '../ui/kit';

/**
 * Level one. The screen answers one question — what should I do now — and
 * refuses to answer any other.
 *
 * The design prototype this was ported from also showed a three-card action
 * row (waiting-for-review / with errors / ready to publish), driven by draft
 * status counts. That data belongs to the Review domain, which isn't wired to
 * real endpoints until WS8b — so it's deliberately left out here rather than
 * shown against fabricated counts.
 */
export function Overview() {
  const { identity } = useStudio();
  const can = useCan();
  const navigate = useNavigate();
  const dashboard = useDashboardQuery();
  const activeJobs = useJobsQuery('active');
  const pendingJobs = useJobsQuery('pending');

  const primaryRole: Role = identity?.roles.includes('admin')
    ? 'admin'
    : identity?.roles.includes('content_publisher')
      ? 'content_publisher'
      : 'content_reviewer';

  const working = [...(activeJobs.data?.jobs ?? []), ...(pendingJobs.data?.jobs ?? [])];
  const jobsAvailable = activeJobs.data?.available ?? true;

  return (
    <Page
      title={`Доброго дня, ${ROLE_LABEL[primaryRole].toLowerCase()}`}
      subtitle={identity?.displayName}
      actions={
        <Link to="jobs/new">
          <Button
            variant="primary"
            size="md"
            denied={can('content:ai:run') ? null : 'Потрібне право запускати AI'}
          >
            <Plus size={14} />
            Створити контент
          </Button>
        </Link>
      }
    >
      <div className="grid gap-4 @min-[900px]:grid-cols-[1.25fr_1fr]">
        <Panel title="AI зараз працює" flush>
          {!jobsAvailable ? (
            <p className="px-4 py-8 text-center text-[13px] text-faint">
              Черга завдань недоступна в цьому середовищі: API-процес не запускає джоби напряму
              (вони йдуть у фоновому worker'і).
            </p>
          ) : working.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-faint">Нічого не виконується.</p>
          ) : (
            working.map((j) => (
              <button
                key={j.id}
                type="button"
                onClick={() => navigate(`jobs/${j.id}`)}
                className="studio-row block w-full border-b border-line px-4 py-3 text-left last:border-b-0"
              >
                <div className="flex items-center gap-2">
                  <span className="flex-1 truncate text-[13.5px] font-medium">{j.typeLabel}</span>
                  <Status value={j.status} />
                </div>
                {j.label && <p className="mt-1 truncate text-[12.5px] text-faint">{j.label}</p>}
                {j.status === 'active' && (
                  <span className="studio-live relative mt-2 block h-0.5 w-full overflow-hidden rounded-full bg-line-strong" />
                )}
              </button>
            ))
          )}
        </Panel>

        <Panel title="Що змінилось" flush>
          {(dashboard.data?.activity ?? []).length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-faint">Поки що порожньо.</p>
          ) : (
            dashboard.data!.activity.map((a, i) => (
              <div key={`${a.at}-${i}`} className="border-b border-line px-4 py-2.5 last:border-b-0">
                <p className="text-[12.5px] leading-relaxed">
                  <span className="font-medium">{a.action}</span>{' '}
                  {a.target && <span className="text-muted">→ {a.target}</span>}
                </p>
                <Mono className="mt-0.5 block">{new Date(a.at).toLocaleString('uk-UA')}</Mono>
              </div>
            ))
          )}
        </Panel>
      </div>

      <Note className="mt-4">
        <span className="flex items-center gap-2">
          <Compass size={14} className="shrink-0" />
          Уперше тут? На сторінці{' '}
          <Link to="guide" className="font-semibold text-indigo underline underline-offset-2">
            «Як це працює»
          </Link>{' '}
          — весь шлях контенту від ідеї до гри.
        </span>
      </Note>
    </Page>
  );
}
