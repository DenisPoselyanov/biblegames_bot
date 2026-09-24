import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Flag, Sparkles, X } from 'lucide-react';
import {
  useRepairFromReportsMutation,
  useReportDetailQuery,
  useReportGroupsQuery,
  useResolveReportsMutation,
} from '../lib/queries';
import { plural } from '../lib/plural';
import { useCan } from '../lib/useStudio';
import type { ReportCategory, ReportGroup } from '../../../repos/studioRepo';
import {
  Badge,
  Button,
  Chip,
  Drawer,
  EmptyState,
  Field,
  Grid,
  Input,
  Mono,
  NARROW_ONLY,
  Note,
  Page,
  Panel,
  Status,
  Textarea,
  Toolbar,
  WIDE_ONLY,
} from '../ui/kit';
import { cn } from '../ui/cn';

const COLS = '1fr 260px 110px 170px';
/* Narrow: the time of the latest report folds under the item's id. */
const COLS_NARROW = '1fr 210px 90px';

/**
 * Player content reports (Phase 4 WS9, spec §14) — a second view of the review
 * queue, not a new menu entry (the prototype's seven-item sidebar stays).
 * Reports are grouped per question/lesson; a reviewer sees what was reported
 * and the players' comments, never who sent them. Resolving closes every open
 * report on the item at once and can link the revision that fixed it; the
 * report itself never changes content (§22).
 */

const CATEGORY_LABEL: Record<ReportCategory, string> = {
  wrong_answer: 'Неправильна відповідь',
  wording: 'Формулювання',
  translation: 'Переклад',
  reference: 'Посилання',
  offensive: 'Чутливе / образливе',
  technical: 'Технічна помилка',
};

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('uk-UA') : '—');

export function Reports() {
  const [closed, setClosed] = useState(false);
  const [open, setOpen] = useState<ReportGroup | null>(null);
  const query = useReportGroupsQuery(closed);
  const groups = query.data?.groups ?? [];

  return (
    <Page
      wide
      title="Скарги гравців"
      subtitle="Згруповано за питанням чи уроком. Хто саме поскаржився — не показується."
      actions={
        <Link to="/studio/review">
          <Button variant="quiet">
            <ArrowLeft size={13} />
            До черги
          </Button>
        </Link>
      }
    >
      <Toolbar className="mb-3">
        <Chip active={!closed} onClick={() => setClosed(false)}>
          Відкриті
        </Chip>
        <Chip active={closed} onClick={() => setClosed(true)}>
          Разом із закритими
        </Chip>
      </Toolbar>

      {query.isError ? (
        <Note tone="danger">Не вдалося завантажити скарги: {(query.error as Error).message}</Note>
      ) : query.data && !query.data.available ? (
        <Note tone="danger">Скарги недоступні: сервер працює без бази даних.</Note>
      ) : (
        <Panel flush>
          {groups.length === 0 ? (
            <EmptyState
              icon={<Flag size={18} />}
              title={query.isLoading ? 'Завантажую…' : 'Відкритих скарг немає'}
              body="Гравці можуть позначити питання як помилкове просто під час гри — такі скарги з’являться тут."
            />
          ) : (
            <>
              <Grid head cols={COLS} narrow={COLS_NARROW}>
                <span>Що</span>
                <span>Про що скаржаться</span>
                <span>Відкритих</span>
                <span className={WIDE_ONLY}>Остання</span>
              </Grid>
              {groups.map((g) => (
                <Grid
                  key={`${g.entityType}:${g.entityId}`}
                  cols={COLS}
                  narrow={COLS_NARROW}
                  onClick={() => setOpen(g)}
                  active={open?.entityId === g.entityId && open.entityType === g.entityType}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{g.title ?? g.entityId}</span>
                    <span className="mt-0.5 flex items-center gap-2">
                      <Badge>{g.entityType === 'question' ? 'питання' : 'урок'}</Badge>
                      <Mono className="truncate text-[11.5px]">{g.entityId}</Mono>
                      <span className={cn('shrink-0 text-[11.5px] text-faint', NARROW_ONLY)}>
                        {fmt(g.latestAt)}
                      </span>
                    </span>
                  </span>
                  <span className="flex min-w-0 flex-wrap gap-1">
                    {Object.entries(g.categories).map(([c, n]) => (
                      <Badge key={c} tone={c === 'wrong_answer' || c === 'offensive' ? 'danger' : 'gold'}>
                        {CATEGORY_LABEL[c as ReportCategory]} · {n}
                      </Badge>
                    ))}
                    {g.openCount === 0 && <Status value="archived" />}
                  </span>
                  <span className="studio-num">{g.openCount}</span>
                  <Mono className={cn('text-muted', WIDE_ONLY)}>{fmt(g.latestAt)}</Mono>
                </Grid>
              ))}
            </>
          )}
        </Panel>
      )}

      <ReportDrawer group={open} onClose={() => setOpen(null)} />
    </Page>
  );
}

