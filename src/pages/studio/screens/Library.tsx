import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useLibraryQuery, useQualityQuery, useRepairOutlierMutation } from '../lib/queries';
import { plural } from '../lib/plural';
import { useCan } from '../lib/useStudio';
import type { AccuracyBand, FindingSummary, LibraryTheme, StatusCounts } from '../../../repos/studioRepo';
import {
  Badge,
  Button,
  Chip,
  Drawer,
  Grid,
  KeyVal,
  Metric,
  Mono,
  NARROW_ONLY,
  Note,
  Page,
  Panel,
  Status,
  Term,
  Toolbar,
  WIDE_ONLY,
} from '../ui/kit';
import { cn } from '../ui/cn';

/**
 * Library (Phase 4 WS8c) — ported from the design prototype's `library`
 * screen. Two views of the same bank: «Теми» (what players can actually get,
 * per theme) and «Якість» (what the automatic checks found).
 *
 * Deliberately not ported: the prototype's per-topic *target* pool size (no
 * such number exists anywhere in the product — inventing one would be the
 * "fake progress" §3 forbids). The gameplay-accuracy distribution and the
 * outlier list come from WS9's `/studio/quality` aggregation over recorded
 * answers — real counts only, empty until players have answered enough.
 */

const COLS = '1fr 110px 110px 110px 150px';
/* Narrow: «Не перевірено» folds under the theme name. */
const COLS_NARROW = '1fr 80px 90px 130px';

const OUTLIER_COLS = '1fr 120px 120px 190px';
const OUTLIER_COLS_NARROW = '1fr 100px 190px';

/** Waiting on a person: everything that exists but isn't live and isn't blocked. */
const inQueue = (c: StatusCounts) => c.draft + c.ready_for_review;

type ThemeFlag = { label: string; tone: 'danger' | 'gold' | 'success' | 'neutral' };

function flagOf(t: LibraryTheme): ThemeFlag {
  if (!t.inCatalog) return { label: 'немає в каталозі', tone: 'danger' };
  if (t.counts.published === 0) {
    return t.counts.legacy_unreviewed > 0
      ? { label: 'лише неперевірені', tone: 'gold' }
      : { label: 'порожня', tone: 'danger' };
  }
  if (t.counts.quarantined > 0) return { label: `${t.counts.quarantined} у карантині`, tone: 'gold' };
  return { label: 'усе гаразд', tone: 'success' };
}

type Filter = 'all' | 'empty' | 'queue';

export function Library() {
  const query = useLibraryQuery();
  const [tab, setTab] = useState<'topics' | 'quality'>('topics');
  const data = query.data;

  return (
    <Page
      wide
      title="Бібліотека"
      actions={
        <Toolbar>
          <Chip active={tab === 'topics'} onClick={() => setTab('topics')} count={data?.themes.length}>
            Теми
          </Chip>
          <Chip active={tab === 'quality'} onClick={() => setTab('quality')}>
            Якість
          </Chip>
        </Toolbar>
      }
    >
      {query.isError ? (
        <Note tone="danger">Не вдалося завантажити бібліотеку: {(query.error as Error).message}</Note>
      ) : data && !data.available ? (
        <Note tone="danger">
          Бібліотека недоступна в цьому середовищі: сервер працює без бази даних, тож ревізій немає.
          Це не «порожній банк» — дані просто не підключено.
        </Note>
      ) : !data ? (
        <p className="py-10 text-center text-[13px] text-faint">Завантажую…</p>
      ) : tab === 'topics' ? (
        <Topics themes={data.themes} />
      ) : (
        <Quality findings={data.findings} themes={data.themes} />
      )}
    </Page>
  );
}

