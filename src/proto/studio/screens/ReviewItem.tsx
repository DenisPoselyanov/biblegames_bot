import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookMarked,
  Check,
  CornerUpLeft,
  FileQuestion,
  MessageSquare,
  Rocket,
  Wrench,
} from 'lucide-react';
import { DRAFTS, ROLE_LABEL, SCRIPTURE_CHECKS } from '../lib/mock';
import { plural } from '../lib/plural';
import { useCan, useStudio } from '../lib/useStudio';
import type { DiffField } from '../lib/types';
import {
  Avatar,
  Badge,
  Button,
  Disclosure,
  EmptyState,
  KeyVal,
  Mono,
  Page,
  Panel,
  Status,
  Term,
} from '../ui/kit';
import { cn } from '../../ui/cn';

const DIFF_CLASS: Record<DiffField['kind'], string> = {
  added: 'studio-diff-added',
  changed: 'studio-diff-changed',
  removed: 'studio-diff-removed',
  unchanged: '',
};

const CHECK_KIND_LABEL = {
  deterministic: 'однаковий результат щоразу',
  ai: 'підказка AI, нічого не блокує',
  human: 'рішення людини',
} as const;

/**
 * Level three. One column, in reading order: what the player will see, then
 * what the machine found, then what changed, then who said what. Everything
 * except the first block starts folded.
 */
