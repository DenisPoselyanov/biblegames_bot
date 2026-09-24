/**
 * Shared pieces of the quality-gate screens (WS11c/d): the question as it was
 * assessed, with the cited verse (Ohienko) next to it, and the eight-criteria
 * form. The golden labelling page and the AI review queue use the same form, so
 * a human label and a human override of an AI verdict have the same shape.
 */
import { useState } from 'react';
import { THEMES } from '../../../data/themes';
import { useScripture } from '../../../hooks/useScripture';
import type { AssessmentFormValue } from '../lib/assessmentForm';
import {
  ASSESSMENT_CRITERIA,
  ASSESSMENT_VERDICTS,
  CRITERION_LABELS,
  VERDICT_LABELS,
  impliedVerdict,
  type AssessmentSubject,
  type CriterionValue,
} from '../../../lib/contentAssessment';
import { LEVEL_RUBRIC, rubricFor } from '../../../lib/contentLevelRubric';
import { scriptureAvailable } from '../../../repos/scriptureRepo';
import type { Difficulty } from '../../../types';
import { cn } from './cn';
import { Badge, Disclosure, Field, Note, Select, Textarea } from './kit';

const THEME_TITLE = new Map(THEMES.map((t) => [t.id, t.title]));
const LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е'];

function VersePanel({ reference }: { reference: string }) {
  const { state, passage } = useScripture(reference, 'UBIO');
  if (!scriptureAvailable()) return <Note>Текст вірша доступний лише з підключеним сервером.</Note>;
  if (state === 'loading') return <p className="text-[12.5px] text-faint">Завантаження вірша…</p>;
  if (state === 'error' || !passage) {
    return (
      <Note tone="danger">
        {passage?.parseError === 'unparsed_reference'
          ? `Посилання «${reference}» не розпізнано.`
          : 'Текст тимчасово недоступний — bolls.life не відповів.'}
      </Note>
    );
  }
  return (
    <ol className="grid gap-1 text-[13px] leading-relaxed">
      {passage.verses.map((v) => (
        <li key={v.verse} className="flex gap-2">
          <span className="studio-num w-6 shrink-0 text-right text-[11.5px] text-faint">{v.verse}</span>
          <span>{v.text}</span>
        </li>
      ))}
    </ol>
  );
}

/** The question body, the correct answer marked, both explanations and the cited verse. */
export function SubjectCard({ subject, findings }: { subject: AssessmentSubject; findings?: string[] }) {
  const rubric = rubricFor(subject.difficulty);
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="info">{rubric?.label ?? subject.difficulty}</Badge>
        <Badge>{THEME_TITLE.get(subject.themeId) ?? subject.themeId}</Badge>
        {subject.topicNodeId && <Badge>{subject.topicNodeId}</Badge>}
        <span className="studio-mono text-[11px] text-faint">{subject.questionId}</span>
      </div>
      <p className="text-[16px] leading-snug font-semibold">{subject.text}</p>
      <ol className="grid gap-1.5">
        {subject.options.map((o, i) => (
          <li
            key={i}
            className={cn(
              'flex gap-2 rounded-[var(--s-radius-sm)] border px-3 py-1.5 text-[13.5px]',
              i === subject.correctIndex
                ? 'border-[color-mix(in_srgb,var(--p-success)_50%,transparent)] bg-[color-mix(in_srgb,var(--p-success)_12%,transparent)]'
                : 'border-line',
            )}
          >
            <span className="w-4 shrink-0 font-semibold text-faint">{LETTERS[i] ?? i + 1}</span>
            <span className="flex-1">{o}</span>
            {i === subject.correctIndex && <span className="text-[11px] font-semibold text-success">правильна</span>}
          </li>
        ))}
      </ol>
      <div className="grid gap-1 text-[13px]">
        <p>
          <span className="font-semibold">Коротке пояснення: </span>
          {subject.explanationShort ?? <span className="text-faint">немає</span>}
        </p>
        <p>
          <span className="font-semibold">Розширене: </span>
          {subject.explanationDeep ?? <span className="text-faint">немає</span>}
        </p>
      </div>
      {rubric && (
        <p className="text-[12px] text-faint">
          Рівень «{rubric.label}»: {rubric.question}. Пояснення: {rubric.explanationShort}
          {rubric.deepExpected ? `; розширене потрібне — ${rubric.explanationDeep}` : ''}.
        </p>
      )}
      <div className="rounded-[var(--s-radius-sm)] border border-line bg-[var(--s-panel-2)] px-3 py-2">
        <p className="mb-1 text-[11.5px] font-semibold tracking-[0.02em] text-faint uppercase">
          {subject.reference ? `${subject.reference} · Огієнко` : 'Посилання немає'}
        </p>
        {subject.reference && <VersePanel reference={subject.reference} />}
      </div>
      {findings && findings.length > 0 && (
        <Disclosure label="Автоматичні зауваження" hint={`${findings.length}`}>
          <div className="flex flex-wrap gap-1 px-4 py-3">
            {findings.map((f) => (
              <Badge key={f}>{f}</Badge>
            ))}
          </div>
        </Disclosure>
      )}
    </div>
  );
}

