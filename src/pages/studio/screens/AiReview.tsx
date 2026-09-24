import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Bot, Check, Flag, PenLine, Target, X } from 'lucide-react';
import { THEMES } from '../../../data/themes';
import {
  ASSESSMENT_CRITERIA,
  CRITERION_LABELS,
  VERDICT_LABELS,
  type AssessmentVerdict,
  type CriterionValue,
} from '../../../lib/contentAssessment';
import { LEVEL_RUBRIC, rubricFor } from '../../../lib/contentLevelRubric';
import type { AiAssessmentView, AssessmentPatchView, AssessmentQueueParams } from '../../../repos/studioRepo';
import type { Difficulty } from '../../../types';
import { VERDICT_TONE } from '../lib/assessmentForm';
import { useAssessmentQueueQuery, useAssessmentSummaryQuery, useDecideAssessmentsMutation } from '../lib/queries';
import { useCan } from '../lib/useStudio';
import { SubjectCard } from '../ui/AssessmentParts';
import { Badge, Button, Chip, EmptyState, Field, Grid, Note, Page, Panel, Select, Textarea, Toolbar } from '../ui/kit';

/**
 * AI review queue (content quality gate, layers 3–4). The newest AI verdict per
 * question, highest risk first; questions players reported or answer unusually
 * rise within the page. A reviewer accepts what the AI suggests, overrides it
 * with their own change, or dismisses it. Decisions change nothing by
 * themselves — `npm run ai -- apply-review-decisions` writes accepted ones into
 * the bank.
 */

const THEME_TITLE = new Map(THEMES.map((t) => [t.id, t.title]));
const PROBLEM_VERDICTS: AssessmentVerdict[] = ['reject', 'repair', 'reclassify'];
const VERDICT_FILTERS: Array<{
  id: string;
  label: string;
  verdicts: AssessmentVerdict[];
}> = [
  { id: 'problems', label: 'Усі проблемні', verdicts: PROBLEM_VERDICTS },
  { id: 'reject', label: VERDICT_LABELS.reject, verdicts: ['reject'] },
  { id: 'repair', label: VERDICT_LABELS.repair, verdicts: ['repair'] },
  {
    id: 'reclassify',
    label: VERDICT_LABELS.reclassify,
    verdicts: ['reclassify'],
  },
  { id: 'pass', label: VERDICT_LABELS.pass, verdicts: ['pass'] },
];
const VALUE_META: Record<CriterionValue, { label: string; className: string }> = {
  pass: { label: 'так', className: 'text-success' },
  fail: { label: 'ні', className: 'text-danger font-semibold' },
  unsure: { label: '?', className: 'text-gold-ink font-semibold' },
};

const levelLabel = (d: string | undefined | null) => (d ? (rubricFor(d)?.label ?? d) : '');
const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);

/** Plain words for what a patch will do to the question. */
function describePatch(patch: AssessmentPatchView | null): string {
  if (!patch) return 'Нічого не змінить у банку — лише позначить вердикт розглянутим.';
  if (patch.exclude) return 'Прибере питання з гри (у список виключень) і поставить його ревізії на карантин.';
  const parts: string[] = [];
  if (patch.difficulty) parts.push(`рівень → «${levelLabel(patch.difficulty)}»`);
  if (patch.themeId) parts.push(`тема → «${THEME_TITLE.get(patch.themeId) ?? patch.themeId}»`);
  if (patch.topicNodeId) parts.push(`вузол → ${patch.topicNodeId}`);
  if (patch.explanationShort) parts.push('нове коротке пояснення');
  if (patch.explanationDeep) parts.push('нове розширене пояснення');
  return `Змінить: ${parts.join(', ')}.`;
}

