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
**Статус:** accepted, implementation in progress (Phase 1 WS1)

## Implementation progress (Phase 1 WS1, 2026-09-06)

- `server/config/env.ts` + `server/config/productionValidation.ts` — типізований config, production
  не стартує без `TELEGRAM_BOT_TOKEN`, при `AUTH_MODE=development`, при localhost-origin або
  `sql` без `DATABASE_URL`.
- `server/auth/telegramInitData.ts` — hardened verifier: єдиний `hash`, sorted data-check-string,
  `crypto.timingSafeEqual` з length-guard, `auth_date` freshness + clock-skew, безпечний парсинг
  `user`, типізований `AuthenticatedPrincipal`.
- `server/auth/middleware.ts` + `server/auth/socket.ts` — fail-closed HTTP і Socket.IO auth,
  `x-user-id` більше не автентифікує; `req.auth` / `socket.data.principal`. Cross-user доступ
  відхиляється порівнянням з `req.auth.userId`, не з заголовком.
- `server/auth/devIdentityProvider.ts` — explicit `AUTH_MODE=development`, неможливий у production
  (гарантовано `assertProductionConfig`), друкує попередження при старті.
- Rollback: прапорці `authV2` / `secureKahootIdentity` (default ON), break-glass
  `FEATURE_AUTHV2=false` на один реліз; legacy `server/middleware/telegramAuth.ts` поки збережено.
- Тести: `server/auth/telegramInitData.test.ts`, `server/config/productionValidation.test.ts`,
  `server/__tests__/integration/{auth,socket}.test.ts`.

## Implementation progress (Phase 1 WS2, 2026-09-06)

- `server/authz/roles.ts` — типізована таксономія `Role` / `Permission`, `ROLE_PERMISSIONS`
  (admin — superset; `questions:admin` admin-only до Phase 4 Content Studio).
- `server/authz/roleRegistry.ts` — config-sourced grants (`RBAC_ROLE_GRANTS` JSON + `RBAC_ADMIN_IDS`),
  парсинг fail-safe (невалідний JSON / невідома роль → warning, не crash, без escalation).
- `server/authz/policy.ts` — `requireRole`, `requirePermission`, `requireOwnResourceOrPermission`;
  стабільні коди `forbidden_role` / `forbidden_permission` / `forbidden_user_scope`;
  прапорець `rbacV2` (default ON), break-glass `FEATURE_RBACV2=false`.
- `server/audit/` — append-only `AuditLog` port: JSONL adapter (`.data/audit-log.jsonl`,
  `appendFileSync`), SQL adapter + таблиця `audit_log` (`server/db/schema.sql`), `redactAuditMetadata`.
  Кожна admin-мутація і кожен authz-denial → audit record (actor, action, target, result, requestId).
- `server/routes/me.ts` — self-scoped `/api/v1/me/*` (identity з `req.auth`, без `:userId`);
  legacy `/profile/:userId` тимчасово збережено (WS4 видаляє), спільна логіка в
  `server/services/profileService.ts`.
- `server/routes/questionsAdmin.ts` — auth + `requirePermission('questions:admin')` перед mount;
  production відхиляє прямі FS-записи без `QUESTION_ADMIN_FS_WRITES=true`.
- Тести: `server/authz/*.test.ts`, `server/audit/jsonlAuditLog.test.ts`,
  `server/__tests__/integration/rbac.test.ts`.
- **Ще не зроблено (наступні workstreams):** persisted role store + runtime grant/revoke API (WS3),
  server session bridge, rate limiting (WS4), видалення legacy `x-user-id` / `/profile/:userId` (WS4).

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
**Статус:** accepted, implementation in progress (Phase 1 WS3)

## Implementation progress (Phase 1 WS3, 2026-09-06)

- `server/wallet/` — immutable ledger port: `earn` / `spend` / `migration_opening` /
  `adjustment` / `reversal`; balance = `sum(amount)`, ніколи mutable integer;
  idempotent на `(sourceType, sourceId)`; no negative balance; JSON adapter
  (`.data/wallet.json`, atomic + per-file mutex) + SQL adapter (`wallet_ledger`,
  one-statement CTE insert) + `wallet_ledger` таблиця.
- `server/lib/idempotency.ts` — `IdempotencyStore` (recall/remember, TTL 24h,
  cap 5000) — command-level replay cache поверх ledger-рівневої гарантії.
- `server/progression/` — `computeCompletion(kind, boundedInput, snapshot)`:
  server рахує coins/wisdom/rank/wins/streak/achievements; client-supplied
  totals не читаються; bounds (`correctCount<=total<=100`, difficulty enum, coin
  caps). `rankMath.ts` — faithful port `advancePlayerRank`/`computeStageWisdom`
  (як `server/lib/streak.ts` для `updateStreak`); sync до Phase 2 consolidation.