const VALUE_META: Record<CriterionValue, { label: string; on: string }> = {
  pass: { label: 'Так', on: 'bg-[color-mix(in_srgb,var(--p-success)_22%,transparent)] text-ink border-[var(--p-success)]' },
  fail: { label: 'Ні', on: 'bg-[color-mix(in_srgb,var(--p-danger)_22%,transparent)] text-ink border-[var(--p-danger)]' },
  unsure: { label: '?', on: 'bg-[color-mix(in_srgb,var(--p-gold)_22%,transparent)] text-ink border-[var(--p-gold)]' },
};

/**
 * Eight criteria (Так / Ні / ?), the verdict (follows the criteria until picked
 * by hand), and the suggestions that the failed criteria call for.
 */
export function AssessmentForm({
  value,
  onChange,
}: {
  value: AssessmentFormValue;
  onChange: (next: AssessmentFormValue) => void;
}) {
  // Parents key this form by question id, so "picked by hand" resets per question.
  const [verdictTouched, setVerdictTouched] = useState(false);

  const setCriterion = (c: (typeof ASSESSMENT_CRITERIA)[number], v: CriterionValue) => {
    const criteria = { ...value.criteria, [c]: v };
    onChange({ ...value, criteria, verdict: verdictTouched ? value.verdict : impliedVerdict(criteria) });
  };
  const implied = impliedVerdict(value.criteria);
  const showLevel = value.criteria.level_fit !== 'pass' || value.verdict === 'reclassify';
  const showExplanation = value.criteria.explanation_fit !== 'pass';
  const showTheme = value.criteria.topic_fit !== 'pass';

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
        {ASSESSMENT_CRITERIA.map((c) => (
          <li key={c} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 text-[13px]" title={CRITERION_LABELS[c].question}>
              <span className="font-medium">{CRITERION_LABELS[c].label}</span>
              <span className="block truncate text-[11.5px] text-faint">{CRITERION_LABELS[c].question}</span>
            </span>
            <span className="flex shrink-0 gap-1" role="radiogroup" aria-label={CRITERION_LABELS[c].label}>
              {(['pass', 'fail', 'unsure'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={value.criteria[c] === v}
                  onClick={() => setCriterion(c, v)}
                  className={cn(
                    'h-7 w-9 rounded-[var(--s-radius-sm)] border text-[12px] font-semibold',
                    value.criteria[c] === v ? VALUE_META[v].on : 'border-line text-faint hover:text-ink',
                  )}
                >
                  {VALUE_META[v].label}
                </button>
              ))}
            </span>
          </li>
        ))}
      </ul>

      <Field label="Вердикт">
        <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Вердикт">
          {ASSESSMENT_VERDICTS.map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={value.verdict === v}
              onClick={() => {
                setVerdictTouched(true);
                onChange({ ...value, verdict: v });
              }}
              className={cn(
                'h-9 rounded-[var(--s-radius-sm)] border px-2 text-[12.5px] font-semibold',
                value.verdict === v
                  ? 'border-[var(--p-indigo)] bg-[color-mix(in_srgb,var(--p-indigo)_18%,transparent)] text-ink'
                  : 'border-line text-muted hover:text-ink',
              )}
            >
              {VERDICT_LABELS[v]}
            </button>
          ))}
        </div>
      </Field>
      {value.verdict !== implied && (
        <p className="text-[12px] text-faint">За критеріями виходить «{VERDICT_LABELS[implied]}» — вибрано інше вручну.</p>
      )}

      {showLevel && (
        <Field label="Правильний рівень">
          <Select
            value={value.suggestedDifficulty ?? ''}
            onChange={(e) => onChange({ ...value, suggestedDifficulty: (e.target.value || null) as Difficulty | null })}
            options={[
              { value: '', label: '— не змінювати —' },
              ...LEVEL_RUBRIC.map((r) => ({ value: r.level, label: `${r.label} — ${r.question}` })),
            ]}
          />
        </Field>
      )}
      {showTheme && (
        <Field label="Правильна тема">
          <Select
            value={value.suggestedThemeId ?? ''}
            onChange={(e) => onChange({ ...value, suggestedThemeId: e.target.value || null })}
            options={[
              { value: '', label: '— не змінювати —' },
              ...THEMES.map((t) => ({ value: t.id, label: t.title })),
            ]}
          />
        </Field>
      )}
      {showExplanation && (
        <>
          <Field label="Краще коротке пояснення (необовʼязково)">
            <Textarea
              rows={2}
              value={value.suggestedExplanationShort ?? ''}
              onChange={(e) => onChange({ ...value, suggestedExplanationShort: e.target.value || null })}
            />
          </Field>
          <Field label="Краще розширене пояснення (необовʼязково)">
            <Textarea
              rows={3}
              value={value.suggestedExplanationDeep ?? ''}
              onChange={(e) => onChange({ ...value, suggestedExplanationDeep: e.target.value || null })}
            />
          </Field>
        </>
      )}
      <Field label="Нотатка">
        <Textarea
          rows={2}
          value={value.notes ?? ''}
          placeholder="Що саме не так — допоможе калібрувати AI"
          onChange={(e) => onChange({ ...value, notes: e.target.value || null })}
        />
      </Field>
    </div>
  );
}