function Topics({ themes }: { themes: LibraryTheme[] }) {
  const navigate = useNavigate();
  const can = useCan();
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<LibraryTheme | null>(null);

  const empty = themes.filter((t) => t.inCatalog && t.counts.published === 0);
  const queued = themes.filter((t) => inQueue(t.counts) > 0);
  const visible = filter === 'empty' ? empty : filter === 'queue' ? queued : themes;

  // Catalog order within each category, uncatalogued ids last — the same order players browse in.
  const groups = useMemo(() => {
    const byCategory = new Map<string, { title: string; rows: LibraryTheme[] }>();
    for (const t of visible) {
      const key = t.categoryId ?? '__none';
      const group = byCategory.get(key) ?? { title: t.categoryTitle ?? 'Поза каталогом', rows: [] };
      group.rows.push(t);
      byCategory.set(key, group);
    }
    return [...byCategory.entries()].sort(([a], [b]) => (a === '__none' ? 1 : b === '__none' ? -1 : 0));
  }, [visible]);

  return (
    <>
      <Toolbar className="mb-2">
        <Chip active={filter === 'all'} onClick={() => setFilter('all')} count={themes.length}>
          Усі
        </Chip>
        <Chip active={filter === 'empty'} onClick={() => setFilter('empty')} count={empty.length}>
          Без опублікованих
        </Chip>
        <Chip active={filter === 'queue'} onClick={() => setFilter('queue')} count={queued.length}>
          Є в черзі
        </Chip>
      </Toolbar>

      <Panel flush>
        <Grid head cols={COLS} narrow={COLS_NARROW}>
          <span>Тема</span>
          <span>
            <Term k="coverage">У грі</Term>
          </span>
          <span>У черзі</span>
          <span className={WIDE_ONLY}>Не перевірено</span>
          <span>Стан</span>
        </Grid>
        {groups.length === 0 && (
          <p className="px-4 py-8 text-center text-[13px] text-faint">Під цей фільтр нічого не підпадає.</p>
        )}
        {groups.map(([key, group]) => (
          <div key={key}>
            <Grid cols={COLS} narrow={COLS_NARROW} className="bg-[var(--s-panel-2)]">
              <span className="font-display text-[14px] font-semibold">{group.title}</span>
              <span className="studio-num text-[12.5px] text-muted">
                {group.rows.reduce((n, t) => n + t.counts.published, 0).toLocaleString('uk-UA')}
              </span>
              <span />
              <span className={WIDE_ONLY} />
              <span />
            </Grid>
            {group.rows.map((t) => {
              const flag = flagOf(t);
              return (
                <Grid
                  key={t.themeId}
                  cols={COLS}
                  narrow={COLS_NARROW}
                  onClick={() => setOpen(t)}
                  active={open?.themeId === t.themeId}
                >
                  <span className="min-w-0 pl-5">
                    <span className="block truncate font-medium">{t.title}</span>
                    <Mono className="block truncate text-[11.5px]">{t.themeId}</Mono>
                    {t.counts.legacy_unreviewed > 0 && (
                      <span className={cn('block text-[11.5px] text-faint', NARROW_ONLY)}>
                        не перевірено: {t.counts.legacy_unreviewed.toLocaleString('uk-UA')}
                      </span>
                    )}
                  </span>
                  <span className="studio-num">{t.counts.published.toLocaleString('uk-UA')}</span>
                  <span className="studio-num text-muted">{inQueue(t.counts) || '—'}</span>
                  <span className={cn('studio-num text-muted', WIDE_ONLY)}>
                    {t.counts.legacy_unreviewed || '—'}
                  </span>
                  <span>
                    <Badge tone={flag.tone}>{flag.label}</Badge>
                  </span>
                </Grid>
              );
            })}
          </div>
        ))}
      </Panel>

      {empty.length > 0 && filter === 'all' && (
        <Note tone="danger" className="mt-3">
          <Term k="orphan">Сироти</Term>: {empty.length}{' '}
          {plural(empty.length, 'тема є', 'теми є', 'тем є')} у каталозі, але без жодного опублікованого
          питання — гравці їх бачать, а зіграти не можуть. Наприклад, «{empty[0].title}».
        </Note>
      )}

      <Drawer
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        title={open?.title ?? ''}
        subtitle={open?.categoryTitle ?? 'Поза каталогом'}
        status={open && <Badge tone={flagOf(open).tone}>{flagOf(open).label}</Badge>}
        footer={
          <>
            <Link to="/studio/jobs/new">
              <Button variant="primary" denied={can('content:ai:run') ? null : 'Ваша роль не запускає AI'}>
                <Sparkles size={13} />
                Догенерувати
              </Button>
            </Link>
            {open && inQueue(open.counts) > 0 && (
              <Button variant="quiet" className="ml-auto" onClick={() => navigate('/studio/review')}>
                До черги
                <ArrowRight size={13} />
              </Button>
            )}
          </>
        }
      >
        {open && (
          <>
            <dl>
              {(
                [
                  'published',
                  'ready_for_review',
                  'draft',
                  'legacy_unreviewed',
                  'quarantined',
                  'archived',
                ] as const
              ).map((s) => (
                <KeyVal key={s} k={<Status value={s} />} v={<span className="studio-num">{open.counts[s]}</span>} />
              ))}
            </dl>
            {!open.inCatalog && (
              <Note tone="danger" className="mt-3">
                У базі є питання з темою «{open.themeId}», але такої теми немає в каталозі гри — гравці до
                них не дістануться. Або додати тему в каталог, або перенести питання.
              </Note>
            )}
            <p className="mt-3 text-[12px] leading-relaxed text-faint">
              Рахуються ревізії, а не питання: у питання може бути одночасно опублікована ревізія і
              чернетка нової. «В архіві» — замінені старі ревізії, вони зберігаються для{' '}
              <Term k="rollback">відкату</Term>.
            </p>
          </>
        )}
      </Drawer>
    </>
  );
}

