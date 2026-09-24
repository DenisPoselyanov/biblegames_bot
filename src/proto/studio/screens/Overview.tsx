import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Compass,
  Plus,
  Rocket,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react';
import { AUDIT, DRAFTS, JOBS, ROLE_LABEL } from '../lib/mock';
import { plural } from '../lib/plural';
import { useCan, useStudio } from '../lib/useStudio';
import { Button, Mono, Note, Page, Panel, Status } from '../ui/kit';
import { cn } from '../../ui/cn';

/**
 * Level one. The screen answers one question — what should I do now — and
 * refuses to answer any other. Counters, funnels and provider health moved to
 * the screens that own them.
 */
function ActionCard({
  icon: Icon,
  count,
  title,
  body,
  to,
  tone,
}: {
  icon: LucideIcon;
  count: number;
  title: string;
  body: string;
  to: string;
  tone: 'gold' | 'danger' | 'success';
}) {
  const tones = {
    gold: 'border-[color-mix(in_srgb,var(--p-gold)_40%,transparent)] bg-[color-mix(in_srgb,var(--p-gold)_10%,transparent)] text-gold-ink',
    danger:
      'border-[color-mix(in_srgb,var(--p-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--p-danger)_9%,transparent)] text-danger',
    success:
      'border-[color-mix(in_srgb,var(--p-success)_38%,transparent)] bg-[color-mix(in_srgb,var(--p-success)_9%,transparent)] text-success',
  }[tone];

  return (
    <Link
      to={to}
      className="studio-row group flex items-start gap-3 rounded-[var(--s-radius)] border border-line bg-[var(--s-panel)] p-4"
    >
      <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-full border', tones)}>
        <Icon size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="studio-num font-display text-[24px] leading-none font-semibold">
            {count}
          </span>
          <span className="text-[14px] font-semibold">{title}</span>
        </span>
        <span className="mt-1.5 block text-[12.5px] leading-relaxed text-faint">{body}</span>
      </span>
      <ArrowRight
        size={16}
        className="mt-1 shrink-0 text-faint transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}

export function Overview() {
  const { role } = useStudio();
  const can = useCan();
  const navigate = useNavigate();

  const waiting = DRAFTS.filter((d) => d.status === 'ready_for_review');
  const broken = DRAFTS.filter((d) => d.status === 'validation_failed');
  const approved = DRAFTS.filter((d) => d.status === 'approved');
  const rework = DRAFTS.filter((d) => d.status === 'changes_requested');
  const working = JOBS.filter((j) => j.status === 'running' || j.status === 'queued');

  /* The same three numbers mean different work depending on who is looking. */
  const cards =
    role === 'author'
      ? [
          {
            icon: ShieldAlert,
            count: broken.length,
            title: 'з помилками',
            body: 'Перевірка не пройдена: поки причину не усунуто, позиція не піде на розгляд.',
            to: 'review',
            tone: 'danger' as const,
          },
          {
            icon: BadgeCheck,
            count: rework.length,
            title: 'повернули тобі',
            body: 'Рецензент попросив змінити формулювання або скоротити текст.',
            to: 'review',
            tone: 'gold' as const,
          },
        ]
      : [
          {
            icon: BadgeCheck,
            count: waiting.length,
            title: plural(waiting.length, 'позиція чекає', 'позиції чекають', 'позицій чекають'),
            body: 'Готові до розгляду: перевірки пройдено, потрібне рішення людини.',
            to: 'review',
            tone: 'gold' as const,
          },
          {
            icon: ShieldAlert,
            count: broken.length,
            title: 'з помилками',
            body: 'Заблоковані автоматично: не той вірш або відповідь не підтверджується.',
            to: 'review',
            tone: 'danger' as const,
          },
          {
            icon: Rocket,
            count: approved.length,
            title: 'готові до випуску',
            body: 'Схвалено й чекає на публікацію в гру.',
            to: 'releases',
            tone: 'success' as const,
          },
        ];

  return (
    <Page
      title={`Доброго дня, ${ROLE_LABEL[role].toLowerCase()}`}
      subtitle="17 вересня 2026"
      actions={
        <Link to="jobs/new">
          <Button
            variant="primary"
            size="md"
            denied={can('job.run') ? null : 'Потрібне право запускати AI'}
          >
            <Plus size={14} />
            Створити контент
          </Button>
        </Link>
      }
    >
      <div className={cn(
          'mb-4 grid gap-3',
          cards.length === 2 ? '@min-[560px]:grid-cols-2' : '@min-[900px]:grid-cols-3',
        )}>
        {cards.map((c) => (
          <ActionCard key={c.title} {...c} />
        ))}
      </div>

      <div className="grid gap-4 @min-[900px]:grid-cols-[1.25fr_1fr]">
        <Panel title="AI зараз працює" flush>
          {working.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-faint">
              Нічого не виконується.
            </p>
          ) : (
            working.map((j) => (
              <button
                key={j.id}
                type="button"
                onClick={() => navigate(`jobs/${j.id}`)}
                className="studio-row block w-full border-b border-line px-4 py-3 text-left last:border-b-0"
              >
                <div className="flex items-center gap-2">
                  <span className="flex-1 truncate text-[13.5px] font-medium">{j.taskLabel}</span>
                  <Status value={j.status} />
                </div>
                <p className="mt-1 truncate text-[12.5px] text-faint">{j.target}</p>
                <div className="mt-2 flex items-center gap-3">
                  <span className="studio-num text-[12.5px] text-muted">
                    {j.itemsDone} з {j.itemsTotal}
                  </span>
                  {j.status === 'running' && (
                    <span className="studio-live relative h-0.5 flex-1 overflow-hidden rounded-full bg-line-strong" />
                  )}
                </div>
              </button>
            ))
          )}
        </Panel>

        <Panel title="Що змінилось" flush>
          {AUDIT.slice(0, 4).map((a) => (
            <div key={a.id} className="border-b border-line px-4 py-2.5 last:border-b-0">
              <p className="text-[12.5px] leading-relaxed">
                <span className="font-medium">{a.actor}</span>{' '}
                <span className="text-muted">{a.detail}</span>
              </p>
              <Mono className="mt-0.5 block">{a.at}</Mono>
            </div>
          ))}
          <div className="px-4 py-2.5">
            <Link to="releases">
              <Button variant="quiet">Увесь журнал →</Button>
            </Link>
          </div>
        </Panel>
      </div>

      <Note className="mt-4">
        <span className="flex items-center gap-2">
          <Compass size={14} className="shrink-0" />
          Уперше тут? На сторінці{' '}
          <Link to="guide" className="font-semibold text-indigo underline underline-offset-2">
            «Як це працює»
          </Link>{' '}
          — весь шлях контенту від ідеї до гри, за три хвилини.
        </span>
      </Note>
    </Page>
  );
}
