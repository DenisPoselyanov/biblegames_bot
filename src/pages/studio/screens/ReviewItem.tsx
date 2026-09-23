import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BookMarked, Check, CornerUpLeft, FileQuestion, Rocket, X } from 'lucide-react';
import {
  useApproveMutation,
  usePublishMutation,
  useRequestChangesMutation,
  useReviewDetailQuery,
  useScriptureDecisionMutation,
} from '../lib/queries';
import { plural } from '../lib/plural';
import { useCan } from '../lib/useStudio';
import type {
  LessonRevision,
  QuestionRevision,
  ReviewDetail,
  ReviewRevisionType,
  ScriptureEvidence,
  StudioActivityEntry,
} from '../../../repos/studioRepo';
import {
  Badge,
  Button,
  Disclosure,
  EmptyState,
  KeyVal,
  Mono,
  Note,
  Page,
  Panel,
  Status,
  Term,
  Textarea,
} from '../ui/kit';
import { cn } from '../ui/cn';

const FIELD_LABEL: Record<string, string> = {
  text: 'Питання',
  options: 'Варіанти',
  correctIndex: 'Правильна',
  explanationShort: 'Пояснення',
  explanationDeep: 'Детально',
  reference: 'Посилання',
  scriptureRefs: 'Писання',
  tags: 'Теги',
  themeId: 'Тема',
  difficulty: 'Складність',
  topicNodeId: 'Вузол теми',
  topicPath: 'Шлях теми',
  title: 'Назва',
  description: 'Опис',
  blocks: 'Блоки',
  planId: 'План',
  moduleId: 'Модуль',
  objectiveId: 'Ціль',
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value) && value.every((v) => typeof v === 'string')) return value.join(' · ');
  return JSON.stringify(value, null, 1);
}

const ACTION_LABEL: Record<string, string> = {
  'content.review_decision': 'Рішення',
  'content.publish': 'Опубліковано',
  'content.publish_denied': 'Публікацію відхилено',
};

function historyLine(entry: StudioActivityEntry): { title: string; body: string | null; tone: 'ok' | 'bad' } {
  const meta = entry.metadata ?? {};
  if (entry.action === 'content.review_decision') {
    const decision = meta.decision;
    const title =
      entry.result !== 'ok'
        ? 'Спроба схвалити — відхилено через блокери'
        : decision === 'approved'
          ? 'Схвалено'
          : decision === 'changes_requested'
            ? 'Повернуто на доопрацювання'
            : 'Рішення';
    return {
      title,
      body: typeof meta.comment === 'string' ? meta.comment : null,
      tone: entry.result === 'ok' ? 'ok' : 'bad',
    };
  }
  if (entry.action === 'content.publish_denied') {
    return {
      title: 'Публікацію відхилено',
      body: meta.reason === 'not_approved' ? 'Ревізію ще не схвалено' : 'Є незакриті блокери',
      tone: 'bad',
    };
  }
  return { title: ACTION_LABEL[entry.action] ?? entry.action, body: null, tone: 'ok' };
}

/* ------------------------------------------------------------ previews */