function Quality({ findings, themes }: { findings: FindingSummary[]; themes: LibraryTheme[] }) {
  const total = themes.reduce(
    (acc, t) => ({
      published: acc.published + t.counts.published,
      legacy: acc.legacy + t.counts.legacy_unreviewed,
      quarantined: acc.quarantined + t.counts.quarantined,
    }),
    { published: 0, legacy: 0, quarantined: 0 },
  );
  const blocking = findings.filter((f) => f.severity === 'blocking').reduce((n, f) => n + f.revisions, 0);

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 @min-[900px]:grid-cols-4">
        <Metric label="У грі" value={total.published.toLocaleString('uk-UA')} hint="Опубліковані ревізії питань" />
        <Metric
          label="Не перевірено"
          value={total.legacy.toLocaleString('uk-UA')}
          tone={total.legacy > 0 ? 'warn' : 'neutral'}
          delta={total.legacy > 0 ? 'legacy-банк чекає ревʼю' : undefined}
        />
        <Metric
          label="Карантин"
          value={total.quarantined.toLocaleString('uk-UA')}
          tone={total.quarantined > 0 ? 'bad' : 'neutral'}
        />
        <Metric
          label={<Term k="check">Блокують</Term>}
          value={blocking.toLocaleString('uk-UA')}
          tone={blocking > 0 ? 'bad' : 'good'}
          delta={blocking > 0 ? 'ревізій з блокерами' : 'блокерів немає'}
        />
      </div>

      <div className="grid items-start gap-4 @min-[900px]:grid-cols-[1.4fr_1fr]">
        <Panel title="Що знайшли автоматичні перевірки" flush>
          {findings.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-faint">
              Перевірки ще нічого не записали — або все чисто, або перевірку ще не запускали.
            </p>
          ) : (
            <>
              <Grid head cols="1fr 90px 110px">
                <span>Правило</span>
                <span>Що</span>
                <span>Ревізій</span>
              </Grid>
              {findings.map((f) => (
                <Grid key={`${f.revisionType}-${f.kind}-${f.severity}`} cols="1fr 90px 110px">
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <Status value={f.severity} />
                      <span className="truncate font-medium">{f.label}</span>
                    </span>
                    <Mono className="mt-0.5 block text-[11.5px]">{f.kind}</Mono>
                  </span>
                  <span className="text-[12.5px] text-muted">{f.revisionType === 'question' ? 'питання' : 'уроки'}</span>
                  <span className="studio-num">{f.revisions.toLocaleString('uk-UA')}</span>
                </Grid>
              ))}
            </>
          )}
        </Panel>

        <PlayerAccuracy />
      </div>

      <Outliers />

      <Note className="mt-3">
        Кожна ревізія зберігає лише результат своєї останньої перевірки. Щоб побачити конкретні позиції —
        відкрийте <Link to="/studio/review" className="font-semibold text-indigo underline underline-offset-2">чергу</Link>.
      </Note>
    </>
  );
}

const BAND_LABEL: Record<AccuracyBand, string> = {
  too_hard: 'Надто складні · до 40%',
  hard: 'Складні · 40–60%',
  normal: 'Норма · 60–85%',
  easy: 'Легкі · 85–95%',
  too_easy: 'Надто легкі · від 95%',
};

const BAND_COLOR: Record<AccuracyBand, string> = {
  too_hard: 'var(--p-danger)',
  hard: 'var(--p-gold)',
  normal: 'var(--p-success)',
  easy: 'var(--p-gold)',
  too_easy: 'var(--p-danger)',
};

const pct = (share: number) => `${Math.round(share * 100)}%`;

