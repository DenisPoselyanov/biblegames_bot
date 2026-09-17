import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Inbox, Search } from 'lucide-react';
import { DRAFTS } from '../lib/mock';
import type { Check, DraftStatus } from '../lib/types';
import {
  Button,
  Chip,
  EmptyState,
  Grid,
  Input,
  Mono,
  Page,
  Panel,
  Status,
  Toolbar,
} from '../ui/kit';

const FILTERS: Array<{ id: string; label: string; match: (s: DraftStatus) => boolean }> = [
  { id: 'all', label: 'Усі', match: () => true },
  { id: 'ready_for_review', label: 'На ревʼю', match: (s) => s === 'ready_for_review' },
  { id: 'changes_requested', label: 'Потребує змін', match: (s) => s === 'changes_requested' },
  { id: 'validation_failed', label: 'Валідація провалена', match: (s) => s === 'validation_failed' },
  { id: 'approved', label: 'Схвалено', match: (s) => s === 'approved' || s === 'scheduled' },
  { id: 'generated', label: 'Згенеровано', match: (s) => s === 'generated' || s === 'draft' },
];

const KIND_LABEL: Record<string, string> = {
  question: 'Питання',
  explanation: 'Пояснення',
  lesson: 'Урок',
  topic: 'Тема',
};

/** Compact "3 ✓ · 2 ! · 1 ✕" summary so the grid shows risk without opening. */
function CheckSummary({ checks }: { checks: Check[] }) {
  const pass = checks.filter((c) => c.severity === 'pass').length;
  const warn = checks.filter((c) => c.severity === 'warn').length;
  const fail = checks.filter((c) => c.severity === 'fail').length;
  return (
    <span className="studio-num flex items-center gap-2 text-[12px]">
      <span className="text-success">{pass} ✓</span>
      {warn > 0 && <span className="text-gold-ink">{warn} !</span>}
      {fail > 0 && <span className="text-danger">{fail} ✕</span>}
    </span>
  );
}

export function ReviewQueue() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  const active = FILTERS.find((f) => f.id === filter) ?? FILTERS[0];

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DRAFTS.filter((d) => active.match(d.status)).filter(
      (d) =>
        !q ||
        d.title.toLowerCase().includes(q) ||
        d.topicPath.toLowerCase().includes(q) ||
        d.id.includes(q),
    );
  }, [active, query]);

  const COLS = '1fr 210px 118px 150px 120px 96px';

  return (
    <Page
      wide
      title="Черга ревʼю"
      subtitle="Staging. Нічого звідси не потрапляє до гравців, поки людина не схвалить."
    >
      <Toolbar className="mb-3">
        {FILTERS.map((f) => (
          <Chip
            key={f.id}
            active={f.id === filter}
            onClick={() => setFilter(f.id)}
            count={DRAFTS.filter((d) => f.match(d.status)).length}
          >
            {f.label}
          </Chip>
        ))}
        <div className="relative ml-auto w-[260px]">
          <Search size={14} className="absolute top-2.5 left-2.5 text-faint" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Пошук за назвою, темою або id"
            className="pl-8"
          />
        </div>
      </Toolbar>

      <Panel flush>
        <Grid head cols={COLS}>
          <span>Позиція</span>
          <span>Тема</span>
          <span>Тип</span>
          <span>Статус</span>
          <span>Перевірки</span>
          <span className="text-right">Оновлено</span>
        </Grid>

        {rows.map((d) => (
          <Grid key={d.id} cols={COLS} onClick={() => navigate(d.id)}>
            <span className="min-w-0">
              <span className="block truncate font-medium">{d.title}</span>
              <Mono>
                {d.id} · ревізія {d.revision} · {d.provider}/{d.model}
              </Mono>
            </span>
            <span className="truncate text-[12.5px] text-muted" title={d.topicPath}>
              {d.topicPath}
            </span>
            <span className="text-[12.5px] text-muted">{KIND_LABEL[d.kind]}</span>
            <Status value={d.status} />
            <CheckSummary checks={d.checks} />
            <Mono className="text-right">{d.updatedAt.slice(11)}</Mono>
          </Grid>
        ))}

        {rows.length === 0 && (
          <EmptyState
            icon={<Inbox size={18} />}
            title="Черга порожня"
            body="За цим фільтром нічого немає. Це нормальний стан — не помилка: після схвалення позиція йде в реліз і зникає звідси."
            action={
              <Button variant="ghost" onClick={() => { setFilter('all'); setQuery(''); }}>
                Скинути фільтри
              </Button>
            }
          />
        )}
      </Panel>

      <p className="mt-3 text-[12px] text-faint">
        Порядок черги — за часом оновлення. Позиції зі статусом «Валідація
        провалена» не можна схвалити, доки чек не пройдено: кнопка лишається
        видимою й неактивною.
      </p>
    </Page>
  );
}
