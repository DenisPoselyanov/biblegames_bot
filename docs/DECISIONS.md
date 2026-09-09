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

## Implementation progress (Phase 1 WS4 part 2, 2026-09-07)

- Rollout break-glass прапорці **видалено разом із fallback-гілками**: `authV2`,
  `secureKahootIdentity`, `rbacV2` (+ `authoritativeProfileV2`,
  `disableLegacyProfileWrites`, `server_streak` — див. ADR-003/006). Fail-closed
  Telegram auth, RBAC policy enforcement і server-authoritative progression —
  тепер безумовні. Break-glass window (один реліз) закрито доказами WS1–WS4pt1.
- Видалено `server/middleware/telegramAuth.ts` (legacy verifier), legacy
  `/profile/:userId` + `/stats/:userId` + `/study/answers/:userId` +
  `/telemetry/:userId` роути, whole-profile `PUT` (і `/api/v1/me/profile` PUT),
  мертвий `server/storage.ts`. `x-user-id` більше не існує як шлях автентифікації
  (лишається лише як dev-identity fixture при `AUTH_MODE=development`).
- Клієнт: прапорець `authoritative_profile` видалено; `playerRepo` / `statsRepo` /
  `studyRepo` / `telemetry` ходять лише на `/api/v1` (з локальним fallback при
  offline / no API base); `mergeProfiles` та `apiFetch` (+ `x-user-id`) видалено.
- Rate limiting (§13): in-memory fixed-window (`server/middleware/rateLimit.ts` +
  `server/lib/socketRateLimit.ts`), per principal-or-IP; окремі політики для
  auth/prefs/progression/shop/migrate/telemetry/admin і для socket
  create_room/join_room/submit_answer; `429` через стандартний error envelope із
  `Retry-After`. Single-instance — розподілений store це Phase 2/7.
- Observability (§16): `server/lib/logger.ts` (JSON-line structured logs),
  `server/lib/metrics.ts` (in-process лічильники: `auth_failed_total`,
  `authz_denied_total`, `rate_limited_total`, `idempotency_replay_total`,
  `reward_failed_total`, `server_error_total`), `GET /health/live`,
  `GET /health/ready`, `GET /metrics`, secret-free startup summary, request-id у
  socket-логах.
- Demo-роути (`/study/path`, `/dashboard`, `/leaderboard`, …) винесено в
  `server/routes/demo.ts` і монтуються лише при `config.demoRoutesEnabled`
  (`nodeEnv !== 'production'`) — у production їх фізично немає.
- Тести: `rateLimit.test.ts`, `metrics.test.ts`, integration `observability` +
  `rateLimit`; legacy auth/profile/flag тести переписано. `npm run check` green,
  146 тестів.

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

## Implementation progress (Phase 1 WS4 part 2, 2026-09-07)

- Прапорці `authoritativeProfileV2` / `disableLegacyProfileWrites` (server) і
  `authoritative_profile` (client) **видалено** — server-authoritative
  progression/wallet/shop/migration безумовні. `server_streak` + legacy
  `recomputeStreak`-гілка в `profileService` видалені (streak рахує
  `completionOutcome`). `writeProfile(mode)` згорнуто до `writePreferences`
  (whitelist-only). `readProfile` завжди повертає баланс із wallet ledger.
- Клієнт остаточно на `/api/v1`: `playerRepo.get/save` → `progressionRepo`
  (+ one-time `migrate`), `statsRepo` read-through `/me/stats`, `studyRepo`
  history через mastery-команду, `telemetry` → `/api/v1/me/telemetry`.
  Fallback на локальний розрахунок при offline/no API base збережено.
- Деталі rate limiting / observability / DoD sign-off — див. ADR-002 (WS4 part 2)
  і `docs/phases/PHASE_1_...md` §23.

## Implementation progress (Phase 1 WS4 part 1, 2026-09-07)