export function ReviewItem() {
  const { draftId } = useParams();
  const { role } = useStudio();
  const can = useCan();
  const draft = DRAFTS.find((d) => d.id === draftId);

  if (!draft) {
    return (
      <Page title="Позицію не знайдено">
        <Panel>
          <EmptyState
            icon={<FileQuestion size={18} />}
            title="Такої чернетки немає"
            body="Можливо, її вже опубліковано або замінено новішою версією."
            action={
              <Link to="../review">
                <Button variant="ghost">← До черги</Button>
              </Link>
            }
          />
        </Panel>
      </Page>
    );
  }

  const blocking = draft.checks.filter((c) => c.severity === 'fail');
  const warnings = draft.checks.filter((c) => c.severity === 'warn');
  const passed = draft.checks.filter((c) => c.severity === 'pass');
  const scripture = SCRIPTURE_CHECKS.filter((s) => draft.scriptureIds.includes(s.id));
  const scriptureProblem = scripture.some((s) => s.verdict !== 'match');

  const approveDenied = !can('review.approve')
    ? `Роль «${ROLE_LABEL[role]}» не схвалює контент`
    : blocking.length > 0
      ? `Спершу треба усунути ${blocking.length} ${plural(blocking.length, 'помилку', 'помилки', 'помилок')} перевірки`
      : null;

  const publishDenied = !can('content.publish')
    ? `Роль «${ROLE_LABEL[role]}» не публікує контент`
    : draft.status !== 'approved'
      ? 'Публікується лише схвалена позиція'
      : null;

  return (
    <Page
      title={draft.title}
      subtitle={draft.topicPath}
      actions={
        <Link to="../review">
          <Button variant="quiet">
            <ArrowLeft size={14} />
            До черги
          </Button>
        </Link>
      }
    >
      {/* Status line ------------------------------------------------------- */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Status value={draft.status} />
        <Badge>
          <Term k="revision" align="start">
            ревізія {draft.revision}
          </Term>
        </Badge>
        {draft.jobId && (
          <Link to={`../jobs/${draft.jobId}`}>
            <Badge tone="info">створено запуском {draft.jobId} →</Badge>
          </Link>
        )}
      </div>

      {/* 1 · what the player sees ------------------------------------------- */}
      {draft.question && (
        <Panel className="mb-3" title="Як це побачить гравець">
          <p className="font-display text-[17px] leading-snug font-semibold">
            {draft.question.prompt}
          </p>
          <ul className="mt-3 grid gap-2">
            {draft.question.options.map((option, i) => {
              const correct = i === draft.question!.correctIndex;
              return (
                <li
                  key={option}
                  className={cn(
                    'flex items-center gap-2.5 rounded-[var(--s-radius-sm)] border px-3 py-2 text-[13.5px]',
                    correct
                      ? 'border-[color-mix(in_srgb,var(--p-success)_45%,transparent)] bg-[color-mix(in_srgb,var(--p-success)_10%,transparent)]'
                      : 'border-line bg-[var(--s-panel-2)]',
                  )}
                >
                  <span
                    className={cn(
                      'grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[11px] font-bold',
                      correct ? 'border-success text-success' : 'border-line-strong text-faint',
                    )}
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="flex-1">{option}</span>
                  {correct && <Badge tone="success">правильна відповідь</Badge>}
                </li>
              );
            })}
          </ul>
          <div className="mt-3 rounded-[var(--s-radius-sm)] border border-line bg-[var(--s-panel-2)] p-3">
            <p className="text-[12px] font-semibold tracking-[0.02em] text-faint uppercase">
              Пояснення
            </p>
            <p className="mt-1 text-[13.5px] leading-relaxed text-muted">
              {draft.question.explanation}
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-gold-ink">
              <BookMarked size={13} />
              {draft.question.reference}
            </p>
          </div>
        </Panel>
      )}

      {/* 2 · what the machine found ----------------------------------------- */}
      <Disclosure
        className="mb-3"
        defaultOpen={blocking.length > 0 || warnings.length > 0}
        label="Перевірки"
        help={<Term k="check" align="end" iconOnly />}
        hint={
          <span className="studio-num">
            <span className="text-success">{passed.length} гаразд</span>
            {warnings.length > 0 && <span className="text-gold-ink"> · {warnings.length} увага</span>}
            {blocking.length > 0 && <span className="text-danger"> · {blocking.length} помилка</span>}
          </span>
        }
      >
        {draft.checks.map((check) => (
          <div
            key={check.id}
            className="flex gap-3 border-b border-line px-4 py-2.5 last:border-b-0"
          >
            <span className="mt-0.5 w-[92px] shrink-0">
              <Status value={check.severity} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium">{check.label}</span>
              <span className="block text-[12.5px] leading-relaxed text-faint">{check.detail}</span>
            </span>
            <span className="max-w-[160px] shrink-0 text-right text-[11.5px] text-faint">
              {CHECK_KIND_LABEL[check.kind]}
            </span>
          </div>
        ))}
      </Disclosure>

      {/* 3 · Scripture ------------------------------------------------------- */}
      {scripture.length > 0 && (
        <Disclosure
          className="mb-3"
          defaultOpen={scriptureProblem}
          label="Перевірка Писання"
          hint={scripture.map((s) => s.reference).join(' · ')}
        >
          {scripture.map((s) => (
            <div key={s.id} className="border-b border-line px-4 py-3 last:border-b-0">
              <div className="mb-2 flex items-center gap-2">
                <span className="font-display text-[14px] font-semibold">{s.reference}</span>
                <Status value={s.verdict} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11.5px] font-semibold text-faint uppercase">У чернетці</p>
                  <p className="mt-1 font-display text-[13.5px] leading-relaxed text-muted italic">
                    «{s.quoted}»
                  </p>
                </div>
                <div>
                  <p className="text-[11.5px] font-semibold text-faint uppercase">У перекладі</p>
                  <p
                    className={cn(
                      'mt-1 font-display text-[13.5px] leading-relaxed italic',
                      s.source ? 'text-muted' : 'text-danger',
                    )}
                  >
                    {s.source ? `«${s.source}»` : 'вірша не існує'}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-faint">{s.note}</p>
            </div>
          ))}
        </Disclosure>
      )}

      {/* 4 · what changed ---------------------------------------------------- */}
      <Disclosure
        className="mb-3"
        label="Що змінилось"
        hint={`${draft.diff.length} ${plural(draft.diff.length, 'поле', 'поля', 'полів')}`}
      >
        <div className="grid grid-cols-[120px_1fr_1fr] border-b border-line px-4 py-2 text-[11px] font-semibold tracking-[0.04em] text-faint uppercase">
          <span>Поле</span>
          <span>Було</span>
          <span>Стало</span>
        </div>
        {draft.diff.map((row) => (
          <div
            key={row.field}
            className="grid grid-cols-[120px_1fr_1fr] gap-3 border-b border-line px-4 py-2.5 last:border-b-0"
          >
            <Mono className="pt-0.5">{row.field}</Mono>
            <span
              className={cn(
                'rounded-[6px] px-2 py-1 text-[13px] leading-relaxed',
                row.before === null ? 'text-faint italic' : 'text-muted',
                row.kind === 'removed' && DIFF_CLASS.removed,
              )}
            >
              {row.before ?? '— поля не було —'}
            </span>
            <span
              className={cn('rounded-[6px] px-2 py-1 text-[13px] leading-relaxed', DIFF_CLASS[row.kind])}
            >
              {row.after}
            </span>
          </div>
        ))}
      </Disclosure>

      {/* 5 · people ---------------------------------------------------------- */}
      <Panel className="mb-3" title="Обговорення" flush>
        {draft.comments.length === 0 && (
          <p className="px-4 py-5 text-center text-[12.5px] text-faint">Коментарів ще немає.</p>
        )}
        {draft.comments.map((c) => (
          <div key={c.id} className="border-b border-line px-4 py-3 last:border-b-0">
            <div className="flex items-center gap-2">
              <Avatar initials={c.author.slice(0, 2)} />
              <span className="text-[12.5px] font-semibold">{c.author}</span>
              <Badge>{ROLE_LABEL[c.role]}</Badge>
              <Mono className="ml-auto">{c.at}</Mono>
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{c.body}</p>
          </div>
        ))}
        <div className="p-3">
          <textarea
            rows={2}
            placeholder="Коментар до цієї версії…"
            className="w-full resize-none rounded-[var(--s-radius-sm)] border border-line-strong bg-[var(--s-panel-2)] px-3 py-2 text-[13px]"
          />
          <div className="mt-2 flex justify-end">
            <Button
              variant="ghost"
              denied={can('review.comment') ? null : 'Потрібне право коментувати'}
            >
              <MessageSquare size={13} />
              Додати
            </Button>
          </div>
        </div>
      </Panel>

      <Disclosure label="Звідки ця позиція" className="mb-4">
        <dl className="px-4 py-2">
          <KeyVal k="Автор" v={draft.author} />
          <KeyVal k={<Term k="provider">Провайдер</Term>} v={`${draft.provider} / ${draft.model}`} />
          <KeyVal k="Створено" v={draft.createdAt} />
          <KeyVal k="Оновлено" v={draft.updatedAt} />
          <KeyVal
            k={<Term k="revision">Ревізія</Term>}
            v={`${draft.revision} — попередні збережено`}
          />
        </dl>
      </Disclosure>

      {/* Decision bar — always last, never above the thing being decided. Until
          the page is centred with room to spare, its right end runs under the
          assistant dock in the corner, so it keeps that corner clear. */}
      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-2 border-t border-line bg-[var(--s-chrome)] px-4 py-3 @min-[900px]:-mx-6 @min-[900px]:px-6 @max-[1150px]:pr-16">
        <Button variant="primary" size="md" denied={approveDenied}>
          <Check size={14} />
          Схвалити
        </Button>
        <Button
          variant="ghost"
          size="md"
          denied={can('review.comment') ? null : 'Потрібне право коментувати'}
        >
          <CornerUpLeft size={14} />
          Повернути на доопрацювання
        </Button>
        <Button
          variant="ghost"
          size="md"
          denied={can('draft.repair') ? null : 'Потрібне право виправляти'}
        >
          <Wrench size={14} />
          Виправити через AI
        </Button>
        <Button variant="ghost" size="md" className="ml-auto" denied={publishDenied}>
          <Rocket size={14} />
          Опублікувати
        </Button>
      </div>
    </Page>
  );
}
