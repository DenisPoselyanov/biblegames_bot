import { KeyRound, Lock } from 'lucide-react';
import { PROMPTS, PROVIDERS, ROLE_LABEL, ROLE_PERMISSIONS } from '../lib/mock';
import { useCan, useStudio } from '../lib/useStudio';
import type { Permission, Role } from '../lib/types';
import { cn } from '../../ui/cn';
import {
  WIDE_ONLY,
  Badge,
  Bar,
  Button,
  Disclosure,
  Grid,
  Mono,
  Note,
  Page,
  Panel,
  Status,
  Term,
} from '../ui/kit';

/** Plain-language names for the permissions; the enum stays visible as a hint. */
const PERMISSION_LABEL: Record<Permission, string> = {
  'job.run': 'Запускати AI',
  'job.cancel': 'Зупиняти запуск',
  'draft.edit': 'Редагувати чернетку',
  'draft.repair': 'Виправляти через AI',
  'review.comment': 'Коментувати',
  'review.approve': 'Схвалювати',
  'content.publish': 'Публікувати в гру',
  'content.rollback': 'Відкочувати випуск',
  'settings.write': 'Змінювати налаштування',
};

const ALL_PERMISSIONS = Object.keys(PERMISSION_LABEL) as Permission[];
const ROLES: Role[] = ['author', 'reviewer', 'admin'];

export function Settings() {
  const { role } = useStudio();
  const can = useCan();
  const denied = can('settings.write') ? null : `Роль «${ROLE_LABEL[role]}» не змінює налаштування`;

  return (
    <Page wide title="Налаштування">
      <Panel className="mb-3" title={<Term k="provider">Провайдери AI</Term>} flush>
        <Grid head cols="150px 130px 1fr 190px 130px" narrow="1fr 120px 170px 110px">
          <span>Сервіс</span>
          <span>Стан</span>
          <span className={WIDE_ONLY}>Для чого</span>
          <span>Витрати за місяць</span>
          <span />
        </Grid>
        {PROVIDERS.map((p) => (
          <Grid key={p.id} cols="150px 130px 1fr 190px 130px" narrow="1fr 120px 170px 110px">
            <span className="min-w-0">
              <span className="block truncate font-medium">{p.label}</span>
              <Mono>{p.defaultModel}</Mono>
            </span>
            <Status value={p.status} />
            <span className={cn('truncate text-[12.5px] text-faint', WIDE_ONLY)} title={p.note}>
              {p.note}
            </span>
            <span className="min-w-0">
              {p.monthly.costLimitUsd > 0 ? (
                <>
                  <Bar value={p.monthly.costUsd} max={p.monthly.costLimitUsd} />
                  <span className="studio-num mt-1 block text-[12px] text-faint">
                    ${p.monthly.costUsd.toFixed(2)} з ${p.monthly.costLimitUsd}
                  </span>
                </>
              ) : (
                <span className="text-[12.5px] text-faint">безкоштовно</span>
              )}
            </span>
            <span className="justify-self-end">
              <Button variant="ghost" denied={denied}>
                <KeyRound size={13} />
                Ключ
              </Button>
            </span>
          </Grid>
        ))}
      </Panel>

      <Disclosure
        className="mb-3"
        label="Інструкції для AI"
        hint={`${PROMPTS.length} шт., з версіями`}
      >
        {PROMPTS.map((p) => (
          <div key={p.id} className="border-b border-line px-4 py-3 last:border-b-0">
            <div className="flex items-center gap-2">
              <Mono className="text-muted">{p.name}</Mono>
              <Badge tone="info">{p.version}</Badge>
              <span className="ml-auto text-[12px] text-faint">
                {p.updatedAt} · {p.updatedBy}
              </span>
            </div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-faint">{p.excerpt}</p>
          </div>
        ))}
      </Disclosure>

      <Disclosure
        label="Хто що може"
        help={<Term k="rbac" align="end" iconOnly />}
        hint="перемикач ролі — у шапці"
      >
        <Grid head cols="240px repeat(3, 1fr)" narrow="1fr repeat(3, 110px)">
          <span>Дія</span>
          {ROLES.map((r) => (
            <span key={r} className={role === r ? 'text-ink' : undefined}>
              {ROLE_LABEL[r]}
            </span>
          ))}
        </Grid>
        {ALL_PERMISSIONS.map((permission) => (
          <Grid key={permission} cols="240px repeat(3, 1fr)" narrow="1fr repeat(3, 110px)">
            <span className="min-w-0">
              <span className="block truncate text-[13px]">{PERMISSION_LABEL[permission]}</span>
              <Mono>{permission}</Mono>
            </span>
            {ROLES.map((r) => (
              <span key={r} className="text-[13px]">
                {ROLE_PERMISSIONS[r].includes(permission) ? (
                  <span className="text-success">так</span>
                ) : (
                  <span className="flex items-center gap-1 text-faint">
                    <Lock size={11} />
                    ні
                  </span>
                )}
              </span>
            ))}
          </Grid>
        ))}
      </Disclosure>

      <Note className="mt-3">
        Схована кнопка — не захист. Роль перевіряється на сервері: без права запит
        просто не виконається, навіть якщо кнопку намалювати.
      </Note>
    </Page>
  );
}
