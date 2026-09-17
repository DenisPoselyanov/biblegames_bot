import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import { TOPIC_TREE } from '../lib/mock';
import type { TopicNode } from '../lib/types';
import { Badge, Bar, Grid, Metric, Mono, Page, Panel } from '../ui/kit';

const COLS = '1fr 150px 170px 110px 120px';

function coverage(node: TopicNode) {
  return node.pool.target > 0 ? node.pool.published / node.pool.target : 0;
}

function accuracyTone(value: number | null) {
  if (value === null) return 'neutral' as const;
  if (value < 0.6) return 'danger' as const;
  if (value > 0.9) return 'gold' as const;
  return 'success' as const;
}

export function Library() {
  const navigate = useNavigate();

  const all = TOPIC_TREE.flatMap((r) => [r, ...(r.children ?? [])]);
  const leaves = TOPIC_TREE.flatMap((r) => r.children ?? []);
  const orphans = leaves.filter((t) => t.pool.published === 0);
  const flagged = leaves.filter((t) => t.flags.length > 0);
  const published = TOPIC_TREE.reduce((sum, r) => sum + r.pool.published, 0);

  return (
    <Page
      wide
      title="Бібліотека контенту"
      subtitle="Дерево тем і покриття пулів. Те, що раніше жило у вкладках «Конвеєр» і «Якість тем» лаунчера."
    >
      <div className="mb-4 grid grid-cols-4 gap-3">
        <Metric label="Тем і підтем" value={all.length} delta={`${leaves.length} з питаннями`} />
        <Metric
          label="Опублікованих питань"
          value={published.toLocaleString('uk-UA')}
          delta="ціль 4 400"
          tone="neutral"
        />
        <Metric
          label="Порожніх пулів"
          value={orphans.length}
          delta="підтема без жодного питання"
          tone={orphans.length ? 'bad' : 'good'}
        />
        <Metric
          label="Тем із позначками"
          value={flagged.length}
          delta="дублікати, складність, сироти"
          tone="warn"
        />
      </div>

      <Panel flush>
        <Grid head cols={COLS}>
          <span>Тема</span>
          <span>Пул</span>
          <span>Покриття</span>
          <span>Правильність</span>
          <span>Позначки</span>
        </Grid>

        {TOPIC_TREE.map((root) => (
          <div key={root.id}>
            <Grid cols={COLS} className="bg-[var(--s-panel-2)]">
              <span className="flex min-w-0 items-center gap-2">
                <ChevronDown size={14} className="shrink-0 text-faint" />
                <span className="truncate font-display text-[14px] font-semibold">
                  {root.title}
                </span>
                <Mono>{root.reference}</Mono>
              </span>
              <span className="studio-num text-[12.5px] text-muted">
                {root.pool.published.toLocaleString('uk-UA')}
              </span>
              <span className="min-w-0">
                <Bar value={root.pool.published} max={root.pool.target} />
              </span>
              <span className="studio-num text-[12.5px] text-muted">
                {root.accuracy ? `${Math.round(root.accuracy * 100)}%` : '—'}
              </span>
              <span />
            </Grid>

            {(root.children ?? []).map((node) => (
              <Grid key={node.id} cols={COLS} onClick={() => navigate(node.id)}>
                <span className="min-w-0 pl-6">
                  <span className="block truncate font-medium">{node.title}</span>
                  <Mono>{node.reference}</Mono>
                </span>
                <span className="studio-num text-[12.5px]">
                  {node.pool.published}
                  <span className="text-faint"> / {node.pool.target}</span>
                  {node.pool.inReview > 0 && (
                    <span className="ml-1.5 text-gold-ink">+{node.pool.inReview} на ревʼю</span>
                  )}
                </span>
                <span className="min-w-0">
                  <Bar value={node.pool.published} max={node.pool.target} />
                  <Mono className="mt-1 block">{Math.round(coverage(node) * 100)}%</Mono>
                </span>
                <span>
                  {node.accuracy === null ? (
                    <span className="text-[12.5px] text-faint">немає даних</span>
                  ) : (
                    <Badge tone={accuracyTone(node.accuracy)}>
                      {Math.round(node.accuracy * 100)}%
                    </Badge>
                  )}
                </span>
                <span className="flex min-w-0 flex-wrap gap-1">
                  {node.flags.map((f) => (
                    <Badge key={f} tone={f.startsWith('сирота') ? 'danger' : 'gold'}>
                      {f}
                    </Badge>
                  ))}
                </span>
              </Grid>
            ))}
          </div>
        ))}
      </Panel>

      {orphans.length > 0 && (
        <div className="mt-4 flex items-start gap-2 rounded-[var(--s-radius)] border border-[color-mix(in_srgb,var(--p-danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--p-danger)_8%,transparent)] px-4 py-3">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-danger" />
          <div className="text-[12.5px] leading-relaxed">
            <p className="font-semibold">
              {orphans.length} підтема існує без питань
            </p>
            <p className="text-faint">
              Конвеєр тем створив «{orphans[0].title}», але пул порожній — у грі
              ця тема не зʼявиться. Або запустити генерацію, або прибрати тему.
            </p>
          </div>
        </div>
      )}
    </Page>
  );
}
