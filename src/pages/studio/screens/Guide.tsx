import { Link } from 'react-router-dom';
import { ArrowRight, MousePointerClick, PanelRight, ScrollText } from 'lucide-react';
import { GLOSSARY } from '../lib/glossary';
import { plural } from '../lib/plural';
import { useSettingsQuery } from '../lib/queries';
import { PERMISSION_LABEL, ROLE_LABEL, type Role } from '../lib/rbac';
import { Badge, Disclosure, Page, Panel } from '../ui/kit';

/**
 * «Як це працює» (Phase 4 WS8d) — ported from the design prototype's `guide`
 * screen. It explains three things: the path a piece of content travels, who
 * is allowed to push it along, and how the interface itself is laid out.
 *
 * Differences from the prototype, all "principle beats prototype detail":
 * - roles are the real server roles (`content_reviewer` / `content_publisher`
 *   / `admin`), and what each may do is read from `/studio/settings` — the
 *   same `ROLE_PERMISSIONS` the server enforces — instead of a mock list;
 * - no claim the server does not back: the prototype's «не схвалює власну
 *   роботу» and «з помилкою не можна схвалити» are gone, because approval is
 *   an audited decision without a self-approval or blocker check — the hard
 *   stop is at publication (WS6), and that is what the text says.
 */

const PIPELINE = [
  {
    step: 'AI готує чернетку',
    body: 'Запуск створює матеріал партіями й кладе його тільки в чернетки. Писати в гру AI не може — це обмеження сховища.',
    where: 'Робота AI',
    to: '/studio/jobs',
  },
  {
    step: 'Машина перевіряє',
    body: 'Формат, повтори, мова, складність — і чи існує вірш та чи збігається цитата. Текст Писання зберігається як доказ.',
    where: 'Черга',
    to: '/studio/review',
  },
  {
    step: 'Людина вирішує',
    body: 'Рецензент читає, порівнює з попередньою версією і схвалює або повертає з коментарем. Рішення записується в журнал.',
    where: 'Черга',
    to: '/studio/review',
  },
  {
    step: 'Блокер зупиняє випуск',
    body: 'Позиція з блокуючою помилкою або непідтвердженим Писанням не публікується, навіть схвалена. Кнопка скаже, чого бракує.',
    where: 'Писання під питанням',
    to: '/studio/review',
  },
  {
    step: 'Випуск у гру',
    body: 'Публікація — окрема дія з окремим правом. Кожна версія набору зберігається, тому випуск можна відкотити.',
    where: 'Випуск',
    to: '/studio/releases',
  },
];

const LEVELS = [
  {
    icon: ScrollText,
    title: 'Список',
    body: 'Показує тільки те, що потрібно, щоб обрати рядок: назву, що з нею не так, і стан.',
  },
  {
    icon: PanelRight,
    title: 'Картка збоку',
    body: 'Клік по рядку. Достатньо, щоб ухвалити рішення, не залишаючи список.',
  },
  {
    icon: MousePointerClick,
    title: 'Повна сторінка',
    body: '«Відкрити повністю» — зміни між ревізіями, Писання, перевірки й історія рішень.',
  },
];

const ROLE_SUMMARY: Partial<Record<Role, string>> = {
  content_reviewer: 'Запускає AI, читає, схвалює або повертає на доопрацювання. Не публікує.',
  content_publisher: 'Усе, що рецензент, плюс публікація в гру та відкат випуску.',
  admin: 'Має всі права, зокрема керування ролями й користувачами поза студією.',
};

const TERM_COUNT = Object.keys(GLOSSARY).length;

const FALLBACK_ROLES: Role[] = ['content_reviewer', 'content_publisher', 'admin'];

function RolesPanel() {
  const settings = useSettingsQuery();
  const roles = settings.data?.roles ?? FALLBACK_ROLES.map((role) => ({ role, permissions: null }));

  return (
    <Panel
      className="mb-3"
      title="Три ролі"
      subtitle="Права беруться з сервера — ті самі, що він перевіряє на кожну дію"
      flush
    >
      {roles.map(({ role, permissions }) => (
        <div key={role} className="flex gap-3 border-b border-line px-4 py-3 last:border-b-0">
          <span className="w-[170px] shrink-0 text-[13.5px] font-semibold">{ROLE_LABEL[role]}</span>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] leading-relaxed text-faint">{ROLE_SUMMARY[role] ?? '—'}</p>
            {permissions && (
              <p className="mt-1 text-[12px] leading-relaxed text-muted">
                {permissions
                  .map((p) => PERMISSION_LABEL[p])
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
          </div>
          {permissions && (
            <Badge className="shrink-0 self-start">
              {permissions.length} {plural(permissions.length, 'право', 'права', 'прав')}
            </Badge>
          )}
        </div>
      ))}
    </Panel>
  );
}

export function Guide() {
  return (
    <Page title="Як це працює" subtitle="Три хвилини читання — і далі можна не здогадуватись.">
      <Panel className="mb-3" title="Шлях однієї позиції" flush>
        {PIPELINE.map((item, i) => (
          <div key={item.step} className="flex gap-3 border-b border-line px-4 py-3 last:border-b-0">
            <span className="studio-num mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line-strong text-[12px] font-bold text-faint">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold">{item.step}</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-faint">{item.body}</p>
            </div>
            <Link
              to={item.to}
              className="shrink-0 self-center text-[12.5px] font-semibold text-indigo hover:underline"
            >
              {item.where} <ArrowRight size={12} className="inline" />
            </Link>
          </div>
        ))}
      </Panel>

      <div className="mb-3 grid grid-cols-3 gap-3">
        {LEVELS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-[var(--s-radius)] border border-line bg-[var(--s-panel)] p-4">
            <Icon size={17} className="text-indigo" />
            <p className="mt-2 text-[14px] font-semibold">{title}</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-faint">{body}</p>
          </div>
        ))}
      </div>

      <RolesPanel />

      <Panel className="mb-3" title="Що студія гарантує">
        <ul className="grid gap-2 text-[13px] leading-relaxed text-muted">
          <li>· AI не може нічого записати в гру — тільки в чернетки.</li>
          <li>· Схвалити, опублікувати й відкотити — різні дії з різними правами.</li>
          <li>· Заблокована кнопка не зникає: вона каже, чого саме бракує.</li>
          <li>· Жодних вигаданих відсотків виконання — лише справжні лічильники.</li>
          <li>· Помилки AI показуються як є, а не ховаються за «спробуйте ще раз».</li>
          <li>· Кожне рішення, публікація й відкат записуються в журнал з автором.</li>
        </ul>
      </Panel>

      <Disclosure label="Словник" hint={`${TERM_COUNT} ${plural(TERM_COUNT, 'термін', 'терміни', 'термінів')}`}>
        <dl className="grid grid-cols-2 gap-x-6 px-4 py-3">
          {Object.entries(GLOSSARY).map(([key, entry]) => (
            <div key={key} className="border-b border-line py-2">
              <dt className="text-[13px] font-semibold">{entry.term}</dt>
              <dd className="mt-0.5 text-[12.5px] leading-relaxed text-faint">{entry.short}</dd>
            </div>
          ))}
        </dl>
      </Disclosure>
    </Page>
  );
}
