import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Play, Sparkles } from 'lucide-react';
import { JOB_TASKS, PROMPTS, PROVIDERS, TOPIC_TREE } from '../lib/mock';
import { useCan } from '../lib/useStudio';
import { Badge, Button, Field, Input, Mono, Page, Panel, Select } from '../ui/kit';

const FLAT_TOPICS = TOPIC_TREE.flatMap((root) =>
  (root.children ?? []).map((c) => ({ value: c.id, label: `${root.title} · ${c.title}` })),
);

export function NewJob() {
  const can = useCan();
  const [task, setTask] = useState<string>(JOB_TASKS[0].id);
  const [providerId, setProviderId] = useState('gemini');

  const provider = PROVIDERS.find((p) => p.id === providerId) ?? PROVIDERS[0];
  const taskMeta = JOB_TASKS.find((t) => t.id === task) ?? JOB_TASKS[0];
  const prompt = PROMPTS.find((p) => p.usedBy.includes(task));

  return (
    <Page
      title="Новий джоб"
      subtitle="Явні параметри замість вільного тексту: те саме, що дає CLI `npm run ai -- <task>`."
      actions={
        <Link to="../jobs">
          <Button variant="quiet">
            <ArrowLeft size={14} />
            До списку
          </Button>
        </Link>
      }
    >
      <div className="grid grid-cols-[1fr_330px] items-start gap-4">
        <div className="flex flex-col gap-4">
          <Panel title="Завдання">
            <div className="grid grid-cols-2 gap-2">
              {JOB_TASKS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTask(t.id)}
                  className={`rounded-[var(--s-radius-sm)] border p-3 text-left transition-colors ${
                    t.id === task
                      ? 'border-[color-mix(in_srgb,var(--p-indigo)_55%,transparent)] bg-[color-mix(in_srgb,var(--p-indigo)_14%,transparent)]'
                      : 'border-line bg-[var(--s-panel-2)] hover:border-line-strong'
                  }`}
                >
                  <p className="text-[13px] font-semibold">{t.label}</p>
                  <p className="mt-0.5 text-[12px] text-faint">{t.hint}</p>
                  <Mono className="mt-1.5 block">{t.id}</Mono>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Обсяг">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Тема" hint="Джоб працює в межах однієї теми — так дешевше перевіряти дублікати.">
                <Select options={FLAT_TOPICS} defaultValue="t-prophets-isaiah" />
              </Field>
              <Field label="Кількість позицій" hint="Максимум за один джоб — 100.">
                <Input type="number" defaultValue={25} min={1} max={100} />
              </Field>
              <Field label="Складність">
                <Select
                  options={[
                    { value: 'mixed', label: 'Змішана (рекомендовано)' },
                    { value: 'easy', label: 'Легка' },
                    { value: 'medium', label: 'Середня' },
                    { value: 'hard', label: 'Складна' },
                  ]}
                />
              </Field>
              <Field label="Мова" hint="Перевіряється детерміновано після генерації.">
                <Select options={[{ value: 'uk', label: 'Українська' }]} />
              </Field>
            </div>
          </Panel>

          <Panel title="Провайдер і промпт">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Провайдер">
                <Select
                  value={providerId}
                  onChange={(e) => setProviderId(e.target.value)}
                  options={PROVIDERS.map((p) => ({ value: p.id, label: p.label }))}
                />
              </Field>
              <Field label="Модель" hint="Модель не змінюється непомітно — вона частина запису джоба.">
                <Select options={provider.models.map((m) => ({ value: m, label: m }))} />
              </Field>
            </div>
            {prompt && (
              <div className="mt-4 rounded-[var(--s-radius-sm)] border border-line bg-[var(--s-panel-2)] p-3">
                <div className="flex items-center gap-2">
                  <Mono className="text-muted">{prompt.name}</Mono>
                  <Badge tone="info">{prompt.version}</Badge>
                  <span className="ml-auto text-[12px] text-faint">
                    оновив {prompt.updatedBy}, {prompt.updatedAt}
                  </span>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-faint">{prompt.excerpt}</p>
              </div>
            )}
          </Panel>

          <Panel title="Бюджет і зупинки">
            <div className="grid grid-cols-3 gap-4">
              <Field label="Ліміт запитів">
                <Input type="number" defaultValue={60} />
              </Field>
              <Field label="Ліміт токенів">
                <Input type="number" defaultValue={200000} />
              </Field>
              <Field label="Ліміт вартості, $">
                <Input type="number" step="0.5" defaultValue={1.5} />
              </Field>
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-faint">
              При досягненні будь-якого ліміту джоб зупиняється й зберігає
              checkpoint. Повторів більше ніж {3} не буде — це не налаштування, а
              політика.
            </p>
          </Panel>

          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="md"
              denied={can('job.run') ? null : 'Потрібне право job.run'}
            >
              <Play size={14} />
              Запустити
            </Button>
            <Button variant="ghost" size="md">
              Зберегти як пресет
            </Button>
            <span className="ml-auto text-[12px] text-faint">
              Еквівалент CLI:{' '}
              <Mono className="text-muted">
                npm run ai -- {taskMeta.id} --topic isaiah --count 25 --provider {providerId}
              </Mono>
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Panel title="Що станеться далі">
            <ol className="grid gap-2.5">
              {[
                'Джоб стає в чергу з хешем входу й бюджетом',
                'Провайдер повертає партії, кожна проходить схему',
                'Детерміновані чеки: дублікати, мова, посилання',
                'Перевірка Писання зберігає evidence',
                'Чернетки падають у чергу ревʼю зі статусом',
                'Публікує людина, окремою дією',
              ].map((step, i) => (
                <li key={step} className="flex gap-2.5 text-[12.5px] leading-relaxed">
                  <span className="studio-num grid h-5 w-5 shrink-0 place-items-center rounded-full border border-line-strong text-[11px] font-bold text-faint">
                    {i + 1}
                  </span>
                  <span className={i === 5 ? 'text-gold-ink' : 'text-muted'}>{step}</span>
                </li>
              ))}
            </ol>
          </Panel>

          {/* Reserved surface, stated as such. */}
          <div className="rounded-[var(--s-radius)] border border-dashed border-line-strong p-4">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles size={14} className="text-gold" />
              <p className="text-[13px] font-bold">Тут буде копайлот</p>
            </div>
            <p className="text-[12.5px] leading-relaxed text-faint">
              Місце під поле «опиши завдання словами» → студія збирає з нього ці
              самі параметри й показує їх на підтвердження. Модель нічого не
              запускає сама: людина бачить остаточний джоб і натискає «Запустити».
            </p>
            <div className="mt-3 h-9 rounded-[var(--s-radius-sm)] border border-dashed border-line" />
          </div>
        </div>
      </div>
    </Page>
  );
}
