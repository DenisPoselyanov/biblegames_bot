import { Lock } from 'lucide-react';
import { plural } from '../lib/plural';
import { useSettingsQuery } from '../lib/queries';
import { PERMISSION_LABEL, ROLE_LABEL } from '../lib/rbac';
import { useStudio } from '../lib/useStudio';
import { Badge, Disclosure, Grid, KeyVal, Mono, Note, Page, Panel, Status, Term } from '../ui/kit';

/**
 * Settings (Phase 4 WS8c) — ported from the design prototype's `settings`
 * screen, but read-only on purpose: providers, keys and budgets are env
 * config (`server/config/env.ts`), changed by a redeploy, and roles are
 * granted via the admin roles API. A Studio form that "saved" any of it would
 * be a button that pretends — the prototype's «Ключ» buttons are dropped.
 * The server never sends a key, only whether one is set.
 */

export function Settings() {
  const { identity } = useStudio();
  const query = useSettingsQuery();
  const data = query.data;

  if (query.isError) {
    return (
      <Page wide title="Налаштування">
        <Note tone="danger">Не вдалося завантажити налаштування: {(query.error as Error).message}</Note>
      </Page>
    );
  }
  if (!data) {
    return (
      <Page wide title="Налаштування">
        <p className="py-10 text-center text-[13px] text-faint">Завантажую…</p>
      </Page>
    );
  }

  return (
    <Page wide title="Налаштування" subtitle="Тільки для перегляду — змінюється конфігурацією сервера">
      <Panel
        className="mb-3"
        title={<Term k="provider">Провайдери AI</Term>}
        action={
          data.aiEnabled ? <Badge tone="success">AI увімкнено</Badge> : <Badge tone="danger">AI вимкнено</Badge>
        }
        flush
      >
        <Grid head cols="200px 150px 1fr 140px">
          <span>Сервіс</span>
          <span>Стан</span>
          <span>Модель</span>
          <span>Вибраний</span>
        </Grid>
        {data.providers.map((p) => (
          <Grid key={p.id} cols="200px 150px 1fr 140px">
            <span className="font-medium">{p.label}</span>
            <Status value={p.configured ? 'connected' : 'not_configured'} />
            <Mono>{p.model ?? '—'}</Mono>
            <span>{p.selected ? <Badge tone="info">основний</Badge> : <span className="text-faint">—</span>}</span>
          </Grid>
        ))}
      </Panel>

      <div className="mb-3 grid grid-cols-2 items-start gap-3">
        <Panel title={<Term k="budget">Бюджет одного запуску</Term>}>
          <dl>
            <KeyVal
              k="Запитів до AI"
              v={<span className="studio-num">{data.jobBudget?.maxRequests?.toLocaleString('uk-UA') ?? '—'}</span>}
            />
            <KeyVal
              k="Токенів"
              v={<span className="studio-num">{data.jobBudget?.maxTokens?.toLocaleString('uk-UA') ?? '—'}</span>}
            />
            <KeyVal
              k="Черга завдань у цьому процесі"
              v={data.queueAvailable ? 'підключена' : 'немає (окремий воркер)'}
            />
          </dl>
        </Panel>

        <Panel title="Версії інструкцій для AI" subtitle="Ті, з якими реально запускали завдання" flush>
          {data.promptVersions.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-faint">Жодного запуску AI ще не було.</p>
          ) : (
            data.promptVersions.map((p) => (
              <div key={p.promptVersion} className="flex items-center gap-2 border-b border-line px-4 py-2.5 last:border-b-0">
                <Mono className="text-muted">{p.promptVersion}</Mono>
                <Badge tone="info">
                  {p.jobs} {plural(p.jobs, 'запуск', 'запуски', 'запусків')}
                </Badge>
                <span className="ml-auto text-[12px] text-faint">{new Date(p.lastUsedAt).toLocaleString('uk-UA')}</span>
              </div>
            ))
          )}
        </Panel>
      </div>

      <Disclosure
        label="Хто що може"
        help={<Term k="rbac" align="end" iconOnly />}
        hint={`ваші ролі: ${(identity?.roles ?? []).map((r) => ROLE_LABEL[r]).join(', ') || '—'}`}
        defaultOpen
      >
        <Grid head cols={`260px repeat(${data.roles.length}, 1fr)`}>
          <span>Дія</span>
          {data.roles.map((r) => (
            <span key={r.role} className={identity?.roles.includes(r.role) ? 'text-ink' : undefined}>
              {ROLE_LABEL[r.role]}
            </span>
          ))}
        </Grid>
        {data.permissions.map((permission) => (
          <Grid key={permission} cols={`260px repeat(${data.roles.length}, 1fr)`}>
            <span className="min-w-0">
              <span className="block truncate text-[13px]">{PERMISSION_LABEL[permission] ?? permission}</span>
              <Mono>{permission}</Mono>
            </span>
            {data.roles.map((r) => (
              <span key={r.role} className="text-[13px]">
                {r.permissions.includes(permission) ? (
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
        Схована кнопка — не захист. Роль перевіряється на сервері: без права запит просто не виконається,
        навіть якщо кнопку намалювати. Ключі API живуть лише в змінних середовища сервера й сюди не
        потрапляють.
      </Note>
    </Page>
  );
}
