import { QUALITY_METRICS, QUALITY_OUTLIERS, TOPIC_TREE } from '../lib/mock';
import { Badge, Bar, Grid, Metric, Mono, Page, Panel } from '../ui/kit';

/** Accuracy buckets — how live play is distributed, not a target. */
const DISTRIBUTION = [
  { band: '0–40% · надто складні', count: 118, tone: 'bad' as const },
  { band: '40–60% · складні', count: 402, tone: 'warn' as const },
  { band: '60–85% · норма', count: 2860, tone: 'good' as const },
  { band: '85–95% · легкі', count: 580, tone: 'warn' as const },
  { band: '95–100% · надто легкі', count: 140, tone: 'bad' as const },
];

const TONE_TEXT = {
  good: 'text-success',
  warn: 'text-gold-ink',
  bad: 'text-danger',
  neutral: 'text-muted',
} as const;

export function Quality() {
  const max = Math.max(...DISTRIBUTION.map((d) => d.count));
  const leaves = TOPIC_TREE.flatMap((r) => r.children ?? []).filter((t) => t.accuracy !== null);
  const worst = [...leaves].sort((a, b) => (a.accuracy ?? 1) - (b.accuracy ?? 1)).slice(0, 5);

  return (
    <Page
      wide
      title="Якість контенту"
      subtitle="Як опубліковані питання поводяться у грі. Джерело правди для наступного джоба ремонту."
    >
      <div className="mb-4 grid grid-cols-6 gap-3">
        {QUALITY_METRICS.map((m) => (
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

      <div className="grid grid-cols-[1fr_1fr] items-start gap-4">
        <Panel title="Розподіл правильності" subtitle="4 100 опублікованих питань">
          <div className="grid gap-2.5">
            {DISTRIBUTION.map((d) => (
              <div key={d.band}>
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-[12.5px] text-muted">{d.band}</span>
                  <span className={`studio-num text-[12.5px] font-semibold ${TONE_TEXT[d.tone]}`}>
                    {d.count.toLocaleString('uk-UA')}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-line-strong">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(d.count / max) * 100}%`,
                      background:
                        d.tone === 'good'
                          ? 'var(--p-success)'
                          : d.tone === 'warn'
                            ? 'var(--p-gold)'
                            : 'var(--p-danger)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 border-t border-line pt-3 text-[12px] leading-relaxed text-faint">
            Хвости з обох боків однаково погані: 18% правильних означає, що
            питання незрозуміле, а 97% — що воно нічого не перевіряє.
          </p>
        </Panel>

        <Panel title="Найслабші теми" subtitle="За правильністю в живій грі" flush>
          <Grid head cols="1fr 110px 120px">
            <span>Тема</span>
            <span>Правильність</span>
            <span>Пул</span>
          </Grid>
          {worst.map((t) => (
            <Grid key={t.id} cols="1fr 110px 120px">
              <span className="min-w-0">
                <span className="block truncate font-medium">{t.title}</span>
                <Mono>{t.reference}</Mono>
              </span>
              <span className="min-w-0">
                <Bar value={t.accuracy ?? 0} max={1} />
                <Mono className="mt-1 block">{Math.round((t.accuracy ?? 0) * 100)}%</Mono>
              </span>
              <span className="studio-num text-[12.5px] text-muted">
                {t.pool.published} питань
              </span>
            </Grid>
          ))}
        </Panel>
      </div>

      <Panel className="mt-4" title="Питання, що випадають із норми" flush>
        <Grid head cols="1fr 190px 120px 110px 1fr">
          <span>Питання</span>
          <span>Тема</span>
          <span>Правильність</span>
          <span>Зіграно</span>
          <span>Чому в списку</span>
        </Grid>
        {QUALITY_OUTLIERS.map((o) => (
          <Grid key={o.id} cols="1fr 190px 120px 110px 1fr">
            <span className="min-w-0">
              <span className="block truncate font-medium">{o.question}</span>
              <Mono>{o.id}</Mono>
            </span>
            <span className="truncate text-[12.5px] text-muted">{o.topic}</span>
            <span className="min-w-0">
              <Bar value={o.accuracy} max={1} />
              <Mono className="mt-1 block">{Math.round(o.accuracy * 100)}%</Mono>
            </span>
            <span className="studio-num text-[12.5px] text-muted">
              {o.plays.toLocaleString('uk-UA')}
            </span>
            <span className="flex min-w-0 items-center">
              <Badge tone={o.accuracy < 0.3 || o.accuracy > 0.95 ? 'danger' : 'gold'}>
                {o.issue}
              </Badge>
            </span>
          </Grid>
        ))}
      </Panel>

      <p className="mt-3 text-[12px] text-faint">
        Аналітика рахує лише події гри: старт, відповідь, скарга. Ніяких
        персональних даних тут немає й не має бути.
      </p>
    </Page>
  );
}