function PlayerAccuracy() {
  const query = useQualityQuery();
  const analysis = query.data?.analysis;
  const bias = query.data?.positionBias;
  const max = Math.max(1, ...(analysis?.distribution.map((d) => d.count) ?? [1]));

  return (
    <Panel title={<Term k="accuracy">Як відповідають гравці</Term>}>
      {!query.data ? (
        <p className="text-[13px] text-faint">{query.isError ? (query.error as Error).message : 'Завантажую…'}</p>
      ) : !query.data.available || !analysis ? (
        <p className="text-[13px] text-muted">Статистика недоступна: сервер працює без бази даних.</p>
      ) : analysis.sampleSize === 0 ? (
        <p className="text-[13px] leading-relaxed text-muted">
          Ще немає жодного питання з {analysis.minAttempts}+ відповідями гравців — розподіл зʼявиться, щойно
          назбирається достатньо відповідей. Менше — це шум, а не сигнал.
        </p>
      ) : (
        <div className="grid gap-2.5">
          {analysis.distribution.map((d) => (
            <div key={d.band}>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-[12.5px] text-muted">{BAND_LABEL[d.band]}</span>
                <span className="studio-num text-[12.5px] font-semibold">{d.count.toLocaleString('uk-UA')}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-line-strong">
                <div className="h-full rounded-full" style={{ width: `${(d.count / max) * 100}%`, background: BAND_COLOR[d.band] }} />
              </div>
            </div>
          ))}
          <p className="text-[12px] text-faint">
            {analysis.sampleSize.toLocaleString('uk-UA')} питань із {analysis.minAttempts}+ відповідями.
          </p>
        </div>
      )}
      {bias && bias.picks > 0 && (
        <p className="mt-3 border-t border-line pt-3 text-[12.5px] leading-relaxed text-muted">
          Перший варіант обирають у <b className="studio-num">{pct(bias.firstOptionShare)}</b> випадків; без
          ефекту позиції було б близько <span className="studio-num">{pct(bias.expectedShare)}</span> (
          {bias.picks.toLocaleString('uk-UA')} виборів у практиці).
        </p>
      )}
      <p className="mt-3 border-t border-line pt-3 text-[12px] leading-relaxed text-faint">
        Погані обидва хвости: 18% правильних означає, що питання незрозуміле, а 97% — що воно нічого не
        перевіряє. Рахуються лише відповіді — без персональних даних.
      </p>
    </Panel>
  );
}

function Outliers() {
  const can = useCan();
  const query = useQualityQuery();
  const repair = useRepairOutlierMutation();
  const outliers = query.data?.analysis?.outliers ?? [];
  if (outliers.length === 0) return null;

  return (
    <Panel
      className="mt-4"
      title="Питання, які варто переробити"
      subtitle={`${query.data?.analysis?.outlierTotal ?? outliers.length} за відповідями гравців`}
      flush
    >
      {repair.isError && (
        <p className="border-b border-line px-4 py-2 text-[12.5px] text-danger">{(repair.error as Error).message}</p>
      )}
      {repair.data && (
        <p className="border-b border-line px-4 py-2 text-[12.5px] text-success">
          Завдання створено —{' '}
          <Link to={`/studio/jobs/${repair.data.jobId}`} className="font-semibold underline underline-offset-2">
            відкрити
          </Link>
          . Результат буде пропозицією для ревʼю, а не зміною в грі.
        </p>
      )}
      <Grid head cols={OUTLIER_COLS} narrow={OUTLIER_COLS_NARROW}>
        <span>Питання</span>
        <span>Правильних</span>
        <span className={WIDE_ONLY}>Відповідей</span>
        <span />
      </Grid>
      {outliers.map((o) => (
        <Grid key={o.questionId} cols={OUTLIER_COLS} narrow={OUTLIER_COLS_NARROW}>
          <span className="min-w-0">
            <span className="block truncate font-medium">{o.text ?? o.questionId}</span>
            <span className="mt-0.5 flex items-center gap-2">
              <Badge tone="danger">{o.issue === 'too_hard' ? 'надто складне' : 'надто легке'}</Badge>
              <Mono className="truncate text-[11.5px]">{o.questionId}</Mono>
            </span>
          </span>
          <span className="studio-num">
            {pct(o.accuracy)}
            {/* Narrow: the answer count folds under the share it is out of. */}
            <span className={cn('block text-[11.5px] text-faint', NARROW_ONLY)}>
              з {o.attempts.toLocaleString('uk-UA')}
            </span>
          </span>
          <span className={cn('studio-num text-muted', WIDE_ONLY)}>{o.attempts.toLocaleString('uk-UA')}</span>
          <span className="justify-self-end">
            <Button
              variant="ghost"
              denied={
                !can('content:ai:run')
                  ? 'Ваша роль не запускає AI'
                  : !o.revisionId
                    ? 'Цього питання немає в банку ревізій'
                    : repair.isPending
                      ? 'Створюю…'
                      : null
              }
              onClick={() => repair.mutate(o.questionId)}
            >
              <Sparkles size={13} />
              Виправити через AI
            </Button>
          </span>
        </Grid>
      ))}
    </Panel>
  );
}
