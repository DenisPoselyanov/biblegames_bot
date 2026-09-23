import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Rocket, Undo2 } from 'lucide-react';
import { actionLabel, actionTone } from '../lib/auditLabels';
import { useActivityQuery, useReleasesQuery, useRollbackMutation, useSetVersionQuery } from '../lib/queries';
import { plural } from '../lib/plural';
import { useCan } from '../lib/useStudio';
import type { SetVersionSummary, StudioActivityEntry } from '../../../repos/studioRepo';
import {
  Badge,
  Button,
  Chip,
  Drawer,
  EmptyState,
  Grid,
  KeyVal,
  Mono,
  Note,
  Page,
  Panel,
  Status,
  Term,
  Toolbar,
} from '../ui/kit';

/**
 * Releases (Phase 4 WS8c) — ported from the design prototype's `releases`
 * screen. «Випуски» is what players get: every frozen content-set version,
 * plus the revision-level publish history from the audit log (the review
 * editor publishes single revisions — those are real releases too).
 * «Журнал» is the append-only audit log itself.
 *
 * Not ported: the prototype's one-button "publish every approved item". A
 * batch publish without viewing each item's blockers is a §22 forbidden
 * shortcut — publishing stays a per-revision act in the review editor.
 */

const fmt = (iso: string) => new Date(iso).toLocaleString('uk-UA');

const JOURNAL_FILTERS: Array<{ id: string; label: string; action?: string }> = [
  { id: 'all', label: 'Усе' },
  { id: 'publish', label: 'Публікації', action: 'content.publish' },
  { id: 'rollback', label: 'Відкати', action: 'content.rollback' },
  { id: 'decision', label: 'Рішення', action: 'content.review_decision' },
  { id: 'denied', label: 'Відмови в доступі', action: 'authz.denied' },
];

function whoOf(entry: StudioActivityEntry): string {
  return entry.actor.userId ?? 'система';
}

function detailOf(entry: StudioActivityEntry): string {
  const m = entry.metadata ?? {};
  if (entry.action === 'content.rollback') return `до версії ${String(m.toVersion)} → нова версія ${String(m.fromVersion)}`;
  if (entry.action === 'content.publish' && typeof m.version === 'number') {
    return `версія ${m.version} · ${String(m.itemCount ?? '?')} позицій`;
  }
  if (entry.action === 'content.publish' && m.revisionType) return m.revisionType === 'lesson' ? 'урок' : 'питання';
  if (entry.action === 'content.publish_denied' && Array.isArray(m.blockers)) {
    return `${m.blockers.length} ${plural(m.blockers.length, 'блокер', 'блокери', 'блокерів')}`;
  }
  if (entry.action === 'content.review_decision') return String(m.decision ?? '');
  if (entry.action === 'authz.denied') {
    return Array.isArray(m.needed) ? `потрібно: ${m.needed.join(', ')}` : '';
  }
  return '';
}

/** Link a revision-level history row back to its review page when we know the type. */
function revisionLink(entry: StudioActivityEntry): string | null {
  const type = entry.metadata?.revisionType;
  if (!entry.target || (type !== 'question' && type !== 'lesson')) return null;
  return `/studio/review/${type}/${encodeURIComponent(entry.target)}`;
}

export function Releases() {
  const [tab, setTab] = useState<'releases' | 'log'>('releases');
  const releases = useReleasesQuery();

  return (
    <Page
      wide
      title="Випуск"
      actions={
        <Toolbar>
          <Chip active={tab === 'releases'} onClick={() => setTab('releases')} count={releases.data?.sets.length}>
            Випуски
          </Chip>
          <Chip active={tab === 'log'} onClick={() => setTab('log')}>
            Журнал
          </Chip>
        </Toolbar>
      }
    >
      {tab === 'releases' ? <ReleaseList query={releases} /> : <Journal />}
    </Page>
  );
}

