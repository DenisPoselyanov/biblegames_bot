import { Link } from 'react-router-dom';
import { ArrowRight, MousePointerClick, PanelRight, ScrollText } from 'lucide-react';
import { GLOSSARY } from '../lib/glossary';
import { ROLE_LABEL, ROLE_PERMISSIONS } from '../lib/mock';
import type { Role } from '../lib/types';
import { Badge, Disclosure, Page, Panel } from '../ui/kit';

/**
 * The screen that lets someone use the studio without being taught. It explains
 * three things: the path a question travels, who is allowed to push it along,
 * and how this interface itself is laid out.
 */

const PIPELINE = [
  {
    step: 'AI готує чернетку',
    body: 'Запуск створює питання партіями. Це ще не контент гри — це матеріал.',
    where: 'Робота AI',
    to: '../jobs',
  },
  {
    step: 'Машина перевіряє',
    body: 'Формат, повтори, мова, складність і головне — чи існує вірш і чи збігається цитата.',
    where: 'Черга · Писання',
    to: '../review',
  },
  {
    step: 'Що не пройшло — стоїть',
    body: 'Позиція з помилкою не потрапляє на розгляд і не може бути схвалена, поки причину не усунуто.',
    where: 'Черга · З помилками',
    to: '../review',
  },
  {
    step: 'Людина вирішує',
    body: 'Рецензент читає, порівнює з попередньою версією і або схвалює, або повертає з коментарем.',
    where: 'Черга · Контент',
    to: '../review',
  },
  {
    step: 'Випуск у гру',
    body: 'Схвалене публікується окремою дією. Кожна версія зберігається, тому випуск можна відкотити.',
    where: 'Випуск',
    to: '../releases',
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
    body: '«Відкрити повністю» — уся історія змін, журнали, обговорення та походження.',
  },
];

const ROLES: Role[] = ['author', 'reviewer', 'admin'];

const ROLE_SUMMARY: Record<Role, string> = {
  author: 'Запускає AI, виправляє зауваження, коментує. Не схвалює власну роботу.',
  reviewer: 'Читає, схвалює або повертає на доопрацювання. Не публікує.',
  admin: 'Може все, включно з публікацією в гру та відкатом випуску.',
};

export function Guide() {
  return (
    <Page
      title="Як це працює"
      subtitle="Три хвилини читання — і далі можна не здогадуватись."
    >
      <Panel className="mb-3" title="Шлях одного питання" flush>
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

      <div className="mb-3 grid gap-3 @min-[720px]:grid-cols-3">
        {LEVELS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-[var(--s-radius)] border border-line bg-[var(--s-panel)] p-4">
            <Icon size={17} className="text-indigo" />
            <p className="mt-2 text-[14px] font-semibold">{title}</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-faint">{body}</p>
          </div>
        ))}
      </div>

      <Panel className="mb-3" title="Три ролі" flush>
        {ROLES.map((r) => (
          <div key={r} className="flex gap-3 border-b border-line px-4 py-3 last:border-b-0">
            <span className="w-[130px] shrink-0 text-[13.5px] font-semibold">{ROLE_LABEL[r]}</span>
            <span className="flex-1 text-[12.5px] leading-relaxed text-faint">
              {ROLE_SUMMARY[r]}
            </span>
            <Badge className="shrink-0">{ROLE_PERMISSIONS[r].length} прав</Badge>
          </div>
        ))}
      </Panel>

      <Panel className="mb-3" title="Що студія гарантує">
        <ul className="grid gap-2 text-[13px] leading-relaxed text-muted">
          <li>· AI не може нічого записати в гру — тільки в чернетки.</li>
          <li>· Виправити, схвалити й опублікувати — три різні дії з різними правами.</li>
          <li>· Заблокована кнопка не зникає: вона каже, чого саме бракує.</li>
          <li>· Жодних вигаданих відсотків виконання — лише справжні лічильники.</li>
          <li>· Помилки AI показуються як є, а не ховаються за «спробуйте ще раз».</li>
          <li>· Текст Писання зберігається на момент перевірки — як доказ.</li>
        </ul>
      </Panel>

      <Disclosure label="Словник" hint={`${Object.keys(GLOSSARY).length} термінів`}>
        <dl className="grid gap-x-6 px-4 py-3 @min-[720px]:grid-cols-2">
          {Object.entries(GLOSSARY).map(([key, entry]) => (
            <div key={key} className="border-b border-line py-2 last:border-b-0">
              <dt className="text-[13px] font-semibold">{entry.term}</dt>
              <dd className="mt-0.5 text-[12.5px] leading-relaxed text-faint">{entry.short}</dd>
            </div>
          ))}
        </dl>
      </Disclosure>
    </Page>
  );
}