Все ще за прапорцем `authoritativeProfileV2` (server) / `authoritative_profile`
(client), обидва default OFF. Частина 2 (flip + видалення legacy + DoD) окремо.

- Закрито server-gaps, без яких flip зламав би клієнт:
  - `server/progression/practiceTracks.ts` — `applyPracticeStage()` виводить
    `stageResults` + `highestUnlockedStage` з `practice_stage` подій; unlock =
    «попередній етап пройдено». Нагороди інкрементні над попереднім best етапу.
  - `server/progression/masteryMath.ts` — порт `updateMastery`; `mastery-expert`
    при mastery == 100 (клієнтський `>= 0.99` — баг, не відтворено).
  - `server/progression/globalStats.ts` — `GlobalStats` виводиться з completion.
  - `POST /api/v1/progression/answers` — server-authoritative mastery + історія.
  - `POST /api/v1/shop/purchases` — ціна з каталогу на сервері, `spend` у ledger
    (overdraw → 409), ownership + `aesthete`, audit `shop.purchase`.
  - survival → `iron-shield` (30+), millionaire → `biblical-millionaire` (win).
- `PATCH /api/v1/me/learning-state` — `reviewSchedules` зберігається як
  **client-owned opaque blob** (сервер не рахує і не нагороджує з нього).
  Це **tracked Phase-1 DoD exception**: повна server-authority для review
  scheduling — Phase 3 (§7.4 «detailed learning model belongs to Phase 2/3»).
- Клієнт: `src/repos/progressionRepo.ts` + flag-gated repoint у `playerRepo`/
  `statsRepo`/`studyRepo`/`telemetry`; `PlayerContext` completion-методи async →
  команди; ADR-010 celebration replay guard за `eventId`; kahoot handshake
  identity. Fallback на локальний розрахунок при offline/помилці.
- Тести: `masteryMath` port-equivalence, practice-track derivation +
  incremental replay, shop (insufficient/owned/unknown/replay), answers,
  `learning-state`, `progressionRepo` (URL/headers/error mapping). 138 green.

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

## Implementation progress (Phase 1 WS4 part 2, 2026-09-07)

