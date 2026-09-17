import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Play, Sparkles } from 'lucide-react';
import { JOB_TASKS, PROMPTS, PROVIDERS, TOPIC_TREE } from '../lib/mock';
import { useCan } from '../lib/useStudio';
import {
  Badge,
  Button,
  Disclosure,
  Field,
  Input,
  Mono,
  Page,
  Panel,
  Select,
  Term,
} from '../ui/kit';

const FLAT_TOPICS = TOPIC_TREE.flatMap((root) =>
  (root.children ?? []).map((c) => ({ value: c.id, label: `${root.title} · ${c.title}` })),
);

/**
 * Three decisions up front — what, where, how much. Everything an expert wants
 * to override lives one click down, with defaults that already work.
 */
export function NewJob() {
  const can = useCan();
  const [task, setTask] = useState<string>(JOB_TASKS[0].id);
  const [providerId, setProviderId] = useState('gemini');

  const provider = PROVIDERS.find((p) => p.id === providerId) ?? PROVIDERS[0];
  const prompt = PROMPTS.find((p) => p.usedBy.includes(task));

  return (
    <Page
      title="Новий запуск"
      subtitle="AI підготує чернетки. У гру нічого не потрапить, поки людина не схвалить."
      actions={
        <Link to="../jobs">
          <Button variant="quiet">
            <ArrowLeft size={14} />
            До списку
          </Button>
        </Link>
      }
    >
      <div className="grid grid-cols-[1fr_300px] items-start gap-4">
        <div className="flex flex-col gap-3">
          <Panel title="1 · Що зробити">
            <div className="grid grid-cols-3 gap-2">
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
                  <p className="mt-0.5 text-[12px] leading-snug text-faint">{t.hint}</p>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="2 · Де і скільки">
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Тема"
                hint="Один запуск працює в межах однієї теми — так дешевше шукати повтори."
              >
                <Select options={FLAT_TOPICS} defaultValue="t-prophets-isaiah" />
              </Field>
              <Field label="Скільки питань" hint="Максимум 100 за раз.">
                <Input type="number" defaultValue={25} min={1} max={100} />
              </Field>
            </div>
          </Panel>

          <Disclosure
            label="3 · Тонкі налаштування"
            hint="можна не чіпати"
          >
            <div className="grid gap-4 p-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label={<Term k="provider">Провайдер</Term>}>
                  <Select
                    value={providerId}
                    onChange={(e) => setProviderId(e.target.value)}
                    options={PROVIDERS.map((p) => ({ value: p.id, label: p.label }))}
                  />
                </Field>
                <Field label="Модель" hint="Записується в запуск і не змінюється непомітно.">
                  <Select options={provider.models.map((m) => ({ value: m, label: m }))} />
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
                <Field label="Мова">
                  <Select options={[{ value: 'uk', label: 'Українська' }]} />
                </Field>
              </div>

              <div>
                <p className="mb-2 flex items-center gap-1.5 text-[11.5px] font-semibold tracking-[0.02em] text-faint uppercase">
                  <Term k="budget">Межі витрат</Term>
                </p>
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Запити">
                    <Input type="number" defaultValue={60} />
                  </Field>
                  <Field label="Токени">
                    <Input type="number" defaultValue={200000} />
                  </Field>
                  <Field label="Гроші, $">
                    <Input type="number" step="0.5" defaultValue={1.5} />
                  </Field>
                </div>
              </div>

              {prompt && (
                <div className="rounded-[var(--s-radius-sm)] border border-line bg-[var(--s-panel-2)] p-3">
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
            </div>
          </Disclosure>

          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="md"
              denied={can('job.run') ? null : 'Потрібне право запускати AI'}
            >
              <Play size={14} />
              Запустити
            </Button>
            <Button variant="ghost" size="md">
              Зберегти як шаблон
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Panel title="Що буде далі">
            <ol className="grid gap-2.5">
              {[
                'AI готує чернетки партіями',
                'Кожну перевіряє машина: формат, повтори, мова, вірші',
                'Що не пройшло — позначається помилкою й не йде далі',
                'Решта чекає на людину в черзі',
                'У гру потрапляє лише схвалене',
              ].map((step, i, arr) => (
                <li key={step} className="flex gap-2.5 text-[12.5px] leading-relaxed">
                  <span className="studio-num grid h-5 w-5 shrink-0 place-items-center rounded-full border border-line-strong text-[11px] font-bold text-faint">
                    {i + 1}
                  </span>
                  <span className={i === arr.length - 1 ? 'text-gold-ink' : 'text-muted'}>
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </Panel>

          <div className="rounded-[var(--s-radius)] border border-dashed border-line-strong p-4">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles size={14} className="text-gold" />
              <p className="text-[13px] font-bold">Тут буде асистент</p>
            </div>
            <p className="text-[12.5px] leading-relaxed text-faint">
              Місце під поле «опиши завдання словами». Студія збере з нього ці
              самі параметри й покаже на підтвердження — запускає завжди людина.
            </p>
            <div className="mt-3 h-9 rounded-[var(--s-radius-sm)] border border-dashed border-line" />
          </div>
        </div>
      </div>
    </Page>
  );
}