function ReportDrawer({ group, onClose }: { group: ReportGroup | null; onClose: () => void }) {
  const can = useCan();
  const detail = useReportDetailQuery(group?.entityType, group?.entityId);
  const resolve = useResolveReportsMutation();
  const repair = useRepairFromReportsMutation();
  const [note, setNote] = useState('');
  const [revisionId, setRevisionId] = useState('');

  const close = () => {
    setNote('');
    setRevisionId('');
    resolve.reset();
    repair.reset();
    onClose();
  };

  const busy = resolve.isPending || repair.isPending;
  const hasOpen = (group?.openCount ?? 0) > 0;
  const resolveDenied = !can('content:review')
    ? 'Ваша роль не розглядає скарги'
    : !hasOpen
      ? 'Відкритих скарг немає'
      : busy
        ? 'Зберігаю…'
        : null;
  const repairDenied = !can('content:ai:run')
    ? 'Ваша роль не запускає AI'
    : group?.entityType !== 'question'
      ? 'AI-виправлення — лише для питань'
      : !hasOpen
        ? 'Відкритих скарг немає'
        : busy
          ? 'Створюю…'
          : null;

  const submit = (status: 'resolved' | 'dismissed') =>
    group &&
    resolve.mutate(
      {
        type: group.entityType,
        entityId: group.entityId,
        status,
        note: note.trim() || undefined,
        revisionId: revisionId.trim() || undefined,
      },
      { onSuccess: close },
    );

  return (
    <Drawer
      open={Boolean(group)}
      onClose={close}
      title={group?.title ?? group?.entityId ?? ''}
      subtitle={group ? `${group.totalCount} ${plural(group.totalCount, 'скарга', 'скарги', 'скарг')} усього` : undefined}
      status={group && (hasOpen ? <Badge tone="danger">{group.openCount} відкр.</Badge> : <Status value="archived" />)}
      footer={
        <>
          <Button variant="primary" denied={resolveDenied} onClick={() => submit('resolved')}>
            <Check size={13} />
            Виправлено
          </Button>
          <Button variant="ghost" denied={resolveDenied} onClick={() => submit('dismissed')}>
            <X size={13} />
            Відхилити
          </Button>
          <Button
            variant="quiet"
            className="ml-auto"
            denied={repairDenied}
            onClick={() => group && repair.mutate(group.entityId)}
          >
            <Sparkles size={13} />
            Виправити через AI
          </Button>
        </>
      }
    >
      {group && (
        <>
          {group.entityType === 'question' && group.latestRevisionId && (
            <p className="mb-3 text-[12.5px]">
              <Link
                to={`/studio/review/question/${encodeURIComponent(group.latestRevisionId)}`}
                className="font-semibold text-indigo underline underline-offset-2"
              >
                Відкрити ревізію, яку бачили гравці
              </Link>
            </p>
          )}

          {resolve.isError && <Note tone="danger" className="mb-3">{(resolve.error as Error).message}</Note>}
          {repair.isError && <Note tone="danger" className="mb-3">{(repair.error as Error).message}</Note>}
          {repair.data && (
            <Note className="mb-3">
              Завдання створено —{' '}
              <Link to={`/studio/jobs/${repair.data.jobId}`} className="font-semibold text-indigo underline">
                відкрити
              </Link>
              . Пропозиція AI піде на ревʼю, скарги лишаються відкритими до рішення людини.
            </Note>
          )}

          <ul className="grid gap-2">
            {(detail.data?.reports ?? []).map((r) => (
              <li key={r.id} className="rounded-[var(--s-radius-sm)] border border-line px-3 py-2">
                <div className="flex items-center gap-2">
                  <Badge tone={r.category === 'wrong_answer' || r.category === 'offensive' ? 'danger' : 'gold'}>
                    {CATEGORY_LABEL[r.category]}
                  </Badge>
                  {r.status !== 'open' && <Status value={r.status === 'resolved' ? 'published' : 'archived'} />}
                  <Mono className="ml-auto text-[11.5px]">{fmt(r.createdAt)}</Mono>
                </div>
                {r.comment && <p className="mt-1.5 text-[13px] leading-relaxed">«{r.comment}»</p>}
                {r.resolutionNote && <p className="mt-1 text-[12px] text-faint">Рішення: {r.resolutionNote}</p>}
              </li>
            ))}
            {detail.isLoading && <li className="text-[12.5px] text-faint">Завантажую…</li>}
          </ul>

          {hasOpen && (
            <div className="mt-4 grid gap-3 border-t border-line pt-3">
              <Field label="Що зроблено" hint="Необовʼязково. Гравці цього не бачать — лише статус.">
                <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
              </Field>
              <Field label="Ревізія з виправленням" hint="Необовʼязково — посилання в журналі на те, що виправило скаргу.">
                <Input value={revisionId} onChange={(e) => setRevisionId(e.target.value)} placeholder="qrev_…" />
              </Field>
            </div>
          )}
        </>
      )}
    </Drawer>
  );
}
