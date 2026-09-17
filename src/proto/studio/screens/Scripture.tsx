import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookMarked, RefreshCw } from 'lucide-react';
import { SCRIPTURE_CHECKS } from '../lib/mock';
import { useCan } from '../lib/useStudio';
import type { ScriptureVerdict } from '../lib/types';
import { Badge, Button, Chip, Grid, KeyVal, Metric, Mono, Page, Panel, Status, Toolbar } from '../ui/kit';
import { cn } from '../../ui/cn';

const FILTERS: Array<{ id: string; label: string; match: (v: ScriptureVerdict) => boolean }> = [
  { id: 'all', label: 'Усі', match: () => true },
  { id: 'problem', label: 'Потребують рішення', match: (v) => v !== 'match' },
  { id: 'match', label: 'Збіг', match: (v) => v === 'match' },
  { id: 'paraphrase', label: 'Переказ', match: (v) => v === 'paraphrase' },
  { id: 'mismatch', label: 'Невідповідність', match: (v) => v === 'mismatch' },
  { id: 'not_found', label: 'Вірша немає', match: (v) => v === 'not_found' },
];

const COLS = '130px 1fr 130px 150px 96px';

export function Scripture() {
  const can = useCan();
  const [filter, setFilter] = useState('problem');
  const [selectedId, setSelectedId] = useState(SCRIPTURE_CHECKS[2].id);

  const active = FILTERS.find((f) => f.id === filter) ?? FILTERS[0];
  const rows = SCRIPTURE_CHECKS.filter((s) => active.match(s.verdict));
  const selected = SCRIPTURE_CHECKS.find((s) => s.id === selectedId) ?? rows[0];

  const counts = {
    match: SCRIPTURE_CHECKS.filter((s) => s.verdict === 'match').length,
    paraphrase: SCRIPTURE_CHECKS.filter((s) => s.verdict === 'paraphrase').length,
    broken: SCRIPTURE_CHECKS.filter((s) => s.verdict === 'mismatch' || s.verdict === 'not_found')
      .length,
  };

  return (
    <Page
      wide
      title="Перевірка Писання"
      subtitle="Детермінований адаптер: нормалізує посилання, звіряє цитату з джерелом і зберігає evidence."
      actions={
        <Button
          variant="ghost"
          denied={can('job.run') ? null : 'Потрібне право job.run'}
        >
          <RefreshCw size={14} />
          Перевірити всю чергу
        </Button>
      }
    >
      <div className="mb-4 grid grid-cols-4 gap-3">
        <Metric label="Перевірено посилань" value="148" delta="останній прогін 08:31" />
        <Metric label="Точний збіг" value={counts.match} delta="цитата = джерело" tone="good" />
        <Metric
          label="Переказ"
          value={counts.paraphrase}
          delta="потрібне рішення людини"
          tone="warn"
          hint="Не помилка. Або зняти лапки, або підтягнути дослівний текст."
        />
        <Metric
          label="Помилки"
          value={counts.broken}
          delta="блокують публікацію"
          tone="bad"
          hint="Невідповідність тексту або неіснуючий вірш."
        />
      </div>

      <div className="grid grid-cols-[1fr_400px] items-start gap-4">
        <div>
          <Toolbar className="mb-3">
            {FILTERS.map((f) => (
              <Chip
                key={f.id}
                active={f.id === filter}
                onClick={() => setFilter(f.id)}
                count={SCRIPTURE_CHECKS.filter((s) => f.match(s.verdict)).length}
              >
                {f.label}
              </Chip>
            ))}
          </Toolbar>

          <Panel flush>
            <Grid head cols={COLS}>
              <span>Посилання</span>
              <span>Цитата в чернетці</span>
              <span>Вердикт</span>
              <span>Чернетка</span>
              <span className="text-right">Час</span>
            </Grid>
            {rows.map((s) => (
              <Grid
                key={s.id}
                cols={COLS}
                active={s.id === selected?.id}
                onClick={() => setSelectedId(s.id)}
              >
                <span className="min-w-0">
                  <span className="block truncate font-display font-semibold">{s.reference}</span>
                  <Mono>{s.normalized}</Mono>
                </span>
                <span className="truncate text-[12.5px] text-muted italic">«{s.quoted}»</span>
                <Status value={s.verdict} />
                <Mono className="text-muted">{s.draftId ?? '—'}</Mono>
                <Mono className="text-right">{s.checkedAt.slice(11)}</Mono>
              </Grid>
            ))}
          </Panel>
        </div>

        {selected && (
          <Panel
            title={selected.reference}
            subtitle={`${selected.normalized} · ${selected.translation}`}
            action={<Status value={selected.verdict} />}
          >
            <p className="text-[11px] font-semibold tracking-[0.04em] text-faint uppercase">
              У чернетці
            </p>
            <blockquote className="mt-1 rounded-[var(--s-radius-sm)] border border-line bg-[var(--s-panel-2)] p-3 font-display text-[14px] leading-relaxed italic">
              «{selected.quoted}»
            </blockquote>

            <p className="mt-3 text-[11px] font-semibold tracking-[0.04em] text-faint uppercase">
              У джерелі
            </p>
            <blockquote
              className={cn(
                'mt-1 rounded-[var(--s-radius-sm)] border p-3 font-display text-[14px] leading-relaxed italic',
                selected.source
                  ? 'border-line bg-[var(--s-panel-2)]'
                  : 'border-[color-mix(in_srgb,var(--p-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--p-danger)_10%,transparent)] text-danger',
              )}
            >
              {selected.source ? `«${selected.source}»` : 'Вірша не існує в жодному з підключених джерел.'}
            </blockquote>

            <p className="mt-3 text-[12.5px] leading-relaxed text-muted">{selected.note}</p>

            <dl className="mt-3 border-t border-line pt-2">
              <KeyVal k="Джерело" v={`${selected.translation} · локальний індекс`} />
              <KeyVal k="Перевірено" v={selected.checkedAt} />
              <KeyVal
                k="Evidence"
                v={<Mono className="text-muted">збережено з ревізією</Mono>}
              />
            </dl>

            <div className="mt-4 flex flex-wrap gap-2">
              {selected.draftId && (
                <Link to={`../review/${selected.draftId}`}>
                  <Button variant="ghost">
                    <BookMarked size={13} />
                    Відкрити чернетку
                  </Button>
                </Link>
              )}
              <Button
                variant="ghost"
                denied={can('draft.repair') ? null : 'Потрібне право draft.repair'}
              >
                Підтягнути дослівний текст
              </Button>
              <Button
                variant="ghost"
                denied={can('review.approve') ? null : 'Потрібне право review.approve'}
              >
                Позначити як переказ
              </Button>
            </div>

            <p className="mt-3 text-[12px] leading-relaxed text-faint">
              Контекст і тлумачення адаптер не перевіряє — тільки те, що цитата
              відповідає посиланню. Богословське рішення лишається за людиною.
              <Badge className="ml-1.5">межа інструмента</Badge>
            </p>
          </Panel>
        )}
      </div>
    </Page>
  );
}
