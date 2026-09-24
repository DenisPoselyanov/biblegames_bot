import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Save, SkipForward, Target } from 'lucide-react';
import { VERDICT_LABELS } from '../../../lib/contentAssessment';
import { useGoldenQuery, useSaveGoldenLabelMutation } from '../lib/queries';
import { useCan } from '../lib/useStudio';
import type { GoldenItem } from '../../../repos/studioRepo';
import { VERDICT_TONE, formFromLabel, type AssessmentFormValue } from '../lib/assessmentForm';
import { AssessmentForm, SubjectCard } from '../ui/AssessmentParts';
import { CalibrationPanel } from '../ui/CalibrationPanel';
import { cn } from '../ui/cn';
import { Badge, Bar, Button, EmptyState, Note, Page, Panel } from '../ui/kit';

/**
 * Golden set labelling (content quality gate, WS11c). The owner labels ~200
 * questions by the same eight criteria the AI reviewer uses; the AI is then
 * calibrated against these labels before its verdicts are trusted on the rest
 * of the bank. The sample is stratified and deliberately mixed in order; which
 * bucket an item came from is not shown, so it can't anchor the label.
 */

const DOT_TONE: Record<string, string> = {
  pass: 'bg-success',
  reclassify: 'bg-indigo',
  repair: 'bg-gold',
  reject: 'bg-danger',
};

export function Golden() {
  const can = useCan();
  const query = useGoldenQuery();
  const save = useSaveGoldenLabelMutation();
  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const [picked, setPicked] = useState<number | null>(null);

  const firstUnlabelled = items.findIndex((i) => !i.label || i.label.stale);
  // Until the reviewer picks one, stand on the first unlabelled item.
  const index = items.length === 0 ? null : (picked ?? (firstUnlabelled === -1 ? 0 : firstUnlabelled));
  const current = index === null ? undefined : items[index];

  const denied = can('content:review') ? null : 'Потрібне право рецензувати';
  const go = (i: number) => setPicked(Math.max(0, Math.min(items.length - 1, i)));
  const nextUnlabelledAfter = (from: number) => {
    for (let k = 1; k <= items.length; k++) {
      const i = (from + k) % items.length;
      if (!items[i].label || items[i].label?.stale) return i;
    }
    return null;
  };

  const submit = (form: AssessmentFormValue) => {
    if (!current || index === null) return;
    save.mutate(
      { questionId: current.subject.questionId, label: form },
      {
        onSuccess: () => {
          const next = nextUnlabelledAfter(index);
          if (next !== null && next !== index) go(next);
        },
      },
    );
  };

  const progress = query.data?.progress;

  return (
    <Page
      wide
      title="Еталон: розмітка питань"
      subtitle="Ваші оцінки — мірило для AI-рецензента: поки він не збігається з ними, його вердиктам не довіряємо."
      actions={
        <Link to="/studio/review">
          <Button variant="quiet">
            <ArrowLeft size={13} />
            До черги
          </Button>
        </Link>
      }
    >
      {query.isError ? (
        <Note tone="danger">Не вдалося завантажити еталон: {(query.error as Error).message}</Note>
      ) : query.data && !query.data.available ? (
        <Note tone="danger">Еталон недоступний: сервер працює без бази даних, мітки нікуди зберегти.</Note>
      ) : query.data?.sampleMissing ? (
        <Note>
          Вибірки ще немає. Її створює команда <code>npm run ai -- golden-sample --apply</code> — файл
          <code> data/quality/golden-sample.json</code> потрапляє в репозиторій і на сервер разом із деплоєм.
        </Note>
      ) : items.length === 0 ? (
        <Panel>
          <EmptyState icon={<Target size={18} />} title={query.isLoading ? 'Завантажую…' : 'Порожньо'} body="" />
        </Panel>
      ) : (
        <div className="grid gap-3">
          <Panel
            title={`Розмічено ${progress?.labelled ?? 0} з ${progress?.total ?? items.length}`}
            action={
              firstUnlabelled !== -1 && (
                <Button variant="ghost" onClick={() => go(firstUnlabelled)}>
                  <SkipForward size={13} />
                  До першого нерозміченого
                </Button>
              )
            }
          >
            <Bar value={progress?.labelled ?? 0} max={progress?.total ?? items.length} className="mb-3" />
            <div className="flex flex-wrap gap-1" aria-label="Питання еталону">
              {items.map((it, i) => (
                <button
                  key={it.subject.questionId}
                  type="button"
                  onClick={() => go(i)}
                  title={`${i + 1}. ${it.subject.text}${it.label ? ` — ${VERDICT_LABELS[it.label.verdict]}` : ''}`}
                  aria-label={`Питання ${i + 1}${it.label ? `, ${VERDICT_LABELS[it.label.verdict]}` : ', не розмічено'}`}
                  aria-current={i === index}
                  className={cn(
                    'h-3.5 w-3.5 rounded-[3px] border',
                    it.label && !it.label.stale ? cn(DOT_TONE[it.label.verdict], 'border-transparent') : 'border-line-strong',
                    i === index && 'ring-2 ring-[var(--p-indigo)] ring-offset-1 ring-offset-[var(--s-panel)]',
                  )}
                />
              ))}
            </div>
          </Panel>

          {current && index !== null && (
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_380px]">
              <Panel
                title={`Питання ${index + 1} з ${items.length}`}
                action={
                  <>
                    {current.label && (
                      <Badge tone={current.label.stale ? 'neutral' : VERDICT_TONE[current.label.verdict]}>
                        {current.label.stale ? 'питання змінилось' : VERDICT_LABELS[current.label.verdict]}
                      </Badge>
                    )}
                    <Button variant="quiet" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Попереднє">
                      <ChevronLeft size={14} />
                    </Button>
                    <Button
                      variant="quiet"
                      onClick={() => go(index + 1)}
                      disabled={index === items.length - 1}
                      aria-label="Наступне"
                    >
                      <ChevronRight size={14} />
                    </Button>
                  </>
                }
              >
                <SubjectCard subject={current.subject} findings={current.findings} />
              </Panel>
              <Panel title="Ваша оцінка">
                <LabelEditor
                  key={`${current.subject.questionId}:${current.label?.updatedAt ?? ''}`}
                  item={current}
                  onSubmit={submit}
                  pending={save.isPending}
                  error={save.isError ? (save.error as Error).message : null}
                  denied={denied}
                />
              </Panel>
            </div>
          )}
          <CalibrationPanel />
        </div>
      )}
    </Page>
  );
}

/** Keyed by question (and saved label), so its draft starts from the stored label on every switch. */
function LabelEditor({
  item,
  onSubmit,
  pending,
  error,
  denied,
}: {
  item: GoldenItem;
  onSubmit: (form: AssessmentFormValue) => void;
  pending: boolean;
  error: string | null;
  denied: string | null;
}) {
  const [form, setForm] = useState<AssessmentFormValue>(() =>
    formFromLabel(item.label && !item.label.stale ? item.label : null),
  );
  return (
    <form
      className="grid grid-cols-[minmax(0,1fr)] gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          onSubmit(form);
        }
      }}
    >
      <AssessmentForm value={form} onChange={setForm} />
      {error && <Note tone="danger">Не збережено: {error}</Note>}
      <Button type="submit" variant="primary" size="md" denied={denied} disabled={pending}>
        <Save size={14} />
        Зберегти і далі
      </Button>
      <p className="text-[11.5px] text-faint">Ctrl+Enter — зберегти. Змінити оцінку можна будь-коли.</p>
    </form>
  );
}
