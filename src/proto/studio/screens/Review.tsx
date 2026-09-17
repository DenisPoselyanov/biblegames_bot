import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, CornerUpLeft, Inbox } from 'lucide-react';
import { DRAFTS, ROLE_LABEL, SCRIPTURE_CHECKS } from '../lib/mock';
import { plural } from '../lib/plural';
import { useCan, useStudio } from '../lib/useStudio';
import type { Check as CheckType, Draft, ScriptureCheck } from '../lib/types';
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
  Tabs,
  Term,
  Toolbar,
} from '../ui/kit';
import { cn } from '../../ui/cn';

/** One line that says why this row needs a human, in plain words. */
function problemOf(draft: Draft): { text: string; tone: 'bad' | 'warn' | 'ok' } {
  const fail = draft.checks.find((c) => c.severity === 'fail');
  if (fail) return { text: fail.detail, tone: 'bad' };
  const warn = draft.checks.find((c) => c.severity === 'warn');
  if (warn) return { text: warn.detail, tone: 'warn' };
  return { text: 'Усі перевірки пройдено — потрібне рішення людини', tone: 'ok' };
}

function IssueList({ checks }: { checks: CheckType[] }) {
  const notable = checks.filter((c) => c.severity !== 'pass');
  if (notable.length === 0) {
    return (
      <p className="text-[12.5px] text-success">Усі {checks.length} перевірки пройдено.</p>
    );
  }
  return (
    <ul className="grid gap-2">
      {notable.map((c) => (
        <li key={c.id} className="flex gap-2.5">
          <span className="mt-1.5">
            <Status value={c.severity} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-medium">{c.label}</span>
            <span className="block text-[12.5px] leading-relaxed text-faint">{c.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

const QUEUE_FILTERS = [
  { id: 'wait', label: 'Чекають', match: (d: Draft) => d.status === 'ready_for_review' },
  { id: 'broken', label: 'З помилками', match: (d: Draft) => d.status === 'validation_failed' },
  { id: 'rework', label: 'На доопрацюванні', match: (d: Draft) => d.status === 'changes_requested' },
  { id: 'all', label: 'Усі', match: () => true },
];

export function Review() {
  const navigate = useNavigate();
  const { role } = useStudio();
  const can = useCan();

  const [tab, setTab] = useState<'queue' | 'scripture'>('queue');
  const [filter, setFilter] = useState('wait');
  const [openDraft, setOpenDraft] = useState<Draft | null>(null);
  const [openVerse, setOpenVerse] = useState<ScriptureCheck | null>(null);

  const active = QUEUE_FILTERS.find((f) => f.id === filter) ?? QUEUE_FILTERS[0];
  const rows = useMemo(() => DRAFTS.filter(active.match), [active]);
  const verses = SCRIPTURE_CHECKS.filter((s) => s.verdict !== 'match');

  const approveDenied = (draft: Draft | null) =>
    !draft
      ? 'Нічого не вибрано'
      : !can('review.approve')
        ? `Роль «${ROLE_LABEL[role]}» не схвалює контент`
        : draft.checks.some((c) => c.severity === 'fail')
          ? 'Спершу треба усунути помилку перевірки'
          : null;

  return (
    <Page
      wide
      title="Черга"
      actions={
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'queue', label: 'Контент', count: DRAFTS.length },
            { value: 'scripture', label: 'Писання', count: verses.length },
          ]}
        />
      }
    >
      {tab === 'queue' ? (
        <>
          <Toolbar className="mb-3">
            {QUEUE_FILTERS.map((f) => (
              <Chip
                key={f.id}
                active={f.id === filter}
                onClick={() => setFilter(f.id)}
                count={DRAFTS.filter(f.match).length}
              >
                {f.label}
              </Chip>
            ))}
          </Toolbar>

          <Panel flush>
            <Grid head cols="1fr 1fr 150px">
              <span>Позиція</span>
              <span>Що з нею</span>
              <span>Стан</span>
            </Grid>
            {rows.map((d) => {
              const problem = problemOf(d);
              return (
                <Grid key={d.id} cols="1fr 1fr 150px" onClick={() => setOpenDraft(d)}>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{d.title}</span>
                    <span className="block truncate text-[12px] text-faint">{d.topicPath}</span>
                  </span>
                  <span
                    className={cn(
                      'truncate text-[12.5px]',
                      problem.tone === 'bad'
                        ? 'text-danger'
                        : problem.tone === 'warn'
                          ? 'text-gold-ink'
                          : 'text-faint',
                    )}
                  >
                    {problem.text}
                  </span>
                  <Status value={d.status} />
                </Grid>
              );
            })}
            {rows.length === 0 && (
              <EmptyState
                icon={<Inbox size={18} />}
                title="Тут порожньо"
                body="За цим фільтром нічого немає. Після схвалення позиція йде у випуск і зникає з черги — це нормально."
                action={
                  <Button variant="ghost" onClick={() => setFilter('all')}>
                    Показати всі
                  </Button>
                }
              />
            )}
          </Panel>
        </>
      ) : (
        <>
          <Note className="mb-3">
            Перевірка звіряє цитату з посиланням і нічого більше: контекст і
            тлумачення лишаються за людиною. Збіги сюди не потрапляють — лише те,
            що потребує рішення.
          </Note>
          <Panel flush>
            <Grid head cols="140px 1fr 150px">
              <span>Посилання</span>
              <span>Цитата в чернетці</span>
              <span>Результат</span>
            </Grid>
            {verses.map((s) => (
              <Grid key={s.id} cols="140px 1fr 150px" onClick={() => setOpenVerse(s)}>
                <span className="font-display font-semibold">{s.reference}</span>
                <span className="truncate text-[12.5px] text-muted italic">«{s.quoted}»</span>
                <Status value={s.verdict} />
              </Grid>
            ))}
          </Panel>
        </>
      )}

      {/* Level two: enough to decide without leaving the list ---------------- */}
      <Drawer
        open={Boolean(openDraft)}
        onClose={() => setOpenDraft(null)}
        title={openDraft?.title ?? ''}
        subtitle={openDraft?.topicPath}
        status={openDraft && <Status value={openDraft.status} />}
        footer={
          openDraft && (
            <>
              <Button variant="primary" denied={approveDenied(openDraft)}>
                <Check size={13} />
                Схвалити
              </Button>
              <Button
                variant="ghost"
                denied={can('review.comment') ? null : 'Потрібне право коментувати'}
              >
                <CornerUpLeft size={13} />
                Повернути
              </Button>
              <Button
                variant="quiet"
                className="ml-auto"
                onClick={() => navigate(openDraft.id)}
              >
                Відкрити повністю
                <ArrowRight size={13} />
              </Button>
            </>
          )
        }
      >
        {openDraft?.question && (
          <div className="mb-4">
            <p className="font-display text-[15px] leading-snug font-semibold">
              {openDraft.question.prompt}
            </p>
            <ul className="mt-2.5 grid gap-1.5">
              {openDraft.question.options.map((option, i) => {
                const correct = i === openDraft.question!.correctIndex;
                return (
                  <li
                    key={option}
                    className={cn(
                      'flex items-center gap-2 rounded-[var(--s-radius-sm)] border px-2.5 py-1.5 text-[13px]',
                      correct
                        ? 'border-[color-mix(in_srgb,var(--p-success)_45%,transparent)] bg-[color-mix(in_srgb,var(--p-success)_10%,transparent)]'
                        : 'border-line',
                    )}
                  >
                    <span className="w-4 shrink-0 text-[11px] font-bold text-faint">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="flex-1">{option}</span>
                    {correct && <Badge tone="success">правильна</Badge>}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <p className="mb-2 flex items-center gap-1.5 text-[11.5px] font-semibold tracking-[0.02em] text-faint uppercase">
          <Term k="check">Перевірки</Term>
        </p>
        {openDraft && <IssueList checks={openDraft.checks} />}

        {openDraft && (
          <p className="mt-4 border-t border-line pt-3 text-[12px] text-faint">
            Створено {openDraft.createdAt} · <Term k="revision">ревізія</Term>{' '}
            {openDraft.revision} ·{' '}
            <Mono className="text-muted">
              {openDraft.provider}/{openDraft.model}
            </Mono>
          </p>
        )}
      </Drawer>

      <Drawer
        open={Boolean(openVerse)}
        onClose={() => setOpenVerse(null)}
        title={openVerse?.reference ?? ''}
        subtitle={openVerse ? `${openVerse.normalized} · ${openVerse.translation}` : undefined}
        status={openVerse && <Status value={openVerse.verdict} />}
        footer={
          openVerse?.draftId && (
            <Button variant="quiet" onClick={() => navigate(openVerse.draftId!)}>
              Відкрити чернетку
              <ArrowRight size={13} />
            </Button>
          )
        }
      >
        <p className="text-[11.5px] font-semibold tracking-[0.02em] text-faint uppercase">
          У чернетці
        </p>
        <blockquote className="mt-1 rounded-[var(--s-radius-sm)] border border-line bg-[var(--s-panel-2)] p-3 font-display text-[14px] leading-relaxed italic">
          «{openVerse?.quoted}»
        </blockquote>

        <p className="mt-3 text-[11.5px] font-semibold tracking-[0.02em] text-faint uppercase">
          У перекладі
        </p>
        <blockquote
          className={cn(
            'mt-1 rounded-[var(--s-radius-sm)] border p-3 font-display text-[14px] leading-relaxed italic',
            openVerse?.source
              ? 'border-line bg-[var(--s-panel-2)]'
              : 'border-[color-mix(in_srgb,var(--p-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--p-danger)_10%,transparent)] text-danger',
          )}
        >
          {openVerse?.source ?? 'Такого вірша немає в жодному з підключених джерел.'}
        </blockquote>

        <p className="mt-3 text-[12.5px] leading-relaxed text-muted">{openVerse?.note}</p>

        <p className="mt-4 border-t border-line pt-3 text-[12px] text-faint">
          <Term k="scriptureEvidence">Evidence</Term> збережено разом із ревізією.
        </p>
      </Drawer>

      {tab === 'queue' && rows.length > 0 && (
        <p className="mt-3 text-[12px] text-faint">
          {rows.length} {plural(rows.length, 'позиція', 'позиції', 'позицій')} · клік по рядку
          відкриває коротку картку, «Відкрити повністю» — усю історію змін.
        </p>
      )}
      <p className="mt-2 text-[12px] text-faint">
        Нічого з цієї сторінки не бачать гравці: усе тут у{' '}
        <Term k="staging">staging</Term>.{' '}
        <Link to="../guide" className="text-indigo underline underline-offset-2">
          Як влаштований шлях контенту
        </Link>
      </p>
    </Page>
  );
}
