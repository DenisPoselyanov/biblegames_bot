# Supabase/PostgreSQL через Express BFF

> **Статус:** технічна інструкція для поточного storage adapter.  
> **Не є доказом production readiness.**  
> **Архітектурні вимоги:** [BIBLE_GAMES_MASTER_SPECIFICATION.md](BIBLE_GAMES_MASTER_SPECIFICATION.md)

Клієнт не повинен підключатися до production database напряму. Дані проходять через Express API/BFF, де виконуються:

- verified authentication;
- authorization;
- validation;
- transactions;
- idempotency;
- audit;
- rate limits.

## Критичне production попередження

Поточний baseline має відомий auth fallback до client-provided `x-user-id`. Сам факт підключення Supabase не усуває цей ризик.

До завершення Phase 1:

- не вважайте API повністю production-secure;
- не зберігайте цінні balances/entitlements як trusted client profile fields;
- не відкривайте admin mutation endpoints;
- не використовуйте service-role secret у frontend;
- не покладайтеся лише на CORS;
- не запускайте production без backup і migration plan.

## 1. Схема

Поточний SQL baseline:

```text
server/db/schema.sql
```

Перед виконанням:

1. перегляньте schema;
2. створіть backup;
3. використайте staging project;
4. зафіксуйте migration version;
5. перевірте повторний запуск;
6. підготуйте rollback.

Не запускайте довільно змінений `schema.sql` напряму на production без versioned migration.

## 2. Server environment

```env
STORAGE_PROVIDER=sql
DATABASE_URL=postgresql://postgres.[ref]:[password]@...pooler.supabase.com:6543/postgres
PG_SSL=true
```

Для local development:

```env
STORAGE_PROVIDER=json
```

## 3. Secrets

Server-only:

- `DATABASE_URL`;
- database password;
- Supabase service credentials, якщо вони взагалі потрібні;
- `TELEGRAM_BOT_TOKEN`;
- payment/provider secrets;
- admin/service tokens.

Не використовувати у frontend-prefixed variables:

```text
VITE_DATABASE_URL
VITE_SUPABASE_SERVICE_ROLE_KEY
VITE_TELEGRAM_BOT_TOKEN
```

Будь-яка `VITE_*` змінна може потрапити в browser bundle.

## 4. Auth

Цільова production модель Phase 1:

```text
Telegram initData
→ server HMAC validation
→ freshness validation
→ verified Telegram user ID
→ server auth context/session
→ role/policy check
→ repository/service
→ database transaction
```

Заборонено визначати identity лише через:

- `x-user-id`;
- path user ID;
- request body;
- frontend role/admin list.

## 5. Storage health

Поточний endpoint:

```bash
curl http://localhost:3001/health/storage
```

Health endpoint має підтверджувати доступність adapter, але не повинен:

- повертати secrets;
- робити destructive writes;
- вважатися повною integration перевіркою;
- замінювати readiness/migration checks.

## 6. Мінімальна staging перевірка

1. Створити окремий staging Supabase project.
2. Застосувати schema/migrations.
3. Запустити server із `STORAGE_PROVIDER=sql`.
4. Перевірити health.
5. Виконати auth integration tests.
6. Створити test profile через API.
7. Перезапустити server і перевірити persistence.
8. Перевірити одночасні writes.
9. Перевірити invalid payload.
10. Перевірити unauthorized access.
11. Перевірити migration fixture.
12. Перевірити backup restore.

## 7. Production storage rules

Після Phase 1/2:

- user identity server-derived;
- wallet/progression server-authoritative;
- transaction boundaries explicit;
- migrations versioned;
- idempotency keys для критичних mutation;
- indexes перевірені;
- connection pool limits налаштовані;
- backup/restore протестовані;
- logs не містять connection string або sensitive payload;
- RLS використовується лише як додатковий захист, а не заміна BFF policy;
- direct public table access закритий, якщо архітектура BFF цього не потребує.

## 8. JSON adapter

`STORAGE_PROVIDER=json` дозволений для:

- local development;
- tests;
- fixtures;
- import/export;
- isolated demo.

Він не є рекомендованим production mutable storage для concurrent users. Mutable JSON writes повинні бути atomic і проходити той самий repository contract test, що й SQL adapter.

## 9. Deployment checklist

- [ ] staging migration пройшла;
- [ ] rollback перевірений;
- [ ] production secrets задані server-side;
- [ ] insecure auth fallback відсутній;
- [ ] admin routes protected;
- [ ] server typecheck/tests зелені;
- [ ] DB backup існує;
- [ ] connection limits налаштовані;
- [ ] readiness endpoint зелений;
- [ ] monitoring і alerting налаштовані;
- [ ] frontend використовує правильний HTTPS API URL;
- [ ] CORS дозволяє лише потрібні origins;
- [ ] жоден secret не потрапив у build.

Ця інструкція оновлюється разом із Phase 1/2 migrations і не може самостійно змінювати canonical data architecture.