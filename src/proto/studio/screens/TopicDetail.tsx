import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, FileQuestion, Sparkles } from 'lucide-react';
import { DRAFTS, TOPIC_TREE } from '../lib/mock';
import { useCan } from '../lib/useStudio';
import {
  Badge,
  Bar,
  Button,
  EmptyState,
  Grid,
  KeyVal,
  Metric,
  Mono,
  Page,
  Panel,
  Status,
} from '../ui/kit';

/** A believable published pool for a topic — the prototype does not ship 300 rows. */
const SAMPLE_PUBLISHED = [
  { id: 'q-3181', prompt: 'Хто хрестив Ісуса в Йордані?', difficulty: 'easy', accuracy: 0.92, reference: 'Мт 3:13-17' },
  { id: 'q-3182', prompt: 'Скільки днів Ісус постив у пустелі?', difficulty: 'easy', accuracy: 0.88, reference: 'Мт 4:2' },
  { id: 'q-3183', prompt: 'Яке перше чудо здійснив Ісус?', difficulty: 'medium', accuracy: 0.74, reference: 'Ів 2:1-11' },
  { id: 'q-3184', prompt: 'Кому Ісус сказав «народитися згори»?', difficulty: 'medium', accuracy: 0.61, reference: 'Ів 3:3' },
  { id: 'q-3185', prompt: 'Біля якого колодязя Ісус говорив із самарянкою?', difficulty: 'hard', accuracy: 0.47, reference: 'Ів 4:6' },
];

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: 'легке',
  medium: 'середнє',
  hard: 'складне',
};

