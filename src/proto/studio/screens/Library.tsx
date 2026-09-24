import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { DRAFTS, QUALITY_METRICS, QUALITY_OUTLIERS, TOPIC_TREE } from '../lib/mock';
import { useCan } from '../lib/useStudio';
import type { TopicNode } from '../lib/types';
import {
  Badge,
  Bar,
  Button,
  Drawer,
  Grid,
  KeyVal,
  Metric,
  Mono,
  Note,
  Page,
  Panel,
  Status,
  Tabs,
  Term,
} from '../ui/kit';

/** Accuracy buckets — how live play is distributed, not a target. */
const DISTRIBUTION = [
  { band: 'Надто складні · до 40%', count: 118, tone: 'bad' as const },
  { band: 'Складні · 40–60%', count: 402, tone: 'warn' as const },
  { band: 'Норма · 60–85%', count: 2860, tone: 'good' as const },
  { band: 'Легкі · 85–95%', count: 580, tone: 'warn' as const },
  { band: 'Надто легкі · від 95%', count: 140, tone: 'bad' as const },
];

const BAND_COLOR = {
  good: 'var(--p-success)',
  warn: 'var(--p-gold)',
  bad: 'var(--p-danger)',
} as const;

function accuracyTone(value: number | null) {
  if (value === null) return 'neutral' as const;
  if (value < 0.6) return 'danger' as const;
  if (value > 0.9) return 'gold' as const;
  return 'success' as const;
}

const COLS = '1fr 200px 170px';

