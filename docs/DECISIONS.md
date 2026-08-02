# Bible Games — журнал архітектурних і продуктових рішень

> Актуальна специфікація: [BIBLE_GAMES_MASTER_SPECIFICATION.md](./BIBLE_GAMES_MASTER_SPECIFICATION.md).  
> Рішення нижче визначають напрям. Статус `accepted` не означає, що implementation уже завершено.

---

# ADR-000 — Одна канонічна специфікація і одна система фаз

**Дата:** 2026-08-02  
**Статус:** accepted  
**Implementation:** documentation branch `agent/unify-product-documentation`

## Контекст

У репозиторії одночасно існували:

- старий `implementation_plan.md` із Phase 1–13 `Completed`;
- `task.md` зі старою task board;
- новий `MASTER_ROADMAP.md` із новими Phase 0–13;
- окремий AI roadmap із підфазами `10.0–10.10`;
- частково застарілий README.

Це робило слово `Phase` неоднозначним і дозволяло AI-агенту випадково виконувати неактуальний план.

## Рішення

- `BIBLE_GAMES_MASTER_SPECIFICATION.md` є єдиним джерелом правди для продукту, архітектури, пріоритетів і фаз.
- Використовуються великі Phase 0–8 без окремої паралельної нумерації підфаз.
- Внутрішні workstreams, коміти та PR не створюють новий roadmap.
- Старі plans/tasks позначаються historical.
- Зміна phase order вимагає нового ADR.

## Наслідки

Позитивні:

- один порядок роботи;
- зрозумілі dependencies;
- security не губиться серед UI/AI задач;
- Codex отримує стабільний context.

Негативні:

- старі посилання на Phase numbers потребують переосмислення;
- historical documents більше не можна використовувати як active checklist.

## Rollback

Не рекомендується. Якщо документ стане занадто великим, domain annex можуть бути винесені окремо, але phase authority залишається в одному файлі.

---

# ADR-001 — Без повного monorepo rewrite на поточному етапі

**Дата:** 2026-08-01  
**Статус:** accepted

## Контекст

Раніше пропонувалася структура з окремими `apps/` і приблизно десятьма `packages/`. Для одного розробника це створює значний tooling overhead до того, як стабілізовані auth, data model і продукт.

## Рішення

- зберегти один репозиторій;
- вводити логічні domain boundaries усередині наявних `src/`, `server/`, `scripts/`;
- фізично виділяти окремий застосунок лише за наявності security/deployment причини;
- Protected Content Studio може стати окремим bundle/deployment у Phase 4;
- окремий reusable package створюється лише при реальному незалежному reuse/versioning.

## Наслідки

- менше конфігурації;
- простіші міграції;
- швидше виправлення фундаменту;
- необхідно контролювати imports і domain boundaries lint/architecture rules.

## Перегляд рішення

Новий ADR потрібен, якщо:

- з’являється окрема команда;
- потрібний незалежний deployment;
- package має декілька реальних consumers;
- current repo boundaries більше не контролюються tooling.

---

# ADR-002 — Production auth тільки fail-closed

**Дата:** 2026-08-02  
**Статус:** accepted, implementation pending Phase 1

## Контекст

Поточний middleware вміє перевіряти Telegram `initData`, але може fallback-итися на client-supplied `x-user-id`. Strict behavior також залежить від наявності bot token.

## Рішення

Production identity визначається лише з:

- валідного Telegram `initData`; або
- серверної сесії, створеної після валідного Telegram authentication.

Заборонено використовувати як source of truth:

- `x-user-id`;
- path/query/body user ID;
- `initDataUnsafe` без server verification;
- frontend admin list.

Development fallback:

- має окремий explicit auth mode;
- не може ввімкнутися в production;
- позначається в logs/UI;
- має deterministic test identities.

## Обов’язкові implementation properties

- auth_date freshness;
- timing-safe comparison;
- typed auth context;
- HTTP і WebSocket identity;
- production config validation;
- negative integration tests;
- no insecure fallback rollback.

---

# ADR-003 — Progression, wallet і rewards є server-authoritative

**Дата:** 2026-08-02  
**Статус:** accepted, implementation pending Phase 1

## Контекст

Legacy frontend сам обчислює coins, rank, wisdom, streak, achievements, purchases і передає готовий профіль серверу. Навіть із правильним auth користувач може підробити payload.

