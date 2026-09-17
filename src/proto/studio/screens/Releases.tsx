import { useState } from 'react';
import { Rocket, Undo2 } from 'lucide-react';
import { DRAFTS, RELEASES, ROLE_LABEL } from '../lib/mock';
import { plural } from '../lib/plural';
import { useCan, useStudio } from '../lib/useStudio';
import { Badge, Button, Grid, KeyVal, Metric, Mono, Page, Panel, Status } from '../ui/kit';

const COLS = '1fr 150px 110px 130px 150px';

export function Releases() {
  const { role, env } = useStudio();
  const can = useCan();
  const [selectedId, setSelectedId] = useState(RELEASES[0].id);
  const selected = RELEASES.find((r) => r.id === selectedId) ?? RELEASES[0];

  const approved = DRAFTS.filter((d) => d.status === 'approved');

  const publishDenied = !can('content.publish')
    ? `Роль «${ROLE_LABEL[role]}» не публікує контент`
    : env !== 'production'
      ? 'Сесія вказує на staging — перемкни середовище'
      : approved.length === 0
        ? 'Немає схвалених позицій'
        : null;

  const rollbackDenied = !can('content.rollback')
    ? `Роль «${ROLE_LABEL[role]}» не відкочує релізи`
    : !selected.canRollback
      ? 'Цей реліз уже не можна відкотити'
      : null;

  return (
    <Page
      wide
      title="Релізи контенту"
      subtitle="Публікація — окрема операція. Кожен реліз незмінний і має ревізії, до яких можна повернутися."
      actions={
        <Button variant="primary" size="md" denied={publishDenied}>
          <Rocket size={14} />
          Опублікувати {approved.length}{' '}
          {plural(approved.length, 'схвалену позицію', 'схвалені позиції', 'схвалених позицій')}
        </Button>
      }
    >
      <div className="mb-4 grid grid-cols-4 gap-3">
        <Metric label="Готові до релізу" value={approved.length} delta="схвалені позиції" tone="good" />
        <Metric label="Опубліковано за місяць" value="155" delta="4 релізи" />
        <Metric label="Відкати" value="1" delta="12.09 · 18 позицій" tone="warn" />
        <Metric
          label="Середовище"
          value={env === 'production' ? 'production' : 'staging'}
          delta={env === 'production' ? 'публікація доступна' : 'публікація заблокована'}
          tone={env === 'production' ? 'bad' : 'neutral'}
        />
      </div>

      <div className="grid grid-cols-[1fr_360px] items-start gap-4">
        <Panel title="Історія релізів" flush>
          <Grid head cols={COLS}>
            <span>Реліз</span>
            <span>Опубліковано</span>
            <span>Позицій</span>
            <span>Статус</span>
            <span>Хто</span>
          </Grid>
          {RELEASES.map((r) => (
            <Grid
              key={r.id}
              cols={COLS}
              active={r.id === selected.id}
              onClick={() => setSelectedId(r.id)}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{r.version}</span>
                <Mono>{r.id} · {r.topics.join(', ')}</Mono>
              </span>
              <Mono className="text-muted">{r.publishedAt}</Mono>
              <span className="studio-num text-[12.5px]">{r.items}</span>
              <Status value={r.status} />
              <span className="truncate text-[12.5px] text-muted">{r.publishedBy}</span>
            </Grid>
          ))}
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel title={selected.version} action={<Status value={selected.status} />}>
            <dl>
              <KeyVal k="Ідентифікатор" v={<Mono className="text-muted">{selected.id}</Mono>} />
              <KeyVal k="Дата" v={selected.publishedAt} />
              <KeyVal k="Автор публікації" v={selected.publishedBy} />
              <KeyVal k="Позицій" v={selected.items} />
              <KeyVal k="Теми" v={selected.topics.join(', ')} />
            </dl>
            <p className="mt-3 text-[12.5px] leading-relaxed text-muted">{selected.note}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="danger" denied={rollbackDenied}>
                <Undo2 size={13} />
                Відкотити реліз
              </Button>
              <Button variant="ghost">Переглянути diff релізу</Button>
            </div>
          </Panel>

          <Panel title="Що входить у наступний реліз" flush>
            {approved.length === 0 ? (
              <p className="px-4 py-6 text-center text-[12.5px] text-faint">
                Схвалених позицій немає — публікувати нічого.
              </p>
            ) : (
              approved.map((d) => (
                <div key={d.id} className="border-b border-line px-4 py-2.5 last:border-b-0">
                  <p className="truncate text-[13px] font-medium">{d.title}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Mono>{d.id}</Mono>
                    <Badge tone="success">ревізія {d.revision}</Badge>
                  </div>
                </div>
              ))
            )}
          </Panel>

          <div className="rounded-[var(--s-radius)] border border-dashed border-line-strong p-4 text-[12px] leading-relaxed text-faint">
            Відкат повертає попередню ревізію кожної позиції релізу. Руками
            редагувати JSON не треба — і не можна: published store приймає лише
            ревізії, створені студією.
          </div>
        </div>
      </div>
    </Page>
  );
}