export function Library() {
  const navigate = useNavigate();
  const can = useCan();
  const [tab, setTab] = useState<'topics' | 'quality'>('topics');
  const [open, setOpen] = useState<TopicNode | null>(null);

  const leaves = TOPIC_TREE.flatMap((r) => r.children ?? []);
  const orphans = leaves.filter((t) => t.pool.published === 0);
  const openDrafts = open ? DRAFTS.filter((d) => d.topicId === open.id) : [];

  return (
    <Page
      wide
      title="Бібліотека"
      actions={
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'topics', label: 'Теми', count: leaves.length },
            { value: 'quality', label: 'Якість' },
          ]}
        />
      }
    >
      {tab === 'topics' ? (
        <>
          <Panel flush>
            <Grid head cols={COLS}>
              <span>Тема</span>
              <span>
                <Term k="coverage">Наповненість</Term>
              </span>
              <span>Стан</span>
            </Grid>

            {TOPIC_TREE.map((root) => (
              <div key={root.id}>
                <Grid cols={COLS} className="bg-[var(--s-panel-2)]">
                  <span className="font-display text-[14px] font-semibold">{root.title}</span>
                  <span className="studio-num text-[12.5px] text-muted">
                    {root.pool.published.toLocaleString('uk-UA')} питань
                  </span>
                  <span />
                </Grid>

                {(root.children ?? []).map((node) => (
                  <Grid key={node.id} cols={COLS} onClick={() => setOpen(node)}>
                    <span className="min-w-0 pl-5">
                      <span className="block truncate font-medium">{node.title}</span>
                      <span className="block truncate text-[12px] text-faint">{node.reference}</span>
                    </span>
                    <span className="min-w-0">
                      <Bar value={node.pool.published} max={node.pool.target} />
                      <span className="studio-num mt-1 block text-[12px] text-faint">
                        {node.pool.published} з {node.pool.target}
                      </span>
                    </span>
                    <span className="flex min-w-0 flex-wrap gap-1">
                      {node.pool.published === 0 ? (
                        <Badge tone="danger">порожня</Badge>
                      ) : node.flags.length > 0 ? (
                        <Badge tone="gold">{node.flags[0]}</Badge>
                      ) : (
                        <Badge tone="success">усе гаразд</Badge>
                      )}
                    </span>
                  </Grid>
                ))}
              </div>
            ))}
          </Panel>

          {orphans.length > 0 && (
            <Note tone="danger" className="mt-3">
              <Term k="orphan">Сирота</Term>: тему «{orphans[0].title}» створено, але питань до неї
              немає — у грі вона не зʼявиться. Або згенерувати пул, або прибрати тему.
            </Note>
          )}
        </>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-3 gap-3">
            {QUALITY_METRICS.slice(0, 3).map((m) => (
              <Metric
                key={m.id}
                label={m.label}
                value={m.value}
                delta={m.delta}
                tone={m.tone}
                hint={m.hint}
              />
            ))}
          </div>

          <div className="grid items-start gap-4 @min-[900px]:grid-cols-2">
            <Panel title={<Term k="accuracy">Як відповідають гравці</Term>}>
              <div className="grid gap-2.5">
                {DISTRIBUTION.map((d) => (
                  <div key={d.band}>
                    <div className="mb-1 flex items-baseline justify-between">
                      <span className="text-[12.5px] text-muted">{d.band}</span>
                      <span className="studio-num text-[12.5px] font-semibold">
                        {d.count.toLocaleString('uk-UA')}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-line-strong">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(d.count / 2860) * 100}%`,
                          background: BAND_COLOR[d.tone],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 border-t border-line pt-3 text-[12px] leading-relaxed text-faint">
                Погані обидва хвости: 18% правильних означає, що питання
                незрозуміле, а 97% — що воно нічого не перевіряє.
              </p>
            </Panel>

            <Panel title="Питання, які варто переробити" flush>
              {QUALITY_OUTLIERS.map((o) => (
                <div key={o.id} className="border-b border-line px-4 py-2.5 last:border-b-0">
                  <p className="truncate text-[13px] font-medium">{o.question}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="studio-num text-[12px] text-faint">
                      {Math.round(o.accuracy * 100)}% правильних
                    </span>
                    <Badge tone={o.accuracy < 0.3 || o.accuracy > 0.95 ? 'danger' : 'gold'}>
                      {o.issue}
                    </Badge>
                  </div>
                </div>
              ))}
              <div className="px-4 py-2.5">
                <Link to="../jobs/new">
                  <Button
                    variant="ghost"
                    denied={can('job.run') ? null : 'Потрібне право запускати AI'}
                  >
                    Виправити через AI
                  </Button>
                </Link>
              </div>
            </Panel>
          </div>

          <Note className="mt-3">
            Рахуються лише події гри: старт, відповідь, скарга. Персональних даних
            тут немає.
          </Note>
        </>
      )}

      <Drawer
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        title={open?.title ?? ''}
        subtitle={open?.reference}
        status={
          open && (
            <Badge tone={accuracyTone(open.accuracy)}>
              {open.accuracy === null ? 'немає даних' : `${Math.round(open.accuracy * 100)}%`}
            </Badge>
          )
        }
        footer={
          <>
            <Link to="../jobs/new">
              <Button
                variant="primary"
                denied={can('job.run') ? null : 'Потрібне право запускати AI'}
              >
                <Sparkles size={13} />
                Догенерувати
              </Button>
            </Link>
            {openDrafts.length > 0 && (
              <Button
                variant="quiet"
                className="ml-auto"
                onClick={() => navigate('../review')}
              >
                До черги
                <ArrowRight size={13} />
              </Button>
            )}
          </>
        }
      >
        {open && (
          <>
            <div className="mb-3">
              <Bar value={open.pool.published} max={open.pool.target} />
              <p className="studio-num mt-1.5 text-[12.5px] text-muted">
                {open.pool.published} з {open.pool.target} питань
                {open.pool.inReview > 0 && (
                  <span className="text-gold-ink"> · {open.pool.inReview} у черзі</span>
                )}
              </p>
            </div>

            {open.flags.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {open.flags.map((f) => (
                  <Badge key={f} tone={f.startsWith('сирота') ? 'danger' : 'gold'}>
                    {f}
                  </Badge>
                ))}
              </div>
            )}

            {openDrafts.length > 0 && (
              <>
                <p className="mt-4 mb-2 text-[11.5px] font-semibold tracking-[0.02em] text-faint uppercase">
                  Чернетки цієї теми
                </p>
                <ul className="grid gap-1.5">
                  {openDrafts.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center gap-2 rounded-[var(--s-radius-sm)] border border-line px-2.5 py-1.5"
                    >
                      <span className="min-w-0 flex-1 truncate text-[12.5px]">{d.title}</span>
                      <Status value={d.status} />
                    </li>
                  ))}
                </ul>
              </>
            )}

            <dl className="mt-4 border-t border-line pt-2">
              <KeyVal k="Ідентифікатор" v={<Mono className="text-muted">{open.id}</Mono>} />
              <KeyVal k="Оновлено" v={open.updatedAt} />
              <KeyVal
                k={<Term k="accuracy">Правильність</Term>}
                v={open.accuracy === null ? 'немає даних' : `${Math.round(open.accuracy * 100)}%`}
              />
            </dl>
          </>
        )}
      </Drawer>
    </Page>
  );
}
