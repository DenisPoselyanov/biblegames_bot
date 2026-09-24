import { useState } from 'react';
import { Rocket, Undo2 } from 'lucide-react';
import { AUDIT, DRAFTS, RELEASES, ROLE_LABEL } from '../lib/mock';
import { plural } from '../lib/plural';
import { useCan, useStudio } from '../lib/useStudio';
import type { Release } from '../lib/types';
import { cn } from '../../ui/cn';
import {
  NARROW_ONLY,
  WIDE_ONLY,
  Badge,
  Button,
  Drawer,
  Grid,
  KeyVal,
  Mono,
  Note,
  Page,
  Panel,
  Status,
  Tabs,
  Term,
} from '../ui/kit';

/** Actions that changed what players see get a stronger badge than routine ones. */
function actionTone(action: string) {
  if (action.startsWith('content.')) return 'gold' as const;
  if (action.includes('reject') || action.includes('budget_exceeded')) return 'danger' as const;
  if (action.includes('approve')) return 'success' as const;
  return 'neutral' as const;
}

export function Releases() {
  const { role, env } = useStudio();
  const can = useCan();
  const [tab, setTab] = useState<'releases' | 'log'>('releases');
  const [open, setOpen] = useState<Release | null>(null);

  const approved = DRAFTS.filter((d) => d.status === 'approved');

  const publishDenied = !can('content.publish')
    ? `Роль «${ROLE_LABEL[role]}» не публікує контент`
    : env !== 'production'
      ? 'Сесія дивиться на staging — перемкни середовище в шапці'
      : approved.length === 0
        ? 'Немає схвалених позицій'
        : null;

  const rollbackDenied = (release: Release | null) =>
    !release
      ? 'Нічого не вибрано'
      : !can('content.rollback')
        ? `Роль «${ROLE_LABEL[role]}» не відкочує випуски`
        : !release.canRollback
          ? 'Цей випуск уже не можна відкотити'
          : null;

  return (
    <Page
      wide
      title="Випуск"
      actions={
        <>
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { value: 'releases', label: 'Випуски', count: RELEASES.length },
              { value: 'log', label: 'Журнал', count: AUDIT.length },
            ]}
          />
          {tab === 'releases' && (
            <Button variant="primary" size="md" denied={publishDenied}>
              <Rocket size={14} />
              Опублікувати {approved.length}
            </Button>
          )}
        </>
      }
    >
      {tab === 'releases' ? (
        <>
          <Panel flush>
            <Grid head cols="1fr 170px 120px 150px">
              <span>Випуск</span>
              <span>Коли</span>
              <span>Позицій</span>
              <span>Стан</span>
            </Grid>
            {RELEASES.map((r) => (
              <Grid key={r.id} cols="1fr 170px 120px 150px" onClick={() => setOpen(r)}>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{r.version}</span>
                  <span className="block truncate text-[12px] text-faint">{r.topics.join(', ')}</span>
                </span>
                <Mono className="text-muted">{r.publishedAt}</Mono>
                <span className="studio-num text-[12.5px]">{r.items}</span>
                <Status value={r.status} />
              </Grid>
            ))}
          </Panel>

          <Note className="mt-3">
            Публікація — окрема дія з окремим правом. Кожна позиція зберігає всі
            свої <Term k="revision">ревізії</Term>, тому{' '}
            <Term k="rollback">відкат</Term> робиться однією дією, без ручного
            редагування файлів.
          </Note>
        </>
      ) : (
        <>
          <Panel flush>
            <Grid head cols="160px 150px 190px 1fr" narrow="150px 170px 1fr">
              <span>Коли</span>
              <span className={WIDE_ONLY}>Хто</span>
              <span>Що зробив</span>
              <span>Деталі</span>
            </Grid>
            {AUDIT.map((a) => (
              <Grid key={a.id} cols="160px 150px 190px 1fr" narrow="150px 170px 1fr">
                <span className="min-w-0">
                  <Mono className="text-muted">{a.at}</Mono>
                  {/* Narrow: who did it folds under when. */}
                  <span className={cn('block truncate text-[11.5px] text-faint', NARROW_ONLY)}>
                    {a.actor}
                  </span>
                </span>
                <span className={cn('min-w-0', WIDE_ONLY)}>
                  <span className="block truncate text-[12.5px]">{a.actor}</span>
                  <span className="block text-[11.5px] text-faint">{ROLE_LABEL[a.role]}</span>
                </span>
                <Badge tone={actionTone(a.action)}>{a.action}</Badge>
                <span className="truncate text-[12.5px] text-muted" title={a.detail}>
                  {a.detail}
                </span>
              </Grid>
            ))}
          </Panel>

          <Note className="mt-3">
            <Term k="audit">Журнал</Term> доповнюється, але не редагується. Відмови
            в доступі записуються так само, як успішні дії — останній рядок саме
            такий.
          </Note>
        </>
      )}

      <Drawer
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        title={open?.version ?? ''}
        subtitle={open?.topics.join(', ')}
        status={open && <Status value={open.status} />}
        footer={
          <Button variant="danger" denied={rollbackDenied(open)}>
            <Undo2 size={13} />
            Відкотити
          </Button>
        }
      >
        {open && (
          <>
            <p className="text-[13px] leading-relaxed text-muted">{open.note}</p>
            <dl className="mt-4">
              <KeyVal k="Опубліковано" v={open.publishedAt} />
              <KeyVal k="Хто" v={open.publishedBy} />
              <KeyVal
                k="Позицій"
                v={`${open.items} ${plural(open.items, 'позиція', 'позиції', 'позицій')}`}
              />
              <KeyVal k="Теми" v={open.topics.join(', ')} />
              <KeyVal k="Ідентифікатор" v={<Mono className="text-muted">{open.id}</Mono>} />
            </dl>
          </>
        )}
      </Drawer>
    </Page>
  );
}