## Рішення

Клієнт надсилає command/event:

- answer submitted;
- lesson completed;
- practice completed;
- purchase requested;
- challenge action.

Сервер:

- перевіряє eligibility;
- обчислює reward;
- застосовує idempotency;
- виконує transaction;
- записує audit/ledger;
- повертає authoritative result.

Заборонено приймати від клієнта trusted final values для coins, rank, streak, mastery, entitlements або leaderboard.

## Migration

Legacy local profile імпортується один раз через versioned, bounded та idempotent migration record. Він не стає безумовно довіреним production balance.

---

# ADR-004 — Published content тільки через staging, review і publication

**Дата:** 2026-08-02  
**Статус:** accepted, implementation pending Phase 4

## Контекст

Legacy scripts і admin API можуть змінювати активні JSON, а частина AI tooling генерує або ремонтує контент без єдиного lifecycle.

## Рішення

Content lifecycle:

```text
draft
→ generated
→ validated
→ ready_for_review
→ approved
→ published
→ superseded/archived
```

Правила:

- AI не публікує;
- invalid content quarantine/reject;
- `correctIndex` не fallback-иться;
- repair, review, approve, publish — різні permissioned operations;
- published revision immutable;
- зміна створює нову revision;
- publication має audit trail;
- rollback є окремою операцією.

## Content Studio

Protected Content Studio отримує RBAC і може бути фізично відокремлений від user app.

---

# ADR-005 — Safety і data integrity перед редизайном, AI та growth

**Дата:** 2026-08-02  
**Статус:** accepted

## Контекст

Попередній roadmap дозволяв переходити до design shell, Today, lessons і AI, залишаючи auth/server authority як відкладений ризик.

## Рішення

Обов’язковий порядок:

1. documentation/baseline;
2. security, auth, RBAC, server authority, CI;
3. canonical architecture/data;
4. learning product;
5. content/AI/Studio;
6. social/economy;
7. release hardening;
8. bonus.

Новий user-facing feature не може перескочити незакритий P0 лише через нижчу складність або вищу візуальну цінність.

## Виняток

Можливий лише для emergency fix або зміни, що прямо зменшує P0 risk. Причина фіксується в PR і, якщо змінює roadmap, у новому ADR.

---

# ADR-006 — Transactional production storage; JSON лише як контрольований adapter

**Дата:** 2026-08-02  
**Статус:** accepted, implementation pending Phase 1/2

## Контекст

JSON зручний локально, але synchronous direct writes без lock/version/transaction небезпечні для production mutation.

## Рішення

- production authoritative user, economy, progress, social і content metadata зберігаються в transactional database;
- JSON може використовуватися для fixtures, import/export, static published snapshots або local development;
- будь-який mutable JSON adapter має atomic write і contract tests;
- production publication не редагує source JSON напряму через public API;
- exact database provider може змінитися без зміни domain contract.

---

# ADR-007 — User-facing AI тільки після reviewed content platform

**Дата:** 2026-08-02  
**Статус:** accepted

## Контекст

Open-ended AI chat легко реалізувати раніше, ніж безпечний content pipeline, але він створює високі theological, privacy, cost і trust risks.

## Рішення

Спочатку:

- provider abstraction;
- schemas;
- staging;
- validation;
- Scripture verification;
- review;
- publication;
- retrieval лише з approved content.

Перші user-facing AI functions мають бути вузькими:

- пояснення помилки;
- контекст уривка;
- простіше пояснення терміна;
- коротке повторення.

Вони мають citations, AI label, feedback, limits і deterministic fallback.

---

# ADR-008 — `completed` потребує evidence

**Дата:** 2026-08-02  
**Статус:** accepted

## Рішення

Phase/feature не позначається `completed`, якщо є лише:

- створені файли;
- UI screen;
- успішний frontend build;
- mock endpoint;
- local happy path;
- документація без implementation.

Потрібні acceptance criteria, tests, migration, rollback, security/data review, documentation sync і список відомих обмежень відповідно до глобального Definition of Done.

---

# Як додавати нові рішення

Кожен новий ADR містить:

- дату;
- статус;
- контекст;
- рішення;
- alternatives;
- наслідки;
- migration/security impact;
- rollback або критерій перегляду.

Не створювати порожні ADR наперед. Створювати рішення тоді, коли існує реальний вибір або зміна напряму.