- Останній client-trusted write-шлях (whole-profile `PUT`) видалено — усі
  authoritative мутації йдуть через транзакційні команди (wallet CTE / atomic
  JSON + mutex). Мертвий `server/storage.ts` (неатомарний `writeFileSync`-adapter,
  без importer'ів) видалено.
- Rate-limit і metrics store — in-memory single-instance (свідомо, Phase 1 §18
  «minimal services; Phase 2 consolidates»); distributed backend — Phase 2/7.
  **Оновлення (Phase 2 WS2 part 4):** rate-limit store винесено за інтерфейс
  `RateLimitStore` + Postgres-адаптер (`rate_limit_counters`, атомарний
  fixed-window upsert), який вмикається коли є БД; in-memory лишається дефолтом.
  Metrics store — навмисно ще in-process (cross-instance = реальний backend:
  Prometheus scrape / StatsD), відкладено до Phase 7 разом із deployment.

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

## Update (Phase 1 WS4 part 2, 2026-09-07)

Break-glass window закрито: `FEATURE_RBACV2` і його fallback-гілка видалені —
policy enforcement безумовний. Config-sourced grants (`RBAC_ROLE_GRANTS` /
`RBAC_ADMIN_IDS`) без змін; persisted role store + runtime grant/revoke — Phase 2.

## Update (Phase 2 WS2 part 3, 2026-09-08) — handoff closed

Persisted role store + runtime grant/revoke landed:

- `user_roles` (provenance + `revoked_at`) — WS2 part 2; `RoleRepository` +
  contract tests.
- `server/authz/roleResolver.ts` — `RoleResolver` is the single async seam.
  `attachPrincipalRoles` middleware resolves роль+permissions на `req.authz`
  одразу після `requireAuthenticated`; `policy.ts` / `routes/me.ts` — синхронні
  читачі. `createPersistedRoleResolver` читає `user_roles` і **юнить** config
  grants як **un-revokable floor** (short-TTL per-user cache + `invalidate` при
  зміні; збій читання store → деградація до floor, ніколи не 500 і не
  escalation). Без БД → `createConfigRoleResolver` (стара поведінка).
- `server/authz/roleService.ts` + `server/routes/adminRoles.ts` —
  `GET/POST/DELETE /api/v1/admin/roles/:userId`, `admin`-only, mount лише коли
  підключено persisted identity store. Audit `rbac.role_granted` / `_revoked`,
  guard проти self-revoke власної `admin`-ролі; `grant` **і** `revoke` вимагають
  наявного `users`-рядка (404 `user_not_found` інакше). Контракт —
  `contracts/api/admin.ts`.
- `server/authz/principalIdentity.ts` — `attachPersistedIdentity` у authed-
  ланцюгу (спека §11 `IdentityService.resolveTelegramUser`): на першому запиті
  кожен автентифікований principal upsert-иться у `users` + `external_identities`
  (per-process «seen»-кеш, TTL 1h; збій запису best-effort, лог + пропуск). Без
  цього кроку `users` у проді порожня і будь-який runtime grant → 404. Монтується
  лише разом з persisted identity store.
- `RBAC_ADMIN_IDS` тепер bootstrap floor для першого admin, який далі роздає
  ролі через API. Зняти config-floored роль = правка конфігу.
- Cross-instance: `RoleResolver.invalidate()` — process-local. На інстансі, що
  зробив зміну, вона видима одразу; інші сходяться за TTL резолвера — `ttlMs`
  (30s) для plain-users, коротший `privilegedTtlMs` (5s) для principal з будь-
  якою elevated-роллю, щоб revoke розповсюджувався швидко. Справжня cross-
  instance інвалідизація (pg `LISTEN/NOTIFY` або спільний кеш) — Phase 7 разом
  із deployment topology.

Rollback: без `AppDeps.database` резолвер повертається до config-only, а
admin-роут (і identity-upsert крок) просто не монтуються — request path не має
break-glass прапорця, enforcement лишається безумовним.

## Update (Phase 2 WS2 part 4, 2026-09-08) — shared rate-limit store

Закриває Phase 1 §13 single-instance handoff:

- `server/middleware/rateLimitStore.ts` — інтерфейс `RateLimitStore` +
  `createMemoryRateLimitStore` (стара `Map`-логіка, дефолт).
- `server/infrastructure/database/repositories/rateLimitStore.ts` —
  Postgres-адаптер: один атомарний `INSERT … ON CONFLICT DO UPDATE` на hit,
  вікно котиться в `CASE` (race-free між інстансами). Таблиця
  `rate_limit_counters` (міграція `0002`), прибирання застарілих рядків — WS5
  pg-boss job.
- `rateLimit.ts` / `socketRateLimit.ts` тепер async; `hitLimit` **fail-open**
  при збої store (+ `rate_limit_store_error_total`) — лімітер не має класти
  request path. `createApp` бере SQL-store коли є `deps.database`;
  `configureRateLimitStore` ставить його на module-singleton, `resetRateLimits`
  повертає свіжий in-memory (ізоляція тестів).
- Metrics store — свідомо ще in-process (Phase 7, з deployment). Прапорець
  `legacyStoreReadOnly` — це WS5 cutover, не тут.

---

# ADR-013 — Zod як єдина runtime-schema для всіх меж, `contracts/` як source of truth

**Дата:** 2026-09-07
**Статус:** accepted, implementation in progress (Phase 2 WS1)

## Контекст

Phase 2 §8 вимагає один runtime-validation підхід для HTTP, Socket.IO, imports і
tests; §7 — versioned canonical schemas; §25 забороняє ділитися frontend-типами як
неперевіреними server-контрактами. `OPEN_SOURCE_REFERENCE_ARCHITECTURE.md` §4.2
призначає Zod на Phase 1–2. У Phase 1 Zod фактично не вводився (валідація —
ad-hoc `String(x ?? '')` + `sanitize*`).

## Рішення

- Runtime-схема — **Zod 3.x** (пряма залежність). Альтернативи (Valibot, TypeBox,
  ручний JSON Schema) відхилені: Zod уже у транзитивному дереві, найбільша
  екосистема, `z.infer` покриває вимогу «типи походять зі схеми».
- Канонічні контракти живуть у top-level **`contracts/`** — не в `src/`, не в
  `server/`. Компілюється в обидва бандли; `@contracts` alias. Правила — у
  `contracts/README.md`: жодних імпортів окрім `zod` і сусідніх модулів;
  `CONTRACT_VERSION` (semver) б'ється лише на breaking change шіпнутого контракту;
  критичні значення відхиляються, не коерсяться.
- `validateBody(schema, code?)` middleware парсить `req.body`, замінює на
  типізоване значення, на помилку кидає `400 AppError` з `fieldErrors` і стабільним
  per-surface кодом (`invalid_completion`, …).
- Error envelope (§7.5): `AppError` отримав `messageKey` / `fieldErrors` /
  `retryable`; `errorHandler` емітить новий envelope + legacy `fields` (вікно
  cutover) + мапить `ZodError` → envelope.
- Parity-тести пінять `contracts` enums до `src/types` (`DIFFICULTIES`) і
  `server/authz/roles.ts` (`ROLES`) поки клієнт і RBAC не перейдуть на `@contracts`
  (Phase 3 / WS2).
- Architecture-тести (§21): `contracts/` purity + cycle-freedom; `src/ ↛ server/`;
  `server/domains/ ↛ express/socket.io/react`; composition будується без порту.

## Не входить у WS1

Повний OpenAPI-ген, generation з `contracts` у OpenAPI/клієнт SDK, dependency-cruiser
(full-repo cycles + `services ↛ express`), перехід `server/authz` і React-клієнта на
`@contracts`. Прапорець `generatedContracts` зарезервований.

## Rollback

`validateBody` можна зняти з роуту точково (повертає ad-hoc парсинг Phase 1); envelope
залишається сумісним, бо `fields` емітиться далі. `contracts/` не має рантайм-побічних
ефектів окрім валідації.

---

# ADR-012 — ORM і міграційний фреймворк (Drizzle)

**Дата:** 2026-09-07
**Статус:** accepted (spike підтвердив 2026-09-07 — `spike/drizzle/FINDINGS.md`),
implementation у Phase 2 WS2

## Контекст

Phase 2 §9 вимагає визначені core-таблиці з міграціями; §10 — repository-інтерфейси
з contract-тестами; §18.1 — міграційний фреймворк з журналом/checksum/ordered IDs/
staging rehearsal. Поточний стан (Phase 1): сирий `pg` Pool
(`server/db/pgPool.ts`) + рукописний `server/db/schema.sql` + JSON-адаптери, без
міграційного журналу. `OPEN_SOURCE_REFERENCE_ARCHITECTURE.md` §3 і owner
попередньо затвердили Drizzle + Drizzle Kit 2026-09-07.

## Рішення

- **ORM — `drizzle-orm` 0.44.x** (пряма `dependencies`), адаптер
  `drizzle-orm/node-postgres` поверх наявного `pg.Pool` — lazy-import і
  `isDatabaseConfigured()` gate не чіпаються, raw SQL і Drizzle ділять один пул,
  адопція таблиць інкрементальна.
- **Міграції — `drizzle-kit` 0.31.x** (`devDependencies`). `drizzle-kit generate`
  дає ordered IDs + `meta/_journal.json` (журнал v7) + checksummed snapshot
  offline, без конекшена. Покриває 7/9 властивостей §18.1; backup/restore і
  forward-fix для незворотних змін — це runbook (WS5 deploy doc), не інструмент.
  `push` — лише dev; staging/prod — тільки `migrate`.
- **Контракти проти ORM-типів (§25):** `@contracts` (Zod) лишається єдиним
  джерелом для кожної process/network межі. Drizzle `InferSelectModel` — це
  *storage*-типи, внутрішні для `server/infrastructure/`. Repository — шов
  маппінгу; `jsonb`-колонка з контрактним типом декларується
  `.$type<TheContract>()` **і** `schema.parse()`-иться на читанні (DB — trust
  boundary, §8). `drizzle-zod` — лише для внутрішніх insert-guard, ніколи не
  реекспортується з `contracts/` (додати lint-правило у WS2).
- **Transaction** — `db.transaction(async (tx) => …)`; `tx` кладеться у вже
  зарезервований `ServiceContext.tx` (`server/domains/shared/context.ts`).
  Repo без `tx` читає на пулі.
- Схема — по-доменні файли у `server/infrastructure/database/`, реекспорт у барел;
  `drizzle.config.ts` у корені → `server/migrations/`.

## Alternatives

Prisma (важчий рантайм, окремий engine, гірша ESM/edge історія), Kysely (лише
query-builder, без міграцій — довелося б додавати окремий інструмент), сирий `pg`
далі (не задовольняє §10/§18.1). TypeORM/Sequelize — legacy-стиль, decorator-heavy.

## Наслідки

- `server/db/sqlStore.ts` + `schema.sql` поступово замінюються repository-адаптерами;
  перша міграція адоптує наявні `wallet_ledger` / `migration_records` (DDL
  Drizzle — колонка-в-колонку з `schema.sql`, спайк перевірив), без data-move.
- JSON-адаптери лишаються для fixtures/dev, проходять ті ж read-контракти;
  production-writes через них не емулюють транзакції (§10).
- Новий прапорець `legacyStoreReadOnly` для cutover.

## Migration / security impact

Міграції транзакційні (PG DDL), journal-guarded rerun — no-op. Жодних секретів у
`drizzle.config.ts` — URL з типізованого env (§19). RBAC переїжджає з config у
`user_roles` з provenance (закриває handoff ADR-011).

## Rollback

Drizzle обгортає наявний Pool — роут/домен можна лишити на `sqlStore`/raw SQL
точково. `drizzle-kit` не потрібен у рантаймі (тільки dev/CI/deploy). Якщо ORM
не влаштує — repository-інтерфейси (§10) вже ізолюють виклики, адаптер міняється
без зміни доменів.

## Spike

`spike/drizzle/` — schema-зріз, `contract-bridge.ts` (композиція типів),
`repositories.ts` (інтерфейси + Drizzle-адаптер + in-memory peer),
`0000_clammy_owl.sql` (згенерована міграція). Видаляється / складається в
`server/infrastructure/database/` коли WS2 пише справжній шар.

---

# ADR-014 — Background job queue

**Дата:** 2026-09-07 (proposed) → 2026-09-09 (accepted, Phase 2 WS5 part 1)
**Статус:** accepted. Абстракція + in-memory адаптер — WS5 part 1 (готово).
Durable Postgres/pg-boss адаптер — **відкладено** (part 1b, fast-follow): спайк
2026-09-09 показав, що `pg-boss@12` `boss.start()` зависає під pglite (навіть із
`fromPglite` і `supervise:false`), тож контракт-тест потребує справжнього
Postgres у CI — окрема інфраструктурна робота. In-memory адаптер повністю
покриває §17 як default; durability — не нумерований acceptance-критерій.

## Контекст

Phase 2 §17 вимагає job-абстракцію для: content import/indexing, майбутньої AI-
генерації, створення publication-снапшотів, telemetry-агрегації, cleanup/expiry,
пізніше — email/notifications. Job-контракт: ID, type, status, attempts,
created/started/completed time, error, checkpoint, idempotency. Довгі задачі не
можна тримати всередині HTTP-запиту. Owner попередньо затвердив pg-boss
2026-09-07, щоб не вводити Redis заради jobs (ref-arch §3.10) — черга живе в тому
самому Postgres, що й решта даних (ADR-012).

## Рішення

- **Доменна абстракція `JobQueue`** (`server/domains/jobs/`) — чиста, без `pg`/
  Express/Socket.IO. `register(type, {handler, maxAttempts, everyMs})`,
  `enqueue(type, payload, {idempotencyKey, maxAttempts, delayMs})`, `start()`,
  `stop(graceMs)`, `stats()`. `JobRecord` несе всі поля §17. `JobContext` дає
  `checkpoint(patch)` (retry бачить попередній checkpoint) і `AbortSignal`
  (`stop()` сигналить хендлерам).
- **`server/domains/jobs/catalog.ts`** — реєстр відомих типів + Zod-схема payload
  на кожен: невалідний `enqueue` падає на межі, не всередині хендлера.
- **In-memory адаптер** (`inMemoryQueue.ts`) — default і єдиний варіант без БД.
  Poll-loop після `start()`, capped-exponential backoff, dead-letter після
  `maxAttempts`. Не переживає рестарт. Тестовий хук `runDue()` обходить таймер.
- **Postgres/pg-boss адаптер** (`server/infrastructure/jobs/`, WS5 part 1b —
  відкладено) — durable-варіант за `JOB_QUEUE_DRIVER=postgres`. pg-boss керує
  власною схемою (`pgboss.*`) через `boss.start()` — поза міграційним
  фреймворком §18.1 (документований кордон); checkpoint — окрема drizzle-таблиця
  `job_checkpoints`. Поки не готовий — `createJobQueue` падає назад на in-memory
  з гучним warn (`jobs.driver_unavailable`), а production-gate вимагає
  `DATABASE_URL` за `JOB_QUEUE_DRIVER=postgres`.
- **Окремий worker-процес** (`server/worker.ts`, §19) — не біндить порт, окремо
  рестартиться, `JOB_SCHEDULES_ENABLED=true` тільки в ньому (розклади мають
  крутитись рівно в одному місці). API-процес може лише `enqueue`.
- **Перші хендлери — три retention-sweep-и** (§17 cleanup/expiry), кожен —
  один bounded `DELETE`: `rate_limit_counters` (застарілі вікна),
  `idempotency_keys` (SQL-стор ніколи не чистив — тільки JSON), `telemetry_events`
  (необмежений append). Розклад — раз на 6 год.
- **Метрики** — `jobs_enqueued_total` / `_started_total` / `_completed_total` /
  `_retried_total` / `_failed_total`, лейбл `{type}` (low-cardinality).

## Alternatives

BullMQ / bee-queue (потрібен Redis — зайва інфра для одного VPS), Agenda (MongoDB),
graphile-worker (близький аналог pg-boss, менша спільнота), «просто `setInterval`
в API-процесі» (не durable, дублюється при кількох інстансах, змішує
відповідальності — §19).

## Наслідки

- Нова змінна env: `JOB_QUEUE_DRIVER` (`memory`|`postgres`, default `memory`),
  `JOB_SCHEDULES_ENABLED` (default off). Production-gate: `postgres` вимагає
  `DATABASE_URL`.
- Новий npm-скрипт `worker` / `worker:dev` (root + `server/`).
- pg-boss потрапить у `dependencies` у part 1b (v12: deps `cron-parser`,
  `serialize-error` + bump `pg` 8.21→8.23 — lockfile-діф чистий ~80 рядків,
  перевірено 2026-09-09); поки не додано.
- `content/snapshot.ts` `buildSnapshot` став хендлером типу `content.snapshot`
  (WS5 part 2) — пише через `ObjectStore` (ADR-015).

## Rollback

`JobQueue`-інтерфейс ізолює виклики: адаптер міняється без зміни продюсерів.
Прибрати worker з deploy → sweep-и просто не крутяться (застарілі рядки
нешкідливі, наступний hit їх перезаписує). Жодних незворотних змін даних.

---

# ADR-015 — Object storage: filesystem default, hand-rolled SigV4 для S3

**Дата:** 2026-09-09
**Статус:** accepted, implementation у Phase 2 WS5 part 2.

## Контекст

Phase 2 §19 і ref-arch §3.6 вимагають S3-сумісний адаптер об'єктного сховища для
**виходів**: published-content снапшоти (§14), пізніше export-бандли, сирі
AI-артефакти (Phase 4), медіа. §19 також: «single VPS may host multiple
processes» і «secrets are not bundled into Vite». Наявний стан — лише JSON-файли
на диску через `atomicJson`.

## Рішення

- **Доменний інтерфейс `ObjectStore`** (`server/domains/storage/objectStore.ts`)
  — `put` / `get` / `head` / `delete` / `list(prefix)`. Чистий, без `fs`/мережі.
  Ключі — `/`-розділені, без `.`/`..`/провідного слешу (`assertValidObjectKey`).
- **`filesystem` адаптер — default** (`server/infrastructure/storage/`). Один
  файл на ключ + `<key>.meta` сайдкар (content-type, metadata, sha-256 etag).
  Атомарний запис (temp + `rename`, як JSON-стори — ADR-006). Це домівка
  снапшотів на одному VPS. Корінь — `OBJECT_STORAGE_DIR` (default
  `server/.data/objects`, у `.gitignore`).
- **`s3` адаптер — шлях масштабування**. `OBJECT_STORAGE_DRIVER=s3` +
  `S3_ENDPOINT`/`S3_BUCKET`/`S3_REGION`/`S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY`
  (+ опц. `S3_KEY_PREFIX`). Говорить S3 REST через `fetch` + **власний SigV4**
  (`sigv4.ts`, ~110 рядків, звірено з AWS `aws4_testsuite` векторами) — **без
  `aws-sdk`** (важкий, ~20 МБ transitively, для 4 операцій — надмір). Path-style
  адресація за замовч. (MinIO/R2/B2 усі приймають). Секрети — тільки в
  server-only `env.ts`, ніколи не в клієнтський бандл.
- **`memory` адаптер** — тести. Усі три проходять спільний `objectStoreContract`.
- **Не в БД, не source of truth** (§25): снапшот регенерується з канонічного
  стору; `content.snapshot`-джоб пише `snapshots/<setId>/<contentHash>.json` +
  `latest.json`.

## Alternatives

`@aws-sdk/client-s3` (важкий, ESM-проблеми, 50+ transitive), `minio` client
(теж чималий, тільки MinIO/AWS), `aws4fetch` (крихітний, але зайва залежність
там, де 110 рядків signing вистачає і повністю тестуються). Тримати снапшоти в
Postgres BYTEA — змішує output зі стором, роздуває БД.

## Наслідки

- env: `OBJECT_STORAGE_DRIVER` (`filesystem`|`s3`), `OBJECT_STORAGE_DIR`,
  `S3_*`. Неповна S3-конфігурація → warn + fallback на `filesystem`.
- `.gitignore` += `server/.data/objects/`.
- S3-адаптер **не** покритий інтеграційним тестом проти живого MinIO у CI —
  signing протестовано юніт-векторами; live-lane — ручний / майбутній.

## Rollback

`ObjectStore`-інтерфейс ізолює: драйвер міняється конфігом без зміни продюсерів.
`filesystem` не має зовнішніх залежностей. Снапшоти — виходи, їх втрата
безпечна (регенеруються джобом).

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