function ReleaseList({ query }: { query: ReturnType<typeof useReleasesQuery> }) {
  const [open, setOpen] = useState<SetVersionSummary | null>(null);
  const data = query.data;

  if (query.isError) {
    return <Note tone="danger">Не вдалося завантажити випуски: {(query.error as Error).message}</Note>;
  }
  if (!data) return <p className="py-10 text-center text-[13px] text-faint">Завантажую…</p>;

  const history = data.history;

  return (
    <>
      {!data.available ? (
        <Note tone="danger" className="mb-3">
          Набори недоступні в цьому середовищі: сервер працює без бази даних. Історія публікацій нижче
          береться з журналу й від бази не залежить.
        </Note>
      ) : (
        <Panel className="mb-4" title={<Term k="contentSet">Набори</Term>} flush>
          {data.sets.length === 0 ? (
            <EmptyState
              icon={<Rocket size={18} />}
              title="Жодного набору ще не опубліковано"
              body="Набір — заморожена версія вікторини, плейлиста чи пулу практики. Поки їх немає, гра бере опубліковані ревізії напряму."
            />
          ) : (
            <>
              <Grid head cols="1fr 110px 180px 110px 130px">
                <span>Набір</span>
                <span>Версія</span>
                <span>Коли</span>
                <span>Позицій</span>
                <span>Стан</span>
              </Grid>
              {data.sets.map((s) => (
                <Grid
                  key={`${s.setId}#${s.version}`}
                  cols="1fr 110px 180px 110px 130px"
                  onClick={() => setOpen(s)}
                  active={open?.setId === s.setId && open.version === s.version}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{s.setId}</span>
                    <span className="block truncate text-[12px] text-faint">{s.kind}</span>
                  </span>
                  <span className="studio-num">v{s.version}</span>
                  <Mono className="text-muted">{fmt(s.publishedAt)}</Mono>
                  <span className="studio-num">{s.questionCount}</span>
                  <span>
                    {s.isLatest ? <Badge tone="success">активна</Badge> : <Badge>попередня</Badge>}
                  </span>
                </Grid>
              ))}
            </>
          )}
        </Panel>
      )}

      <Panel title="Опубліковані ревізії" subtitle="Останні публікації й відмови — з журналу дій" flush>
        {history.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-faint">Ще нічого не публікували.</p>
        ) : (
          <>
            <Grid head cols="180px 150px 170px 1fr">
              <span>Коли</span>
              <span>Хто</span>
              <span>Що</span>
              <span>Позиція</span>
            </Grid>
            {history.map((h, i) => {
              const link = revisionLink(h);
              return (
                <Grid key={`${h.at}-${i}`} cols="180px 150px 170px 1fr">
                  <Mono className="text-muted">{fmt(h.at)}</Mono>
                  <span className="truncate text-[12.5px]">{whoOf(h)}</span>
                  <span>
                    <Badge tone={actionTone(h.action, h.result)}>{actionLabel(h.action)}</Badge>
                  </span>
                  <span className="min-w-0 truncate text-[12.5px] text-muted">
                    {link ? (
                      <Link to={link} className="studio-mono text-indigo underline underline-offset-2">
                        {h.target}
                      </Link>
                    ) : (
                      <Mono>{h.target ?? '—'}</Mono>
                    )}{' '}
                    {detailOf(h)}
                  </span>
                </Grid>
              );
            })}
          </>
        )}
      </Panel>

      <Note className="mt-3">
        Публікація — окрема дія з окремим правом, і робиться по одній ревізії в{' '}
        <Link to="/studio/review" className="font-semibold text-indigo underline underline-offset-2">
          черзі
        </Link>
        : масова публікація без перегляду блокерів заборонена. Старі ревізії й версії не видаляються, тому{' '}
        <Term k="rollback">відкат</Term> — це одна дія.
      </Note>

      <VersionDrawer version={open} onClose={() => setOpen(null)} />
    </>
  );
}

