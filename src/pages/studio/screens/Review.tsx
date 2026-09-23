import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Inbox } from 'lucide-react';
import { useApproveMutation, useReviewQueueQuery } from '../lib/queries';
import { plural } from '../lib/plural';
import { useCan } from '../lib/useStudio';
import type {
  ContentStatus,
  ReviewQueueItem,
  ReviewRevisionType,
  StatusCounts,
} from '../../../repos/studioRepo';
import {
  Badge,
  Button,
  Chip,
  Drawer,
  EmptyState,
  Grid,
  Mono,
  Note,
  Page,
  Panel,
  Status,
  Term,
  Toolbar,
} from '../ui/kit';
import { cn } from '../ui/cn';

/**
 * Persisted-status groups (ADR-019: `ContentStatus` stays 6-state). Each group
 * is its own server query — the queue is capped, so filtering one big list
 * client-side would silently hide rows past the cap.
 */
const STATUS_GROUPS: Array<{ id: string; label: string; statuses: ContentStatus[] }> = [
  { id: 'wait', label: 'Чекають', statuses: ['draft', 'ready_for_review'] },
  { id: 'legacy', label: 'Не перевірено', statuses: ['legacy_unreviewed'] },
  { id: 'quarantine', label: 'Карантин', statuses: ['quarantined'] },
];

const TYPE_FILTERS: Array<{ id: 'all' | ReviewRevisionType | 'scripture'; label: string }> = [
  { id: 'all', label: 'Усе' },
  { id: 'question', label: 'Питання' },
  { id: 'lesson', label: 'Уроки' },
  { id: 'scripture', label: 'Писання під питанням' },
];

const TYPE_LABEL: Record<ReviewRevisionType, string> = { question: 'питання', lesson: 'урок' };

const COLS = '1fr 1fr 170px';

function groupCount(counts: Record<ReviewRevisionType, StatusCounts> | null, statuses: ContentStatus[]) {
  if (!counts) return undefined;
  return statuses.reduce((sum, s) => sum + counts.question[s] + counts.lesson[s], 0);
}

/** One line that says why this row needs a human, in plain words. */
function problemOf(item: ReviewQueueItem): { text: string; tone: 'bad' | 'warn' | 'ok' } {
  if (item.decision?.decision === 'changes_requested') {
    return { text: item.decision.comment ?? 'Повернуто на доопрацювання', tone: 'warn' };
  }
  if (item.topProblem) {
    return {
      text: `${item.topProblem.label}: ${item.topProblem.detail}`,
      tone: item.topProblem.severity === 'blocking' ? 'bad' : 'warn',
    };
  }
  if (item.decision?.decision === 'approved') return { text: 'Схвалено — можна публікувати', tone: 'ok' };
  return { text: 'Перевірки не знайшли проблем — потрібне рішення людини', tone: 'ok' };
}

const blockerCount = (item: ReviewQueueItem) => item.findings.blocking + item.findings.scriptureUnresolved;

