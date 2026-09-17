import { KeyRound, Lock } from 'lucide-react';
import { PROMPTS, PROVIDERS, ROLE_LABEL, ROLE_PERMISSIONS } from '../lib/mock';
import { useCan, useStudio } from '../lib/useStudio';
import type { Permission, Role } from '../lib/types';
import { Badge, Bar, Button, Grid, KeyVal, Mono, Page, Panel, Status } from '../ui/kit';

const ALL_PERMISSIONS: Permission[] = [
  'job.run',
  'job.cancel',
  'draft.edit',
  'draft.repair',
  'review.comment',
  'review.approve',
  'content.publish',
  'content.rollback',
  'settings.write',
];

const ROLES: Role[] = ['author', 'reviewer', 'admin'];

export function Settings() {
  const { role } = useStudio();
  const can = useCan();
  const denied = can('settings.write') ? null : `Роль «${ROLE_LABEL[role]}» не змінює налаштування`;

  return (
    <Page
      wide
      title="Налаштування"
      subtitle="Провайдери, бюджети, промпти й права. Усе, що раніше жило у вкладці «Налаштування» лаунчера й у .env."
    >
      <div className="mb-4 grid grid-cols-2 gap-4">
        {PROVIDERS.map((p) => (
          <Panel
            key={p.id}
            title={p.label}
            subtitle={p.note}
            action={<Status value={p.status} />}
          >
            <dl>
              <KeyVal k="Модель за замовчуванням" v={<Mono className="text-muted">{p.defaultModel}</Mono>} />
              <KeyVal k="Доступні моделі" v={p.models.length} />
              <KeyVal
                k="Затримка"
                v={
                  p.latencyMs === null ? (
                    '—'
                  ) : (
                    <span className={p.latencyMs > 2000 ? 'text-gold-ink' : undefined}>
                      {p.latencyMs} мс
                    </span>
                  )
                }
              />
              <KeyVal
                k="Змінні середовища"
                v={
                  p.envKeys.length ? (
                    <span className="flex flex-wrap justify-end gap-1">
                      {p.envKeys.map((k) => (
                        <Mono key={k} className="text-muted">
                          {k}
                        </Mono>
                      ))}
                    </span>
                  ) : (
                    'не потрібні'
                  )
                }
              />
            </dl>

            <div className="mt-3 border-t border-line pt-3">
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-[12px] text-faint">Витрати за місяць</span>
                <span className="studio-num text-[12.5px] font-semibold">
                  {p.monthly.costLimitUsd > 0
                    ? `$${p.monthly.costUsd.toFixed(2)} / $${p.monthly.costLimitUsd}`
                    : 'локально, без тарифікації'}
                </span>
              </div>
              <Bar value={p.monthly.costUsd} max={p.monthly.costLimitUsd} />
            </div>

            <div className="mt-3 flex gap-2">
              <Button variant="ghost" denied={denied}>
                <KeyRound size={13} />
                Змінити ключ
              </Button>
              <Button variant="ghost" denied={denied}>
                Перевірити зʼєднання
              </Button>
            </div>
          </Panel>
        ))}
      </div>

      <Panel
        className="mb-4"
        title="Промпти"
        subtitle="Версіонуються. Джоб записує, якою версією його виконано."
        flush
      >
        <Grid head cols="220px 80px 1fr 150px 130px">
          <span>Назва</span>
          <span>Версія</span>
          <span>Початок</span>
          <span>Використовує</span>
          <span className="text-right">Оновлено</span>
        </Grid>
        {PROMPTS.map((p) => (
          <Grid key={p.id} cols="220px 80px 1fr 150px 130px">
            <Mono className="text-muted">{p.name}</Mono>
            <Badge tone="info">{p.version}</Badge>
            <span className="truncate text-[12.5px] text-faint" title={p.excerpt}>
              {p.excerpt}
            </span>
            <Mono>{p.usedBy.join(', ')}</Mono>
            <span className="text-right text-[12px] text-faint">
              {p.updatedAt} · {p.updatedBy}
            </span>
          </Grid>
        ))}
      </Panel>

      <Panel
        title="Ролі й права"
        subtitle="Матриця RBAC. Перемикач ролі в шапці показує студію очима кожної."
        flush
      >
        <Grid head cols="220px repeat(3, 1fr)">
          <span>Операція</span>
          {ROLES.map((r) => (
            <span key={r} className={role === r ? 'text-ink' : undefined}>
              {ROLE_LABEL[r]}
            </span>
          ))}
        </Grid>
        {ALL_PERMISSIONS.map((permission) => (
          <Grid key={permission} cols="220px repeat(3, 1fr)">
            <Mono className="text-muted">{permission}</Mono>
            {ROLES.map((r) => {
              const allowed = ROLE_PERMISSIONS[r].includes(permission);
              return (
                <span key={r} className="text-[13px]">
                  {allowed ? (
                    <span className="text-success">дозволено</span>
                  ) : (
                    <span className="flex items-center gap-1 text-faint">
                      <Lock size={11} />
                      ні
                    </span>
                  )}
                </span>
              );
            })}
          </Grid>
        ))}
      </Panel>

      <div className="mt-4 rounded-[var(--s-radius)] border border-dashed border-line-strong p-4 text-[12.5px] leading-relaxed text-faint">
        Feature flag не замінює авторизацію. Якщо студія вимкнена прапорцем, її
        endpoint усе одно має відповідати 403 для ролі без права — інакше це не
        захист, а маскування.
      </div>
    </Page>
  );
}