function VersionDrawer({ version, onClose }: { version: SetVersionSummary | null; onClose: () => void }) {
  const can = useCan();
  const detail = useSetVersionQuery(version?.setId, version?.version);
  const rollback = useRollbackMutation();
  const [confirming, setConfirming] = useState(false);

  const close = () => {
    setConfirming(false);
    rollback.reset();
    onClose();
  };

  const rollbackDenied = !version
    ? 'Нічого не вибрано'
    : !can('content:rollback')
      ? 'Ваша роль не відкочує випуски'
      : version.isLatest
        ? 'Це активна версія — відкотити можна лише до старішої'
        : rollback.isPending
          ? 'Відкочую…'
          : null;

  return (
    <Drawer
      open={Boolean(version)}
      onClose={close}
      title={version ? `${version.setId} · v${version.version}` : ''}
      subtitle={version?.kind}
      status={version && (version.isLatest ? <Badge tone="success">активна</Badge> : <Badge>попередня</Badge>)}
      footer={
        confirming && version ? (
          <>
            <span className="text-[12.5px]">
              Зробити v{version.version} активною? Гравці отримають її склад одразу.
            </span>
            <Button
              variant="danger"
              denied={rollbackDenied}
              onClick={() =>
                rollback.mutate(
                  { setId: version.setId, toVersion: version.version, confirmSetId: version.setId },
                  { onSuccess: close, onSettled: () => setConfirming(false) },
                )
              }
            >
              <Undo2 size={13} />
              Так, відкотити
            </Button>
            <Button variant="quiet" onClick={() => setConfirming(false)}>
              Скасувати
            </Button>
          </>
        ) : (
          <Button variant="danger" denied={rollbackDenied} onClick={() => setConfirming(true)}>
            <Undo2 size={13} />
            Відкотити до цієї версії
          </Button>
        )
      }
    >
      {version && (
        <>
          <dl>
            <KeyVal k="Опубліковано" v={fmt(version.publishedAt)} />
            <KeyVal k="Хто" v={version.publishedBy ?? '—'} />
            <KeyVal k="Позицій" v={<span className="studio-num">{version.questionCount}</span>} />
            <KeyVal k="Хеш складу" v={<Mono>{version.contentHash.slice(0, 16)}…</Mono>} />
          </dl>
          {rollback.isError && (
            <Note tone="danger" className="mt-3">
              {(rollback.error as Error).message}
            </Note>
          )}
          <p className="mt-4 mb-2 text-[11.5px] font-semibold tracking-[0.02em] text-faint uppercase">Склад</p>
          {detail.isLoading ? (
            <p className="text-[12.5px] text-faint">Завантажую…</p>
          ) : (
            <ul className="grid gap-1.5">
              {(detail.data?.items ?? []).map((item) => (
                <li
                  key={item.position}
                  className="flex items-center gap-2 rounded-[var(--s-radius-sm)] border border-line px-2.5 py-1.5"
                >
                  <span className="studio-num w-6 shrink-0 text-[11.5px] text-faint">{item.position + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px]">{item.text ?? item.questionId}</span>
                  {item.status && <Status value={item.status} />}
                </li>
              ))}
              {detail.data?.truncated && (
                <li className="text-[12px] text-faint">Показано перші 100 позицій.</li>
              )}
            </ul>
          )}
        </>
      )}
    </Drawer>
  );
}

function Journal() {
  const [filter, setFilter] = useState(JOURNAL_FILTERS[0].id);
  const active = JOURNAL_FILTERS.find((f) => f.id === filter) ?? JOURNAL_FILTERS[0];
  const query = useActivityQuery(active.action);
  const rows = query.data?.activity ?? [];

  return (
    <>
      <Toolbar className="mb-2">
        {JOURNAL_FILTERS.map((f) => (
          <Chip key={f.id} active={f.id === filter} onClick={() => setFilter(f.id)}>
            {f.label}
          </Chip>
        ))}
      </Toolbar>
      <Panel flush>
        <Grid head cols="180px 150px 190px 1fr">
          <span>Коли</span>
          <span>Хто</span>
          <span>Що зробив</span>
          <span>Деталі</span>
        </Grid>
        {query.isError ? (
          <p className="px-4 py-8 text-center text-[13px] text-danger">{(query.error as Error).message}</p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-faint">
            {query.isLoading ? 'Завантажую…' : 'Записів немає.'}
          </p>
        ) : (
          rows.map((a, i) => (
            <Grid key={`${a.at}-${i}`} cols="180px 150px 190px 1fr">
              <Mono className="text-muted">{fmt(a.at)}</Mono>
              <span className="min-w-0">
                <span className="block truncate text-[12.5px]">{whoOf(a)}</span>
                {a.actor.authSource && <span className="block text-[11.5px] text-faint">{a.actor.authSource}</span>}
              </span>
              <span>
                <Badge tone={actionTone(a.action, a.result)}>{actionLabel(a.action)}</Badge>
              </span>
              <span className="truncate text-[12.5px] text-muted" title={a.target}>
                {a.target && <Mono>{a.target}</Mono>} {detailOf(a)}
              </span>
            </Grid>
          ))
        )}
      </Panel>
      <Note className="mt-3">
        <Term k="audit">Журнал</Term> доповнюється, але не редагується. Відмови в доступі записуються так
        само, як успішні дії. Показано останні 100 записів.
      </Note>
    </>
  );
}