- `POST /api/v1/progression/completions` — єдина Phase-1 command (`level` /
  `practice_stage` / `millionaire` / `survival`) → wallet entry + authoritative
  profile write + `ProgressionOutcome { eventId, previous, next, delta }`; стабільний
  `eventId = hash(userId, sourceId)`.
- `PATCH /api/v1/me/preferences` — whitelist (displayName, bibleTranslation,
  activeTheme∈owned, avatar∈owned). `writeProfile(mode: 'full'|'preferences')`:
  при `authoritativeProfileV2` ON legacy `PUT /profile` **вирізає** authoritative
  поля (coins, playerRank, streak, achievements, completedLevels, mastery,
  practiceTracks, wins, unlocks, themePoints); при `disableLegacyProfileWrites`
  ON → 409.
- `POST /api/v1/me/migrate` — one-time bounded: coins cap `MIGRATION_MAX_COINS`
  (default 100000), `migration_opening` wallet entry (sourceId = userId),
  `migration_records` таблиця, `auditLog` action `migration.claim`; повтор →
  recorded result, без другого credit.
- `server/db/atomicJson.ts` — `writeJsonFileAtomic` (tmp + fsync + rename) +
  `withFileMutex`; `jsonStore` переписаний з debounce на synchronous atomic write.
- Прапорці (default OFF): `authoritativeProfileV2`, `disableLegacyProfileWrites`.
  `walletLedgerV1` з §17 folded у `authoritativeProfileV2` (ADR-011 anti-sprawl).
- Тести: `server/{db,wallet,progression}/*.test.ts`, `server/lib/idempotency.test.ts`,
  `server/__tests__/integration/progression.test.ts`.
- **Ще не зроблено (WS4):** cutover React-клієнта (`PlayerContext`/`playerRepo`) на
  нові endpoints, flip прапорців ON, видалення legacy `PUT /profile` + `x-user-id`,
  Phase 1 DoD sign-off; per-game endpoints (§7.2) — Phase 2.

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
**Статус:** accepted, implementation in progress (Phase 1 WS3 — atomic JSON + wallet)

## Implementation progress (Phase 1 WS3, 2026-09-06)

- `server/db/atomicJson.ts` — mutable JSON adapters пишуть atomic (tmp + `fsync` +
  `rename`); `withFileMutex` серіалізує concurrent mutations одного файлу в межах
  процесу. `jsonStore` більше не debounce-ить.
- Новий domain contract per store: `WalletLedger`, `IdempotencyStore`,
  `MigrationStore` — по одному JSON adapter (dev) і одному SQL adapter (prod),
  без зміни contract. SQL wallet `post` — one-statement CTE (balance check +
  `on conflict do nothing`), тобто atomic без явної транзакції.
- Postgres обовʼязковий лише в production (`STORAGE_PROVIDER=sql`); JSON — dev/fixtures.

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

# ADR-009 — Ребрендинг на тему «Світло» і semantic theme system

**Дата:** 2026-08-02  
**Статус:** accepted, implementation pending Phase 3  
**Деталі:** [`PHASE_3_REBRANDING_AND_THEME_SYSTEM.md`](./PHASE_3_REBRANDING_AND_THEME_SYSTEM.md), [`DESIGN_RULES.md`](./DESIGN_RULES.md)

## Контекст

Поточний код використовує темну тему `classic` як default і ранню модель косметичних themes. Власник продукту затвердив новий візуальний напрям за наданими референсами: теплий світлий фон, deep navy, restrained gold, serif display typography, м’які картки, багато повітря та стримані духовні ілюстрації.

Потрібно уникнути двох помилок:

- механічно скопіювати окремі кнопки, navigation або screen structure з референсів;
- створити один жорстко захардкоджений світлий дизайн, який неможливо розширити майбутніми темами.

## Рішення

- канонічний напрям бренду: **premium spiritual minimalism**;
- базова тема: `Світло` зі stable ID `light`;
- `Світло` є безкоштовною, always-available і default theme;
- основний canvas — warm ivory;
- primary functional color — deep navy;
- muted gold — spiritual/progress accent, а не універсальний CTA;
- Cormorant Garamond використовується для display hierarchy, Source Sans 3 — для UI;
- референси визначають visual language, але не product IA;
- усі компоненти переходять на semantic tokens;
- legacy CSS variables тимчасово мапляться на нові aliases;
- current `classic` і вибір existing users зберігаються під час migration;
- future themes не можуть змінювати layout, behavior, accessibility, rewards або difficulty;
- default theme architecture реалізується в Phase 3;
- catalog, prices, wallet purchases та entitlements додаткових themes реалізуються в Phase 6.

## Alternatives considered

### Залишити `classic` основною