function QuestionPreview({ q }: { q: QuestionRevision }) {
  return (
    <Panel className="mb-3" title="Як це побачить гравець">
      <p className="font-display text-[17px] leading-snug font-semibold">{q.text}</p>
      <ul className="mt-3 grid gap-2">
        {q.options.map((option, i) => {
          const correct = i === q.correctIndex;
          return (
            <li
              key={`${i}-${option}`}
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
      {(q.explanationShort || q.reference) && (
        <div className="mt-3 rounded-[var(--s-radius-sm)] border border-line bg-[var(--s-panel-2)] p-3">
          {q.explanationShort && (
            <>
              <p className="text-[12px] font-semibold tracking-[0.02em] text-faint uppercase">Пояснення</p>
              <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{q.explanationShort}</p>
            </>
          )}
          {q.reference && (
            <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-gold-ink">
              <BookMarked size={13} />
              {q.reference}
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}

/** Block text as authored — a structural preview, not the Learn-hub renderer (that lives in the player bundle). */
function blockText(payload: Record<string, unknown>): string {
  for (const key of ['text', 'title', 'body', 'prompt', 'summary', 'reference']) {
    const v = payload[key];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return JSON.stringify(payload);
}

function LessonPreview({ l }: { l: LessonRevision }) {
  return (
    <Panel className="mb-3" title="Як це побачить гравець" subtitle="Структура уроку, блок за блоком">
      <p className="font-display text-[17px] leading-snug font-semibold">{l.title}</p>
      {l.description && <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{l.description}</p>}
      {l.blocks.length === 0 ? (
        <p className="mt-3 text-[12.5px] text-danger">У цьому уроці немає жодного блоку.</p>
      ) : (
        <ol className="mt-3 grid gap-2">
          {l.blocks.map((b) => (
            <li key={b.id} className="rounded-[var(--s-radius-sm)] border border-line bg-[var(--s-panel-2)] px-3 py-2">
              <Mono className="text-faint">{b.blockType}</Mono>
              <p className="mt-0.5 line-clamp-3 text-[13px] leading-relaxed">{blockText(b.payload)}</p>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------ scripture */

function ScriptureRow({ e, canDecide }: { e: ScriptureEvidence; canDecide: boolean }) {
  const decide = useScriptureDecisionMutation();
  return (
    <div className="border-b border-line px-4 py-3 last:border-b-0">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-display text-[14px] font-semibold">{e.rawReference}</span>
        <Status value={e.verdict} />
        <Mono className="text-faint">{e.translation}</Mono>
        {e.reviewerDecision && (
          <Badge tone={e.reviewerDecision === 'accepted' ? 'success' : 'danger'}>
            рецензент: {e.reviewerDecision === 'accepted' ? 'прийнято' : 'відхилено'}
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[11.5px] font-semibold text-faint uppercase">У чернетці</p>
          <p className="mt-1 font-display text-[13.5px] leading-relaxed text-muted italic">
            {e.quotedText ? `«${e.quotedText}»` : 'лише посилання, без цитати'}
          </p>
        </div>
        <div>
          <p className="text-[11.5px] font-semibold text-faint uppercase">У перекладі</p>
          <p
            className={cn(
              'mt-1 font-display text-[13.5px] leading-relaxed italic',
              e.sourceText ? 'text-muted' : 'text-danger',
            )}
          >
            {e.sourceText ? `«${e.sourceText}»` : 'вірша не знайдено в джерелі'}
          </p>
        </div>
      </div>
      {e.verdict === 'paraphrase' && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span className="text-[12.5px] text-faint">
            <Term k="paraphrase">Переказ</Term> блокує публікацію, доки людина його не прийме.
          </span>
          <Button
            variant="ghost"
            className="ml-auto"
            denied={!canDecide ? 'Потрібне право рецензувати' : decide.isPending ? 'Зберігаю…' : null}
            onClick={() => decide.mutate({ evidenceId: e.id, decision: 'accepted' })}
          >
            <Check size={13} />
            Прийняти переказ
          </Button>
          <Button
            variant="ghost"
            denied={!canDecide ? 'Потрібне право рецензувати' : decide.isPending ? 'Зберігаю…' : null}
            onClick={() => decide.mutate({ evidenceId: e.id, decision: 'rejected' })}
          >
            <X size={13} />
            Відхилити
          </Button>
        </div>
      )}
      {decide.isError && <p className="mt-2 text-[12.5px] text-danger">{(decide.error as Error).message}</p>}
    </div>
  );
}

/* ------------------------------------------------------------ screen */

function ReviewBody({ type, detail }: { type: ReviewRevisionType; detail: ReviewDetail }) {
  const can = useCan();
  const approve = useApproveMutation();
  const requestChanges = useRequestChangesMutation();
  const publish = usePublishMutation();
  const [comment, setComment] = useState('');
  const [confirming, setConfirming] = useState(false);

  const { item, findings, scripture, history, blockers } = detail;
  // A first revision diffs against nothing, so every field "changed" — hide the empty ones.
  const diff = detail.baseline ? detail.diff : detail.diff.filter((row) => formatValue(row.after) !== '');
  const revisionId = item.revisionId;
  const blocking = findings.filter((f) => f.severity === 'blocking');
  const warnings = findings.filter((f) => f.severity === 'warning');
  const infos = findings.filter((f) => f.severity === 'info');
  const scriptureProblem = scripture.some((s) => s.verdict !== 'match');
  const reviewable = ['legacy_unreviewed', 'draft', 'ready_for_review'].includes(item.status);
  const approved = item.decision?.decision === 'approved';
  const busy = approve.isPending || requestChanges.isPending || publish.isPending;
  const lastError = [approve, requestChanges, publish].find((m) => m.isError)?.error as Error | undefined;

  const approveDenied = !can('content:approve')
    ? 'Ваша роль не схвалює контент'
    : !reviewable
      ? 'Цю ревізію вже не рецензують'
      : blockers.length > 0
        ? `Спершу треба усунути ${blockers.length} ${plural(blockers.length, 'блокер', 'блокери', 'блокерів')}`
        : approved
          ? 'Вже схвалено'
          : null;
  const changesDenied = !can('content:review')
    ? 'Потрібне право рецензувати'
    : !reviewable
      ? 'Цю ревізію вже не рецензують'
      : !comment.trim()
        ? 'Напишіть у полі нижче, що треба змінити'
        : null;
  const publishDenied = !can('content:publish')
    ? 'Ваша роль не публікує контент'
    : !reviewable
      ? 'Цю ревізію вже не публікують'
      : !approved
        ? 'Публікується лише схвалена ревізія'
        : blockers.length > 0
          ? 'Є незакриті блокери'
          : null;

  return (
    <>
      {/* Status line ----------------------------------------------------- */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Status value={item.status} />
        {item.decision && <Status value={item.decision.decision} />}
        <Badge>
          <Term k="revision" align="start">
            ревізія {item.revisionNumber}
          </Term>
        </Badge>
        <Badge>{item.source}</Badge>
        {detail.baseline ? (
          <span className="text-[12px] text-faint">
            порівнюється з ревізією {detail.baseline.revisionNumber} ({detail.baseline.status === 'published' ? 'зараз у грі' : 'попередня'})
          </span>
        ) : (
          <span className="text-[12px] text-faint">перша ревізія — порівнювати нема з чим</span>
        )}
      </div>

      {/* 1 · what the player sees ---------------------------------------- */}
      {detail.revision.revisionType === 'question' ? (
        <QuestionPreview q={detail.revision.record} />
      ) : (
        <LessonPreview l={detail.revision.record} />
      )}

      {/* 2 · what the machine found -------------------------------------- */}
      <Disclosure
        className="mb-3"
        defaultOpen={blocking.length > 0 || warnings.length > 0}
        label="Перевірки"
        help={<Term k="check" align="end" iconOnly />}
        hint={
          findings.length === 0 ? (
            'нічого не знайдено'
          ) : (
            <span className="studio-num">
              {[
                blocking.length > 0 && (
                  <span key="b" className="text-danger">
                    {blocking.length} блокує
                  </span>
                ),
                warnings.length > 0 && (
                  <span key="w" className="text-gold-ink">
                    {warnings.length} увага
                  </span>
                ),
                infos.length > 0 && <span key="i">{infos.length} довідка</span>,
              ]
                .filter(Boolean)
                .flatMap((part, i) => (i === 0 ? [part] : [<span key={`s${i}`}> · </span>, part]))}
            </span>
          )
        }
      >
        {findings.length === 0 ? (
          <p className="px-4 py-4 text-[12.5px] text-faint">
            Автоматичні перевірки для цієї ревізії нічого не записали.
          </p>
        ) : (
          findings.map((f) => (
            <div key={f.id} className="flex gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
              <span className="mt-0.5 w-[92px] shrink-0">
                <Status value={f.severity} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium">{f.label}</span>
                <span className="block text-[12.5px] leading-relaxed text-faint">{f.detail}</span>
              </span>
              <Mono className="shrink-0 text-faint">{f.kind}</Mono>
            </div>
          ))
        )}
      </Disclosure>

      {/* 3 · Scripture ---------------------------------------------------- */}
      {scripture.length > 0 && (
        <Disclosure
          className="mb-3"
          defaultOpen={scriptureProblem}
          label="Перевірка Писання"
          help={<Term k="scriptureEvidence" align="end" iconOnly />}
          hint={scripture.map((s) => s.rawReference).join(' · ')}
        >
          {scripture.map((e) => (
            <ScriptureRow key={e.id} e={e} canDecide={can('content:review')} />
          ))}
        </Disclosure>
      )}

      {/* 4 · what changed ------------------------------------------------- */}
      <Disclosure
        className="mb-3"
        defaultOpen={Boolean(detail.baseline)}
        label="Що змінилось"
        hint={`${diff.length} ${plural(diff.length, 'поле', 'поля', 'полів')}`}
      >
        {diff.length === 0 ? (
          <p className="px-4 py-4 text-[12.5px] text-faint">Відмінностей немає.</p>
        ) : (
          <>
            <div className="grid grid-cols-[120px_1fr_1fr] border-b border-line px-4 py-2 text-[11px] font-semibold tracking-[0.04em] text-faint uppercase">
              <span>Поле</span>
              <span>Було</span>
              <span>Стало</span>
            </div>
            {diff.map((row) => {
              const before = formatValue(row.before);
              const after = formatValue(row.after);
              const kind = !before ? 'added' : !after ? 'removed' : 'changed';
              return (
                <div
                  key={row.field}
                  className="grid grid-cols-[120px_1fr_1fr] gap-3 border-b border-line px-4 py-2.5 last:border-b-0"
                >
                  <span className="pt-0.5 text-[12.5px] font-medium">
                    {FIELD_LABEL[row.field] ?? row.field}
                  </span>
                  <span
                    className={cn(
                      'rounded-[6px] px-2 py-1 text-[13px] leading-relaxed break-words whitespace-pre-wrap',
                      before ? 'text-muted' : 'text-faint italic',
                      kind === 'removed' && 'studio-diff-removed',
                    )}
                  >
                    {before || '— поля не було —'}
                  </span>
                  <span
                    className={cn(
                      'rounded-[6px] px-2 py-1 text-[13px] leading-relaxed break-words whitespace-pre-wrap',
                      `studio-diff-${kind}`,
                    )}
                  >
                    {after || '— порожньо —'}
                  </span>
                </div>
              );
            })}
          </>
        )}
      </Disclosure>

      {/* 5 · people ------------------------------------------------------- */}
      <Panel className="mb-3" title={<Term k="audit">Історія рішень</Term>} flush>
        {history.length === 0 && (
          <p className="px-4 py-5 text-center text-[12.5px] text-faint">Рішень ще не було.</p>
        )}
        {history.map((entry, i) => {
          const line = historyLine(entry);
          return (
            <div key={`${entry.at}-${i}`} className="border-b border-line px-4 py-3 last:border-b-0">
              <div className="flex items-center gap-2">
                <span className={cn('text-[12.5px] font-semibold', line.tone === 'bad' && 'text-danger')}>
                  {line.title}
                </span>
                <Mono className="text-faint">{entry.actor.userId ?? 'system'}</Mono>
                <Mono className="ml-auto">{new Date(entry.at).toLocaleString('uk-UA')}</Mono>
              </div>
              {line.body && <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{line.body}</p>}
            </div>
          );
        })}
        <div className="p-3">
          <Textarea
            rows={2}
            maxLength={500}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Що треба змінити в цій ревізії…"
            aria-label="Коментар до повернення на доопрацювання"
            className="resize-none"
          />
        </div>
      </Panel>

      <Disclosure label="Звідки ця позиція" className="mb-4">
        <dl className="px-4 py-2">
          <KeyVal k="Джерело" v={<Mono>{item.source}</Mono>} />
          <KeyVal k="Автор" v={item.createdBy ?? '—'} />
          <KeyVal k="Створено" v={new Date(item.createdAt).toLocaleString('uk-UA')} />
          <KeyVal k="Ідентифікатор" v={<Mono>{item.entityId}</Mono>} />
          <KeyVal
            k={<Term k="revision">Ревізії</Term>}
            v={
              <span className="flex flex-wrap gap-1.5">
                {detail.siblings.map((s) =>
                  s.revisionId === revisionId ? (
                    <Badge key={s.revisionId} tone="info">
                      №{s.revisionNumber} (ця)
                    </Badge>
                  ) : (
                    <Link key={s.revisionId} to={`../review/${type}/${s.revisionId}`}>
                      <Badge>
                        №{s.revisionNumber} · <Status value={s.status} className="border-0 bg-transparent p-0" />
                      </Badge>
                    </Link>
                  ),
                )}
              </span>
            }
          />
        </dl>
      </Disclosure>

      {lastError && (
        <Note tone="danger" className="mb-3">
          {lastError.message}
        </Note>
      )}

      {/* Decision bar — always last, never above the thing being decided. */}
      <div className="sticky bottom-0 -mx-6 flex flex-wrap items-center gap-2 border-t border-line bg-[var(--s-chrome)] px-6 py-3">
        {confirming ? (
          <>
            <span className="text-[13px]">
              Опублікувати ревізію {item.revisionNumber}? Гравці побачать її одразу.
            </span>
            <Button
              variant="primary"
              size="md"
              denied={busy ? 'Публікую…' : publishDenied}
              onClick={() =>
                publish.mutate(
                  { type, id: revisionId, confirmRevisionId: revisionId },
                  { onSettled: () => setConfirming(false) },
                )
              }
            >
              <Rocket size={14} />
              Так, опублікувати
            </Button>
            <Button variant="quiet" size="md" onClick={() => setConfirming(false)}>
              Скасувати
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="primary"
              size="md"
              denied={busy ? 'Зберігаю…' : approveDenied}
              onClick={() => approve.mutate({ type, id: revisionId })}
            >
              <Check size={14} />
              Схвалити
            </Button>
            <Button
              variant="ghost"
              size="md"
              denied={busy ? 'Зберігаю…' : changesDenied}
              onClick={() =>
                requestChanges.mutate(
                  { type, id: revisionId, comment: comment.trim() },
                  { onSuccess: () => setComment('') },
                )
              }
            >
              <CornerUpLeft size={14} />
              Повернути на доопрацювання
            </Button>
            <Button
              variant="ghost"
              size="md"
              className="ml-auto"
              denied={busy ? 'Зберігаю…' : publishDenied}
              onClick={() => setConfirming(true)}
            >
              <Rocket size={14} />
              Опублікувати
            </Button>
          </>
        )}
      </div>
    </>
  );
}

/**
 * Level three. One column, in reading order: what the player will see, then
 * what the machine found, then what changed, then who decided what. The
 * decision bar is last so nothing is approved before it has been read.
 */
export function ReviewItem() {
  const { type, revisionId } = useParams<{ type: string; revisionId: string }>();
  const validType = type === 'question' || type === 'lesson' ? type : undefined;
  const query = useReviewDetailQuery(validType, revisionId);
  const detail = query.data?.detail ?? null;

  const back = (
    <Link to="../review">
      <Button variant="quiet">
        <ArrowLeft size={14} />
        До черги
      </Button>
    </Link>
  );

  if (query.isLoading) {
    return (
      <Page title="Ревізія" actions={back}>
        <p className="text-[13px] text-faint">Завантаження…</p>
      </Page>
    );
  }

  if (query.data && !query.data.available) {
    return (
      <Page title="Ревізія" actions={back}>
        <Note tone="danger">Ревʼю недоступне в цьому середовищі — сервер працює без бази даних.</Note>
      </Page>
    );
  }

  if (!validType || !detail) {
    return (
      <Page title="Позицію не знайдено" actions={back}>
        <Panel>
          <EmptyState
            icon={<FileQuestion size={18} />}
            title="Такої ревізії немає"
            body="Можливо, посилання застаріло. Кожна зміна — нова ревізія з новим ідентифікатором."
          />
        </Panel>
      </Page>
    );
  }

  return (
    <Page title={detail.item.title} subtitle={detail.item.context} actions={back}>
      <ReviewBody key={detail.item.revisionId} type={validType} detail={detail} />
    </Page>
  );
}
