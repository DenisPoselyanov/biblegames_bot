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
  EmptyState,
  KeyVal,
  Mono,
  Page,
  Panel,
  Status,
} from '../ui/kit';
import { cn } from '../../ui/cn';

const DIFF_CLASS: Record<DiffField['kind'], string> = {
  added: 'studio-diff-added',
  changed: 'studio-diff-changed',
  removed: 'studio-diff-removed',
  unchanged: '',
};

const CHECK_KIND_LABEL = {
  deterministic: 'детермінований',
  ai: 'AI-підказка',
  human: 'людина',
} as const;

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
            body="Можливо, її вже опубліковано або замінено новішою ревізією."
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
  const scripture = SCRIPTURE_CHECKS.filter((s) => draft.scriptureIds.includes(s.id));

  const approveDenied = !can('review.approve')
    ? `Роль «${ROLE_LABEL[role]}» не схвалює контент`
    : blocking.length > 0
      ? `Заблоковано: ${blocking.length} ${plural(blocking.length, 'перевірка не пройдена', 'перевірки не пройдені', 'перевірок не пройдено')}`
      : null;

  const publishDenied = !can('content.publish')
    ? `Роль «${ROLE_LABEL[role]}» не публікує контент`
    : draft.status !== 'approved'
      ? 'Публікується лише схвалена позиція'
      : null;

  return (
    <Page
      wide
      title={draft.title}
      subtitle={
        <span className="flex items-center gap-2">
          <Mono>{draft.id}</Mono>
          <span>·</span>
          <span>{draft.topicPath}</span>
          <span>·</span>
          <span>ревізія {draft.revision}</span>
        </span>
      }
      actions={
        <>
          <Link to="../review">
            <Button variant="quiet">
              <ArrowLeft size={14} />
              До черги
            </Button>
          </Link>
          <Button
            variant="ghost"
            denied={can('draft.repair') ? null : 'Потрібне право draft.repair'}
          >
            <Wrench size={14} />
            Запустити ремонт
          </Button>
          <Button
            variant="ghost"
            denied={can('review.comment') ? null : 'Потрібне право review.comment'}
          >
            <CornerUpLeft size={14} />
            Повернути на доопрацювання
          </Button>
          <Button variant="primary" denied={approveDenied}>
            <Check size={14} />
            Схвалити
          </Button>
          <Button variant="ghost" denied={publishDenied}>
            <Rocket size={14} />
            Опублікувати
          </Button>
        </>
      }
    >
      <div className="mb-4 flex items-center gap-2">
        <Status value={draft.status} />
        {blocking.length > 0 && (
          <Badge tone="danger">
            Публікацію заблоковано · {blocking.length}
          </Badge>
        )}
        <Badge>{draft.provider} / {draft.model}</Badge>
        {draft.jobId && (
          <Link to={`../jobs/${draft.jobId}`}>
            <Badge tone="info">джоб {draft.jobId} →</Badge>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-[1fr_380px] items-start gap-4">
        {/* Content + diff --------------------------------------------------- */}
        <div className="flex flex-col gap-4">
          {draft.question && (
            <Panel
              title="Як це побачить гравець"
              subtitle="Рендер тим самим компонентом, що й у застосунку"
            >
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
                          ? 'border-[color-mix(in_srgb,var(--p-success)_45%,transparent)] bg-[color-mix(in_srgb,var(--p-success)_12%,transparent)]'
                          : 'border-line bg-[var(--s-panel-2)]',
                      )}
                    >
                      <span
                        className={cn(
                          'grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[11px] font-bold',
                          correct
                            ? 'border-success text-success'
                            : 'border-line-strong text-faint',
                        )}
                      >
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="flex-1">{option}</span>
                      {correct && <Badge tone="success">correctIndex {i}</Badge>}
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

          <Panel
            title="Зміни щодо опублікованої ревізії"
            subtitle={`Ревізія ${Math.max(draft.revision - 1, 0)} → ${draft.revision}`}
            flush
          >
            <div className="grid grid-cols-[132px_1fr_1fr] border-b border-line bg-[var(--s-panel)] px-4 py-2 text-[11px] font-semibold tracking-[0.04em] text-faint uppercase">
              <span>Поле</span>
              <span>Було</span>
              <span>Стало</span>
            </div>
            {draft.diff.map((row) => (
              <div
                key={row.field}
                className="grid grid-cols-[132px_1fr_1fr] gap-3 border-b border-line px-4 py-2.5 last:border-b-0"
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
                  className={cn(
                    'rounded-[6px] px-2 py-1 text-[13px] leading-relaxed',
                    DIFF_CLASS[row.kind],
                  )}
                >
                  {row.after}
                </span>
              </div>
            ))}
          </Panel>
        </div>

        {/* Rail ------------------------------------------------------------- */}
        <div className="flex flex-col gap-4">
          <Panel title="Перевірки" subtitle="Детерміновані гейти йдуть першими" flush>
            {draft.checks.map((check) => (
              <div key={check.id} className="border-b border-line px-4 py-2.5 last:border-b-0">
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-[13px] font-medium">{check.label}</span>
                  <Status value={check.severity} />
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-faint">{check.detail}</p>
                <Mono className="mt-1 block">{CHECK_KIND_LABEL[check.kind]}</Mono>
              </div>
            ))}
          </Panel>

          <Panel
            title="Писання"
            subtitle={scripture.length ? 'Evidence зберігається з ревізією' : undefined}
            flush
          >
            {scripture.length === 0 && (
              <p className="px-4 py-6 text-center text-[12.5px] text-faint">
                Позиція не посилається на Писання.
              </p>
            )}
            {scripture.map((s) => (
              <div key={s.id} className="border-b border-line px-4 py-3 last:border-b-0">
                <div className="flex items-center gap-2">
                  <span className="flex-1 font-display text-[14px] font-semibold">
                    {s.reference}
                  </span>
                  <Status value={s.verdict} />
                </div>
                <Mono className="mt-0.5 block">
                  {s.normalized} · {s.translation}
                </Mono>
                <p className="mt-2 text-[11px] font-semibold tracking-[0.04em] text-faint uppercase">
                  У чернетці
                </p>
                <p className="font-display text-[13.5px] leading-relaxed text-muted italic">
                  «{s.quoted}»
                </p>
                <p className="mt-2 text-[11px] font-semibold tracking-[0.04em] text-faint uppercase">
                  У джерелі
                </p>
                <p
                  className={cn(
                    'font-display text-[13.5px] leading-relaxed italic',
                    s.source ? 'text-muted' : 'text-danger',
                  )}
                >
                  {s.source ? `«${s.source}»` : 'вірша не існує'}
                </p>
                <p className="mt-2 text-[12.5px] leading-relaxed text-faint">{s.note}</p>
              </div>
            ))}
          </Panel>

          <Panel title="Коментарі ревʼю" flush>
            {draft.comments.length === 0 && (
              <p className="px-4 py-6 text-center text-[12.5px] text-faint">
                Коментарів ще немає.
              </p>
            )}
            {draft.comments.map((c) => (
              <div key={c.id} className="border-b border-line px-4 py-3 last:border-b-0">
                <div className="flex items-center gap-2">
                  <Avatar initials={c.author.slice(0, 2)} />
                  <span className="text-[12.5px] font-semibold">{c.author}</span>
                  <Badge>{ROLE_LABEL[c.role]}</Badge>
                  <Mono className="ml-auto">{c.at.slice(11)}</Mono>
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{c.body}</p>
              </div>
            ))}
            <div className="p-3">
              <textarea
                rows={2}
                placeholder="Коментар до ревізії…"
                className="w-full resize-none rounded-[var(--s-radius-sm)] border border-line-strong bg-[var(--s-panel-2)] px-3 py-2 text-[13px]"
              />
              <div className="mt-2 flex justify-end">
                <Button
                  variant="ghost"
                  denied={can('review.comment') ? null : 'Потрібне право review.comment'}
                >
                  <MessageSquare size={13} />
                  Додати коментар
                </Button>
              </div>
            </div>
          </Panel>

          <Panel title="Походження">
            <dl>
              <KeyVal k="Автор" v={draft.author} />
              <KeyVal k="Провайдер" v={`${draft.provider} / ${draft.model}`} />
              <KeyVal k="Джоб" v={draft.jobId ? <Mono>{draft.jobId}</Mono> : 'ручна правка'} />
              <KeyVal k="Створено" v={draft.createdAt} />
              <KeyVal k="Оновлено" v={draft.updatedAt} />
              <KeyVal k="Ревізія" v={`${draft.revision} (immutable)`} />
            </dl>
          </Panel>
        </div>
      </div>
    </Page>
  );
}