Відхилено: не відповідає затвердженому світлому продуктового відчуттю.

### Зробити лише один світлий hardcoded UI

Відхилено: блокує theme economy і створює дублювання стилів.

### Копіювати референсні екрани один в один

Відхилено: референси можуть суперечити поточним routes, learning architecture і функціоналу.

### Одразу реалізувати багато платних themes у Phase 3

Відхилено: Phase 3 має довести contract на default theme; economy й entitlements належать Phase 6.

## Наслідки

Позитивні:

- одна впізнавана ідентичність;
- кращий mobile UX;
- системна підтримка майбутніх themes;
- менше hardcoded colors;
- чітка межа між дизайном і economy;
- accessibility baseline.

Ризики:

- migration великої кількості legacy styles;
- FOUC при неправильному fallback;
- regression existing themes;
- надмірне використання gold або imagery;
- bundle growth від theme assets.

## Обов’язкові gates

- token migration plan;
- visual regression;
- accessibility audit;
- Telegram Android/iOS review;
- existing theme preservation;
- invalid theme fallback;
- no FOUC;
- feature flag і rollback;
- owner final visual review.

## Rollback

Під час rollout old renderer і `classic` залишаються доступними за feature flag. Rollback не може скидати purchased themes, profile settings, progress або wallet data.

---

# ADR-010 — Одна канонічна motion-система з authoritative celebrations

**Дата:** 2026-08-02  
**Статус:** accepted, implementation distributed across Phase 1–7  
**Деталі:** [`MOTION_SYSTEM.md`](./MOTION_SYSTEM.md)

## Контекст

Проєкт уже має `framer-motion`, shared variants, MotionSheet і MotionDialog, але без повного contract майбутні екрани можуть отримати різні easing, надмірні celebrations, duplicate animation після reconnect або оптимістичну анімацію непідтвердженої нагороди.

## Рішення

- motion Bible Games має характер calm premium SaaS interaction design;
- `MOTION_SYSTEM.md` є єдиним domain source of truth;
- зберігається один animation package;
- routine motion стриманий, major celebration дозволена лише для рідкісної важливої події;
- final reward/purchase/competitive motion запускається лише authoritative event;
- stable event ID запобігає replay;
- reduced/minimal motion обов’язковий;
- themes можуть змінювати decorative palette, але не semantics і critical behavior;
- Phase 1–2 створюють event foundation, Phase 3 — core motion, Phase 5 — social/multiplayer, Phase 6 — economy/shop, Phase 7 — release hardening.

## Наслідки

Позитивні:

- один motion language;
- premium відчуття без arcade noise;
- менший ризик duplicate celebration і fake success;
- accessibility та performance перевіряються системно.

Негативні:

- implementation розподілена між фазами;
- потрібні visual fixtures і authoritative event contracts;
- частину legacy inline motion доведеться мігрувати.

## Rollback

Visual motion може бути feature-flagged або reduced до opacity-only, але rollback не може повертати client-authoritative rewards, дублювання events або відсутність reduced-motion support.

---

# ADR-011 — RBAC у Phase 1 config-sourced, store-backed пізніше

**Дата:** 2026-09-06
**Статус:** accepted, implementation in progress (Phase 1 WS2)

## Контекст

Phase 1 §6 вимагає server-side ролі, permissions, policy middleware і audit log.
Persisted role store, runtime grant/revoke API і legacy-profile migration належать
WS3 (який володіє розширенням storage contract). WS2 потрібна лише authority-межа,
не повний CRUD ролей.

## Рішення

- У Phase 1 ролі призначаються **лише через конфіг**: `RBAC_ROLE_GRANTS` (JSON
  `{"<userId>":["admin",...]}`) + `RBAC_ADMIN_IDS` (shortcut). Парситься один раз
  у `loadConfig` у типізований `RoleRegistry`.
- Frontend `VITE_ADMIN_IDS` ніколи не є authority (лише UX-приховування меню).
- Permissions виводяться з ролей (`ROLE_PERMISSIONS`); `questions:admin` — тільки
  для `admin` до появи Phase 4 Content Studio (ADR-004).
- Audit log **персиститься вже зараз** (append-only JSONL / SQL), бо Phase 1
  Definition of Done вимагає queryable audit records.
- Runtime grant/revoke API + persisted role store — WS3.

## Наслідки

- Немає міграції БД у WS2; зміна ролі = деплой конфігу (прийнятно для одного власника).
- Парсинг fail-safe: зламаний `RBAC_ROLE_GRANTS` → warning + нуль grants, ніколи
  не crash і ніколи не privilege escalation.

## Rollback

`FEATURE_RBACV2=false` на один реліз — policy middleware вироджується до
«authenticated достатньо» (поведінка WS1). Auth при цьому залишається обов'язковим.

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