export function AiReview() {
  const can = useCan();
  const [filterId, setFilterId] = useState('problems');
  const [themeId, setThemeId] = useState('');
  const [decided, setDecided] = useState<NonNullable<AssessmentQueueParams['decided']>>('undecided');
  const [signalsOnly, setSignalsOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [withRepair, setWithRepair] = useState(true);

  const params: AssessmentQueueParams = {
    verdicts: VERDICT_FILTERS.find((f) => f.id === filterId)?.verdicts,
    themeId: themeId || undefined,
    decided,
    signals: signalsOnly,
    limit: 200,
  };
  const query = useAssessmentQueueQuery(params);
  const summary = useAssessmentSummaryQuery();
  const decide = useDecideAssessmentsMutation();
  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const current = items.find((i) => i.id === openId) ?? items[0];
  const denied = can('content:review') ? null : 'Потрібне право рецензувати';
  const byVerdict = summary.data?.summary?.ai.byVerdict ?? {};

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const clearAfter = (ids: string[]) => setSelected((prev) => new Set([...prev].filter((id) => !ids.includes(id))));

  const bulk = (decision: 'accepted' | 'dismissed') => {
    const ids = [...selected];
    decide.mutate(
      { ids, decision, enqueueRepair: decision === 'accepted' && withRepair },
      { onSuccess: () => clearAfter(ids) },
    );
  };

  const counts = (f: (typeof VERDICT_FILTERS)[number]) => f.verdicts.reduce((n, v) => n + (byVerdict[v] ?? 0), 0);

  return (
    <Page
      wide
      title="AI-рецензія"
      subtitle="Вердикти AI-рецензента: найризикованіші й ті, на які скаржились гравці, — першими. Рішення тут нічого не змінюють у банку, доки їх не застосують командою."
      actions={
        <>
          <Link to="/studio/review/golden">
            <Button variant="quiet">
              <Target size={13} />
              Еталон
            </Button>
          </Link>
          <Link to="/studio/review">
            <Button variant="quiet">
              <ArrowLeft size={13} />
              До черги
            </Button>
          </Link>
        </>
      }
    >
      {query.isError ? (
        <Note tone="danger">Не вдалося завантажити: {(query.error as Error).message}</Note>
      ) : query.data && !query.data.available ? (
        <Note tone="danger">AI-рецензія недоступна: сервер працює без бази даних.</Note>
      ) : (
        <div className="grid gap-3">
          <Toolbar>
            {VERDICT_FILTERS.map((f) => (
              <Chip
                key={f.id}
                active={filterId === f.id}
                count={summary.data?.summary ? counts(f) : undefined}
                onClick={() => {
                  setFilterId(f.id);
                  setSelected(new Set());
                }}
              >
                {f.label}
              </Chip>
            ))}
            <Chip active={signalsOnly} onClick={() => setSignalsOnly((v) => !v)}>
              <Flag size={12} />
              Сигнали гравців
            </Chip>
            <div className="w-[190px]">
              <Select
                aria-label="Тема"
                value={themeId}
                onChange={(e) => setThemeId(e.target.value)}
                options={[{ value: '', label: 'Усі теми' }, ...THEMES.map((t) => ({ value: t.id, label: t.title }))]}
              />
            </div>
            <div className="w-[160px]">
              <Select
                aria-label="Розглянуті"
                value={decided}
                onChange={(e) => setDecided(e.target.value as typeof decided)}
                options={[
                  { value: 'undecided', label: 'Нерозглянуті' },
                  { value: 'decided', label: 'Розглянуті' },
                  { value: 'all', label: 'Усі' },
                ]}
              />
            </div>
          </Toolbar>

          {summary.data?.summary && summary.data.summary.ai.decidedUnapplied > 0 && (
            <Note>
              Прийнято, але ще не застосовано: {summary.data.summary.ai.decidedUnapplied}. Щоб рішення дійшли до
              гравців, запустіть <code>npm run ai -- apply-review-decisions --apply</code> і задеплойте змінені файли.
            </Note>
          )}

          {selected.size > 0 && (
            <Panel bodyClassName="flex flex-wrap items-center gap-2 py-2.5">
              <span className="text-[13px] font-semibold">Вибрано: {selected.size}</span>
              <Button variant="primary" onClick={() => bulk('accepted')} denied={denied} disabled={decide.isPending}>
                <Check size={13} />
                Прийняти пропозиції AI
              </Button>
              <Button onClick={() => bulk('dismissed')} denied={denied} disabled={decide.isPending}>
                <X size={13} />
                Залишити як є
              </Button>
              <label className="flex items-center gap-1.5 text-[12.5px] text-muted">
                <input type="checkbox" checked={withRepair} onChange={(e) => setWithRepair(e.target.checked)} />
                для «Виправити» — запустити AI-виправлення
              </label>
              <Button variant="quiet" onClick={() => setSelected(new Set())}>
                Зняти вибір
              </Button>
            </Panel>
          )}
          {decide.isError && <Note tone="danger">Не збережено: {(decide.error as Error).message}</Note>}

          {items.length === 0 ? (
            <Panel>
              <EmptyState
                icon={<Bot size={18} />}
                title={query.isLoading ? 'Завантажую…' : 'Тут порожньо'}
                body={
                  query.isLoading
                    ? ''
                    : 'Або AI ще не переглядав питання (npm run ai -- ai-review), або все з цього фільтра вже розглянуто.'
                }
              />
            </Panel>
          ) : (
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
              <Panel
                title={`${query.data?.total ?? items.length} у черзі`}
                flush
                bodyClassName="max-h-[75vh] overflow-y-auto"
              >
                <Grid head cols="28px 104px minmax(0,1fr) 44px">
                  <input
                    type="checkbox"
                    aria-label="Вибрати всі на сторінці"
                    checked={items.every((i) => selected.has(i.id))}
                    onChange={(e) => setSelected(e.target.checked ? new Set(items.map((i) => i.id)) : new Set())}
                  />
                  <span>Вердикт</span>
                  <span>Питання</span>
                  <span className="text-right">Ризик</span>
                </Grid>
                {items.map((item) => (
                  <Grid
                    key={item.id}
                    cols="28px 104px minmax(0,1fr) 44px"
                    active={item.id === current?.id}
                    onClick={() => setOpenId(item.id)}
                  >
                    <input
                      type="checkbox"
                      aria-label={`Вибрати: ${item.subject.text}`}
                      checked={selected.has(item.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggle(item.id)}
                    />
                    <Badge tone={VERDICT_TONE[item.verdict]}>{VERDICT_LABELS[item.verdict]}</Badge>
                    <span className="min-w-0">
                      <span className="block truncate">{item.subject.text}</span>
                      <span className="block truncate text-[11.5px] text-faint">
                        {THEME_TITLE.get(item.subject.themeId) ?? item.subject.themeId} ·{' '}
                        {levelLabel(item.subject.difficulty)}
                        {item.signals && item.signals.openReports > 0 ? ` · скарг: ${item.signals.openReports}` : ''}
                        {item.decision ? ` · ${item.decision === 'dismissed' ? 'залишено' : 'прийнято'}` : ''}
                      </span>
                    </span>
                    <span className="studio-num text-right" title={`AI ${item.risk} + гравці ${item.boost}`}>
                      {item.priority}
                    </span>
                  </Grid>
                ))}
              </Panel>
              {current && <AssessmentDetail key={current.id} item={current} denied={denied} />}
            </div>
          )}
        </div>
      )}
    </Page>
  );
}

function AssessmentDetail({ item, denied }: { item: AiAssessmentView; denied: string | null }) {
  const decide = useDecideAssessmentsMutation();
  const [overriding, setOverriding] = useState(false);
  const [note, setNote] = useState('');
  const [patch, setPatch] = useState<AssessmentPatchView>(() => item.acceptPatch ?? {});
  const failed = ASSESSMENT_CRITERIA.filter((c) => item.criteria[c] !== 'pass');

  const send = (decision: 'accepted' | 'dismissed') =>
    decide.mutate(
      {
        ids: [item.id],
        decision,
        note: note || null,
        enqueueRepair: decision === 'accepted' && item.verdict === 'repair' && !item.acceptPatch,
      },
      { onSuccess: () => setOverriding(false) },
    );

  const cleanPatch = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined && v !== '' && v !== false),
  );

  return (
    <div className="grid content-start gap-3">
      <Panel
        title={
          <>
            <Bot size={14} />
            Вердикт AI
          </>
        }
        subtitle={`${item.assessor} · упевненість ${pct(item.confidence)}`}
        action={<Badge tone={VERDICT_TONE[item.verdict]}>{VERDICT_LABELS[item.verdict]}</Badge>}
      >
        <div className="grid gap-3">
          {item.notes && <p className="text-[13.5px]">{item.notes}</p>}
          {item.evidence.verdictAdjusted && (
            <Note>
              AI сказав «{VERDICT_LABELS[item.evidence.verdictAdjusted.from]}», але його ж критерії вимагають «
              {VERDICT_LABELS[item.evidence.verdictAdjusted.to]}» — вердикт піднято автоматично.
            </Note>
          )}
          <ul className="grid gap-1 text-[12.5px]">
            {(failed.length ? failed : ASSESSMENT_CRITERIA).map((c) => (
              <li key={c} className="flex gap-2">
                <span className="min-w-0 flex-1">{CRITERION_LABELS[c].label}</span>
                <span className={VALUE_META[item.criteria[c]].className}>{VALUE_META[item.criteria[c]].label}</span>
              </li>
            ))}
          </ul>
          {failed.length > 0 && <p className="text-[11.5px] text-faint">Решта критеріїв — «так».</p>}
          {item.evidence.passages.length > 0 && (
            <p className="text-[12px] text-faint">
              Вірші, які бачив AI:{' '}
              {item.evidence.passages.map((p) => `${p.label}${p.found ? '' : ' (не знайдено)'}`).join('; ')}
            </p>
          )}
          {item.signals && (item.signals.openReports > 0 || item.signals.accuracyBand) && (
            <p className="text-[12.5px]">
              <Flag size={12} className="mr-1 inline" />
              Гравці: скарг {item.signals.openReports}
              {item.signals.wrongAnswerReports
                ? ` (з них «неправильна відповідь» ${item.signals.wrongAnswerReports})`
                : ''}
              {item.signals.accuracyBand === 'too_hard' ? ' · майже ніхто не відповідає правильно' : ''}
              {item.signals.accuracyBand === 'too_easy' ? ' · відповідають усі — нічого не перевіряє' : ''}
            </p>
          )}
          {(item.suggestedDifficulty ||
            item.suggestedThemeId ||
            item.suggestedExplanationShort ||
            item.suggestedExplanationDeep) && (
            <div className="grid gap-1 rounded-[var(--s-radius-sm)] border border-line bg-[var(--s-panel-2)] px-3 py-2 text-[12.5px]">
              <p className="text-[11.5px] font-semibold tracking-[0.02em] text-faint uppercase">Пропозиції AI</p>
              {item.suggestedDifficulty && <p>Рівень: «{levelLabel(item.suggestedDifficulty)}»</p>}
              {item.suggestedThemeId && (
                <p>Тема: «{THEME_TITLE.get(item.suggestedThemeId) ?? item.suggestedThemeId}»</p>
              )}
              {item.suggestedExplanationShort && <p>Коротке: {item.suggestedExplanationShort}</p>}
              {item.suggestedExplanationDeep && <p>Розширене: {item.suggestedExplanationDeep}</p>}
            </div>
          )}

          {item.decision ? (
            <Note>
              Рішення:{' '}
              {item.decision === 'accepted'
                ? 'прийнято'
                : item.decision === 'overridden'
                  ? 'змінено вручну'
                  : 'залишено як є'}
              {item.decidedBy ? ` (${item.decidedBy})` : ''}.{' '}
              {item.appliedAt ? 'Уже застосовано до банку.' : 'Ще не застосовано.'}
            </Note>
          ) : (
            <>
              <p className="text-[12.5px] text-muted">
                «Прийняти»: {describePatch(item.acceptPatch)}
                {item.verdict === 'repair' && !item.acceptPatch ? ' Для питання буде запущено AI-виправлення.' : ''}
              </p>
              {overriding && <OverrideForm patch={patch} onChange={setPatch} />}
              <Field label="Коментар (необовʼязково)">
                <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
              {decide.isError && <Note tone="danger">Не збережено: {(decide.error as Error).message}</Note>}
              <div className="flex flex-wrap gap-2">
                {overriding ? (
                  <>
                    <Button
                      variant="primary"
                      denied={denied}
                      disabled={decide.isPending || Object.keys(cleanPatch).length === 0}
                      onClick={() => {
                        setPatch(cleanPatch);
                        decide.mutate(
                          {
                            ids: [item.id],
                            decision: 'overridden',
                            note: note || null,
                            patch: cleanPatch,
                          },
                          { onSuccess: () => setOverriding(false) },
                        );
                      }}
                    >
                      <Check size={13} />
                      Зберегти свою зміну
                    </Button>
                    <Button variant="quiet" onClick={() => setOverriding(false)}>
                      Скасувати
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="primary"
                      denied={denied}
                      disabled={decide.isPending}
                      onClick={() => send('accepted')}
                    >
                      <Check size={13} />
                      Прийняти
                    </Button>
                    <Button denied={denied} onClick={() => setOverriding(true)}>
                      <PenLine size={13} />
                      Змінити…
                    </Button>
                    <Button
                      variant="quiet"
                      denied={denied}
                      disabled={decide.isPending}
                      onClick={() => send('dismissed')}
                    >
                      <X size={13} />
                      Залишити як є
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </Panel>
      <Panel title="Питання, як його бачив AI">
        <SubjectCard subject={item.subject} />
      </Panel>
    </div>
  );
}

function OverrideForm({ patch, onChange }: { patch: AssessmentPatchView; onChange: (p: AssessmentPatchView) => void }) {
  return (
    <div className="grid gap-2 rounded-[var(--s-radius-sm)] border border-line p-3">
      <label className="flex items-center gap-2 text-[13px]">
        <input
          type="checkbox"
          checked={Boolean(patch.exclude)}
          onChange={(e) => onChange({ ...patch, exclude: e.target.checked || undefined })}
        />
        Прибрати питання з гри
      </label>
      {!patch.exclude && (
        <>
          <Field label="Рівень">
            <Select
              value={patch.difficulty ?? ''}
              onChange={(e) =>
                onChange({
                  ...patch,
                  difficulty: (e.target.value || undefined) as Difficulty | undefined,
                })
              }
              options={[
                { value: '', label: '— не змінювати —' },
                ...LEVEL_RUBRIC.map((r) => ({
                  value: r.level,
                  label: r.label,
                })),
              ]}
            />
          </Field>
          <Field label="Тема">
            <Select
              value={patch.themeId ?? ''}
              onChange={(e) => onChange({ ...patch, themeId: e.target.value || undefined })}
              options={[
                { value: '', label: '— не змінювати —' },
                ...THEMES.map((t) => ({ value: t.id, label: t.title })),
              ]}
            />
          </Field>
          <Field label="Коротке пояснення">
            <Textarea
              rows={2}
              value={patch.explanationShort ?? ''}
              onChange={(e) =>
                onChange({
                  ...patch,
                  explanationShort: e.target.value || undefined,
                })
              }
            />
          </Field>
          <Field label="Розширене пояснення">
            <Textarea
              rows={3}
              value={patch.explanationDeep ?? ''}
              onChange={(e) =>
                onChange({
                  ...patch,
                  explanationDeep: e.target.value || undefined,
                })
              }
            />
          </Field>
        </>
      )}
    </div>
  );
}