export function Review() {
  const navigate = useNavigate();
  const can = useCan();
  const [group, setGroup] = useState(STATUS_GROUPS[0].id);
  const [typeFilter, setTypeFilter] = useState<(typeof TYPE_FILTERS)[number]['id']>('all');
  const [open, setOpen] = useState<ReviewQueueItem | null>(null);

  const activeGroup = STATUS_GROUPS.find((g) => g.id === group) ?? STATUS_GROUPS[0];
  const query = useReviewQueueQuery(activeGroup.statuses);
  const approve = useApproveMutation();

  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const counts = query.data?.counts ?? null;
  const rows = items.filter((i) =>
    typeFilter === 'all'
      ? true
      : typeFilter === 'scripture'
        ? i.findings.scriptureUnresolved > 0
        : i.revisionType === typeFilter,
  );

  const approveDenied = (item: ReviewQueueItem): string | null =>
    !can('content:approve')
      ? 'Ваша роль не схвалює контент'
      : item.status === 'quarantined'
        ? 'Позиція в карантині'
        : blockerCount(item) > 0
          ? `Спершу треба усунути ${blockerCount(item)} ${plural(blockerCount(item), 'блокер', 'блокери', 'блокерів')}`
          : item.decision?.decision === 'approved'
            ? 'Вже схвалено'
            : null;

  const openFull = (item: ReviewQueueItem) => navigate(`${item.revisionType}/${item.revisionId}`);

  return (
    <Page wide title="Черга">
      {query.data && !query.data.available ? (
        <Note tone="danger">
          Черга ревʼю недоступна в цьому середовищі: сервер працює без бази даних, тож ревізій, які
          можна було б показати, немає. Це не «порожня черга» — дані просто не підключено.
        </Note>
      ) : (
        <>
          <Toolbar className="mb-2">
            {STATUS_GROUPS.map((g) => (
              <Chip
                key={g.id}
                active={g.id === group}
                onClick={() => {
                  setGroup(g.id);
                  setOpen(null);
                }}
                count={groupCount(counts, g.statuses)}
              >
                {g.label}
              </Chip>
            ))}
          </Toolbar>
          <Toolbar className="mb-3">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setTypeFilter(f.id)}
                className={cn(
                  'text-[12.5px] font-semibold',
                  f.id === typeFilter ? 'text-ink underline underline-offset-4' : 'text-faint hover:text-ink',
                )}
              >
                {f.label}
              </button>
            ))}
          </Toolbar>

          {query.isError && (
            <Note tone="danger" className="mb-3">
              Не вдалося завантажити чергу: {(query.error as Error).message}
            </Note>
          )}

          <Panel flush>
            <Grid head cols={COLS}>
              <span>Позиція</span>
              <span>Що з нею</span>
              <span>Стан</span>
            </Grid>
            {query.isLoading && <p className="px-4 py-8 text-center text-[13px] text-faint">Завантаження…</p>}
            {rows.map((item) => {
              const problem = problemOf(item);
              return (
                <Grid
                  key={item.revisionId}
                  cols={COLS}
                  active={open?.revisionId === item.revisionId}
                  onClick={() => setOpen(item)}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{item.title}</span>
                    <span className="block truncate text-[12px] text-faint">
                      {TYPE_LABEL[item.revisionType]} · {item.context}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'truncate text-[12.5px]',
                      problem.tone === 'bad' ? 'text-danger' : problem.tone === 'warn' ? 'text-gold-ink' : 'text-faint',
                    )}
                  >
                    {problem.text}
                  </span>
                  <span className="flex flex-wrap gap-1">
                    <Status value={item.decision?.decision ?? item.status} />
                  </span>
                </Grid>
              );
            })}
            {!query.isLoading && rows.length === 0 && (
              <EmptyState
                icon={<Inbox size={18} />}
                title="Тут порожньо"
                body="За цим фільтром нічого немає. Опублікована позиція зникає з черги — це нормально."
                action={
                  typeFilter !== 'all' ? (
                    <Button variant="ghost" onClick={() => setTypeFilter('all')}>
                      Показати все
                    </Button>
                  ) : undefined
                }
              />
            )}
          </Panel>

          {rows.length > 0 && (
            <p className="mt-3 text-[12px] text-faint">
              {rows.length} {plural(rows.length, 'позиція', 'позиції', 'позицій')} · клік по рядку
              відкриває коротку картку, «Відкрити повністю» — зміни, Писання й історію рішень.
            </p>
          )}
        </>
      )}

      {/* Level two: enough to decide without leaving the list ---------------- */}
      <Drawer
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        title={open?.title ?? ''}
        subtitle={open ? `${TYPE_LABEL[open.revisionType]} · ${open.context}` : undefined}
        status={open && <Status value={open.decision?.decision ?? open.status} />}
        footer={
          open && (
            <>
              <Button
                variant="primary"
                denied={approve.isPending ? 'Зберігаю…' : approveDenied(open)}
                onClick={() =>
                  approve.mutate(
                    { type: open.revisionType, id: open.revisionId },
                    { onSuccess: () => setOpen(null) },
                  )
                }
              >
                <Check size={13} />
                Схвалити
              </Button>
              <Button variant="quiet" className="ml-auto" onClick={() => openFull(open)}>
                Відкрити повністю
                <ArrowRight size={13} />
              </Button>
            </>
          )
        }
      >
        {open && (
          <>
            {approve.isError && (
              <Note tone="danger" className="mb-3">
                {(approve.error as Error).message}
              </Note>
            )}
            <p className="mb-2 flex items-center gap-1.5 text-[11.5px] font-semibold tracking-[0.02em] text-faint uppercase">
              <Term k="check">Перевірки</Term>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {open.findings.blocking > 0 && <Badge tone="danger">{open.findings.blocking} блокує</Badge>}
              {open.findings.scriptureUnresolved > 0 && (
                <Badge tone="danger">{open.findings.scriptureUnresolved} Писання</Badge>
              )}
              {open.findings.warning > 0 && <Badge tone="gold">{open.findings.warning} увага</Badge>}
              {open.findings.info > 0 && <Badge>{open.findings.info} довідка</Badge>}
              {blockerCount(open) + open.findings.warning + open.findings.info === 0 && (
                <span className="text-[12.5px] text-success">Автоматичні перевірки нічого не знайшли.</span>
              )}
            </div>
            {open.topProblem && (
              <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
                <span className="font-semibold">{open.topProblem.label}.</span> {open.topProblem.detail}
              </p>
            )}
            {open.decision && (
              <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
                <Status value={open.decision.decision} className="mr-1.5" />
                {open.decision.comment}
              </p>
            )}
            <p className="mt-4 border-t border-line pt-3 text-[12px] text-faint">
              Створено {new Date(open.createdAt).toLocaleString('uk-UA')} ·{' '}
              <Term k="revision">ревізія</Term> {open.revisionNumber} · <Mono>{open.source}</Mono>
            </p>
          </>
        )}
      </Drawer>

      <p className="mt-2 text-[12px] text-faint">
        Нічого з цієї сторінки не бачать гравці, доки позицію не опубліковано.{' '}
        <Link to="../guide" className="text-indigo underline underline-offset-2">
          Як влаштований шлях контенту
        </Link>
      </p>
    </Page>
  );
}