export function TopicDetail() {
  const { topicId } = useParams();
  const can = useCan();

  const parent = TOPIC_TREE.find((r) => (r.children ?? []).some((c) => c.id === topicId));
  const node = parent?.children?.find((c) => c.id === topicId) ?? TOPIC_TREE.find((r) => r.id === topicId);

  if (!node) {
    return (
      <Page title="Тему не знайдено">
        <Panel>
          <EmptyState
            icon={<FileQuestion size={18} />}
            title="Такої теми немає"
            body="Можливо, її перейменували або обʼєднали з іншою."
            action={
              <Link to="../library">
                <Button variant="ghost">← До бібліотеки</Button>
              </Link>
            }
          />
        </Panel>
      </Page>
    );
  }

  const inReview = DRAFTS.filter((d) => d.topicId === node.id);
  const empty = node.pool.published === 0;

  return (
    <Page
      wide
      title={node.title}
      subtitle={
        <span className="flex items-center gap-2">
          <span>{parent ? `${parent.title} · ` : ''}{node.reference}</span>
          <span>·</span>
          <Mono>{node.id}</Mono>
        </span>
      }
      actions={
        <>
          <Link to="../library">
            <Button variant="quiet">
              <ArrowLeft size={14} />
              До бібліотеки
            </Button>
          </Link>
          <Link to="../jobs/new">
            <Button
              variant="primary"
              denied={can('job.run') ? null : 'Потрібне право job.run'}
            >
              <Sparkles size={14} />
              Догенерувати питання
            </Button>
          </Link>
        </>
      }
    >
      <div className="mb-4 grid grid-cols-4 gap-3">
        <Metric
          label="Опубліковано"
          value={node.pool.published}
          delta={`ціль ${node.pool.target}`}
          tone={empty ? 'bad' : 'neutral'}
        />
        <Metric label="На ревʼю" value={node.pool.inReview} delta="у черзі студії" tone="warn" />
        <Metric
          label="Правильність"
          value={node.accuracy ? `${Math.round(node.accuracy * 100)}%` : '—'}
          delta="норма 70–85%"
          tone={node.accuracy && node.accuracy > 0.9 ? 'warn' : 'good'}
        />
        <Metric
          label="Покриття пулу"
          value={`${Math.round((node.pool.published / node.pool.target) * 100)}%`}
          delta={`бракує ${Math.max(node.pool.target - node.pool.published, 0)}`}
          tone="neutral"
        />
      </div>

      <div className="grid grid-cols-[1fr_320px] items-start gap-4">
        <div className="flex flex-col gap-4">
          <Panel title="Чернетки цієї теми" flush>
            {inReview.length === 0 ? (
              <p className="px-4 py-6 text-center text-[12.5px] text-faint">
                Активних чернеток немає.
              </p>
            ) : (
              <>
                <Grid head cols="1fr 130px 140px 96px">
                  <span>Позиція</span>
                  <span>Статус</span>
                  <span>Провайдер</span>
                  <span className="text-right">Оновлено</span>
                </Grid>
                {inReview.map((d) => (
                  <Grid key={d.id} cols="1fr 130px 140px 96px">
                    <Link to={`../review/${d.id}`} className="min-w-0">
                      <span className="block truncate font-medium hover:text-indigo">
                        {d.title}
                      </span>
                      <Mono>{d.id}</Mono>
                    </Link>
                    <Status value={d.status} />
                    <Mono>{d.provider}/{d.model}</Mono>
                    <Mono className="text-right">{d.updatedAt.slice(11)}</Mono>
                  </Grid>
                ))}
              </>
            )}
          </Panel>

          <Panel title="Опублікований пул" subtitle="Перші 5 із пулу, сортування за правильністю" flush>
            {empty ? (
              <EmptyState
                icon={<FileQuestion size={18} />}
                title="Пул порожній"
                body="Тему створив конвеєр, але питань до неї ще немає. Поки пул порожній, тема не потрапляє в гру."
                action={
                  <Link to="../jobs/new">
                    <Button
                      variant="primary"
                      denied={can('job.run') ? null : 'Потрібне право job.run'}
                    >
                      Згенерувати перші 20 питань
                    </Button>
                  </Link>
                }
              />
            ) : (
              <>
                <Grid head cols="88px 1fr 120px 110px 110px">
                  <span>ID</span>
                  <span>Питання</span>
                  <span>Посилання</span>
                  <span>Складність</span>
                  <span>Правильність</span>
                </Grid>
                {SAMPLE_PUBLISHED.map((q) => (
                  <Grid key={q.id} cols="88px 1fr 120px 110px 110px">
                    <Mono className="text-muted">{q.id}</Mono>
                    <span className="truncate">{q.prompt}</span>
                    <Mono className="text-gold-ink">{q.reference}</Mono>
                    <span className="text-[12.5px] text-muted">
                      {DIFFICULTY_LABEL[q.difficulty]}
                    </span>
                    <span className="min-w-0">
                      <Bar value={q.accuracy} max={1} />
                      <Mono className="mt-1 block">{Math.round(q.accuracy * 100)}%</Mono>
                    </span>
                  </Grid>
                ))}
              </>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <Panel title="Стан теми">
            <dl>
              <KeyVal k="Ідентифікатор" v={<Mono className="text-muted">{node.id}</Mono>} />
              <KeyVal k="Посилання" v={node.reference} />
              <KeyVal k="Оновлено" v={node.updatedAt} />
              <KeyVal k="Батьківська" v={parent?.title ?? '—'} />
            </dl>
            {node.flags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
                {node.flags.map((f) => (
                  <Badge key={f} tone={f.startsWith('сирота') ? 'danger' : 'gold'}>
                    {f}
                  </Badge>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Що перевіряє студія">
            <ul className="grid gap-2 text-[12.5px] leading-relaxed text-faint">
              <li>· дублікати в межах теми (поріг схожості 0.86)</li>
              <li>· розподіл складності: 40 / 40 / 20</li>
              <li>· кожне питання має посилання на Писання</li>
              <li>· правильна відповідь не концентрується на позиції A</li>
              <li>· сироти: тема без пулу й пул без теми</li>
            </ul>
          </Panel>
        </div>
      </div>
    </Page>
  );
}
