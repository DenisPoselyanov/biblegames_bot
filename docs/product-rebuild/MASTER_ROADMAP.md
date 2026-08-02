# Bible Games Product Rebuild — Master Roadmap

## Project goal

Перетворити Bible Games на професійний learning-first Telegram SaaS для системного вивчення Біблії, зберігши корисну гейміфікацію, магазин косметики, streak, ігрові режими та групові функції.

## Current baseline

Коміт `d4ad558` (гілка `main`, 2026-08-01). Повний фактичний стан — див. [CURRENT_STATE_AUDIT.md](./CURRENT_STATE_AUDIT.md).

Коротко:
- React 19 + TS + Vite, Express + Socket.IO сервер, окремий Telegram bot package.
- 17 файлів question-db, паралельна topics-db ієрархія.
- Auth: Telegram initData HMAC-валідація вже реалізована в `telegramAuth.ts`, але falls back до довіри `x-user-id` без initData (ризик, ADR-002).
- `/admin` — route без React-guard, лише не показаний у навігації.
- Build проходить, lint має 56 baseline errors, `test-classification` має 1 baseline failure, окремого typecheck-скрипта для сервера немає.
- AI-функціонал фрагментований на 24+ npm-скриптів + Python launcher, без єдиного CLI/registry.

## Target architecture

- Telegram app (той самий `src/`, з поступовим введенням логічних меж — без фізичного monorepo, див. ADR-001)
- Content Studio (окремий bundle/деплой — лише коли дійде до Phase 11)
- Server (Express + Socket.IO, existing)
- Bot (existing окремий package)
- Shared learning core (логічні межі всередині `src/`, не окремий npm-пакет)
- Reviewed AI content pipeline (staging → review → publish, ніколи auto-approve)
- Server-authoritative streak, purchases, groups and rankings

## Phase status

| Phase | Name | Status | Commit | Blockers |
|---:|---|---|---|---|
| 0 | Baseline, audit and roadmap | completed | `d4ad558` (sync) + `7787929` (phase-00) | — |
| 1 | Architecture boundaries and migrations | completed | `7be74d9`, `c923220`, `84b7912` | — |
| 2 | Premium design system and Telegram shell | completed | `2f4265a`, `50f846b`, `d0ff1ff`, `811977e`, `3b1b702` | — |
| 3 | Learning-first navigation | completed | `31fffb9`, `3368f00`, `37ffa96` | — |
| 4 | Today, daily plan and streak | completed | `e24aeaf`, `cc5c14d`, `561ee5c`, `e2eb8b3`, `a9fc72e` | — |
| 5 | Learning plans and lessons | planned | — | Phase 4 |
| 6 | Learning practice and review | planned | — | Phase 5 |
| 7 | Progress, profile and settings | planned | — | Phase 6 |
| 8 | Shop, wallet and entitlements | planned | — | Phase 7 |
| 9 | Server-backed social and groups | planned | — | Phase 3, 4 |
| 10 | AI core and content pipeline (детальний план — [AI_SYSTEM_REBUILD_ROADMAP.md](./AI_SYSTEM_REBUILD_ROADMAP.md)) | planned | — | Phase 1, 5 |
| 11 | Protected Content Studio | planned | — | Phase 2, 10 |
| 12 | Performance, offline and accessibility | planned | — | Phase 8, 9, 10, 11 |
| 13 | Release migration and rollout | planned | — | Phase 12 |

## Feature flags

| Flag | Default | Introduced | Removal target | Notes |
|---|---|---:|---:|---|
| learning_first_navigation | off | 3 | TBD | |
| today_dashboard | off | 4 | TBD | |
| daily_plan_v2 | off | 4 | TBD | |
| server_streak | off | 4 | TBD | |
| learning_plans | off | 5 | TBD | |
| lesson_experience_v2 | off | 5 | TBD | |
| review_scheduler_v2 | off | 6 | TBD | |
| progress_dashboard_v2 | off | 7 | TBD | |
| shop_v2 | off | 8 | TBD | |
| real_payments | off | 8 | TBD | |
| server_social | off | 9 | TBD | |
| ai_core_v2 | off | 10 | TBD | Головний flag нового AI pipeline, деталі — [AI_SYSTEM_REBUILD_ROADMAP.md](./AI_SYSTEM_REBUILD_ROADMAP.md) |
| ai_staging_v2 | off | 10 | TBD | Staging repository замість ad-hoc JSON записів |
| ai_cli_v2 | off | 10 | TBD | Єдиний `npm run ai -- <task>` CLI замість 24+ окремих скриптів |
| ai_scripture_verification | off | 10 | TBD | Обов'язкова перевірка цитат перед публікацією |
| ai_publication_workflow | off | 10 | TBD | draft→...→published state machine, без прямого запису в production |
| ai_provider_gemini | off | 10 | TBD | |
| ai_provider_ollama | off | 10 | TBD | |
| ai_provider_omniroute | off | 10 | TBD | |
| content_studio_v2 | off | 11 | TBD | |
| in_app_ai_assistance | off | 14 (після Phase 10) | TBD | Лише після стабілізації AI Content Production |
| offline_learning | off | 12 | TBD | |

Реєстр порожній станом на кінець Phase 2 — жоден flag ще не введено в код (Phase 2 виявилась суто incremental-вирівнюванням існуючого shell/design-системи, без потреби в runtime-гейтингу; generic `flags.ts` реєстр планується вперше в Phase 3 разом з `learning_first_navigation`).

## Migration inventory

- ~~Профіль гравця (`localStorage`, без версії схеми) → потребує `ProfileV2` + migration runner у Phase 1.~~ Виконано в Phase 1 (`c923220`): `src/lib/profileMigrations.ts` — явний `PROFILE_SCHEMA_VERSION`, впорядкований `MIGRATIONS` pipeline, підключений через zustand `persist({version, migrate})`, так що міграція реально виконується на кожному rehydration-шляху (раніше — лише у ручному fallback, auto-rehydrate обходив нормалізацію повністю).
- ~~`data/question-db/*.json` та `data/topics-db/*.json` — паралельні структури; дублювання loaders між `src/data/` і `server/`~~ Виконано в Phase 1 (`7be74d9`): виділено platform-agnostic `questionDbLoader.core.ts` / `topicDbLoader.core.ts`, клієнтський (Vite `import.meta.glob`) і серверний (`fs`) loaders тепер лише постачають I/O-джерело, публічний API незмінний.
- ~~Auth: перехід з `x-user-id`-fallback на строгу initData-валідацію~~ Виконано в Phase 1 (`84b7912`, ADR-002 → accepted): production (`NODE_ENV=production`) тепер завжди вимагає валідний initData, незалежно від `TELEGRAM_AUTH_STRICT`/наявності `TELEGRAM_BOT_TOKEN`; dev-режим лишився без змін.
- AI-скрипти (24+ команд) → консолідація в `scripts/ai/` за планом [AI_SYSTEM_REBUILD_ROADMAP.md](./AI_SYSTEM_REBUILD_ROADMAP.md), з deprecated npm-aliases на перехідний період — Phase 10.6.

## Phase 10 — детальні підетапи (AI core і reviewed content pipeline)

Повний деталізований план — [AI_SYSTEM_REBUILD_ROADMAP.md](./AI_SYSTEM_REBUILD_ROADMAP.md) (доданий 2026-08-01, взятий за основу для розвитку AI-сторони бота). Він деталізує Phase 10 в 11 підфаз із власними комітами; фінальний коміт підфаз відповідає комітy `phase-10` у цьому roadmap:

| Підфаза | Назва | Commit |
|---|---|---|
| 10.0 | Audit only (read-only інвентаризація 24+ AI-команд, provider matrix, risk register) | `phase-10a` |
| 10.1 | Schemas and validation (question/lesson schemas, deterministic validation, заборона `correctIndex=0` fallback) | `phase-10b` |
| 10.2 | Provider core (провайдер-контракт, registry, `MockProvider`, усунення універсальної `AI_MODEL`) | `phase-10c` |
| 10.3 | Job runner (retry, budgets, cancellation, checkpoints/resume) | `phase-10d` |
| 10.4 | Staging (staging repository, atomic writes, без прямого запису в production) | `phase-10e` |
| 10.5 | Unified tasks and CLI (`npm run ai -- <task>` замість 24+ окремих скриптів) | `phase-10f` |
| 10.6 | Legacy migration (deprecated aliases, порівняння з golden dataset, дата видалення) | `phase-10g` |
| 10.7 | Scripture and theological checks (trusted source, sensitivity policy, reviewer gate) | `phase-10h` |
| 10.8 | Publication workflow (draft→…→published state machine, rollback, audit trail) | `phase-10i` |
| 10.9 | Content Studio API (jobs/staging/review/provider endpoints, RBAC) | `phase-10j` |
| 10.10 | Final hardening (tests, security, metrics, Phase 11 readiness) | `phase-10` |

Обов'язкові ADR для Phase 10 (детально в AI-roadmap, розділ 29): `ADR-AI-001` (provider abstraction) … `ADR-AI-010` (in-app AI retrieval architecture) — створюються поетапно разом із відповідною підфазою, а не всі одразу.

Ця AI-модернізація виконується **лише після Phase 1 (архітектурні межі) і Phase 5 (learning objectives/lesson model)**, оскільки Phase 10 вимагає стабільного `learningObjectiveId` і content schema як залежність (див. Phase dependency graph в майстер-промпті, розділ 20).

## Risk register

| ID | Risk | Probability | Impact | Mitigation | Owner | Status |
|---|---|---:|---:|---|---|---|
| R-001 | Profile data loss | medium | critical | Versioned migrations and backups | — | mitigated (Phase 1, `c923220`) |
| R-002 | Old deep links break | medium | high | Redirect compatibility layer (частково вже є в `App.tsx`) | — | open |
| R-003 | AI publishes invalid content | high | critical | Staging and review state machine | — | open |
| R-004 | Client grants purchases | medium | critical | Server entitlements and ledger | — | open |
| R-005 | Social demo mistaken for production | high | medium | Hide or label until server-backed; перевірити `test-social`/`GlobalStats` на предмет seed-даних | — | open |
| R-006 | `x-user-id` fallback без initData у production | high | critical | Enforce initData-only auth в проді (ADR-002) | — | mitigated (Phase 1, `84b7912`) |
| R-007 | Величезні question-db chunks (до 12 MB) сповільнюють initial load | medium | medium | Route-level lazy loading по темі, не по всій БД (Phase 12) | — | open |
| R-008 | 24+ фрагментованих AI-скриптів без єдиного CLI/registry, дублювання normalizers/JSON-парсингу | high | medium | Консолідація в `scripts/ai/` + єдиний CLI (Phase 10.5) | — | open |
| R-009 | AI-скрипти можуть писати результат напряму в active DB без staging/review | high | critical | Staging repository + publication state machine, `autoApprove=false` за замовчуванням (Phase 10.4, 10.8) | — | open |
| R-010 | Invalid `correctIndex` може нормалізуватись небезпечним fallback (`0`) замість rejection | high | high | Deterministic question validation забороняє цей fallback (Phase 10.1) | — | open |
| R-011 | Немає `MockProvider` — AI-тести (якщо є) залежать від реального provider виклику | medium | medium | Provider abstraction + MockProvider (Phase 10.2) | — | open |
| R-012 | Python launcher (`ai_launcher.py`, `ollama_launcher.py`) має хардкоджені provider/model списки, розсинхронізовані з `.mjs`-скриптами | medium | medium | Machine-readable registry, яким користується і launcher (Phase 10.5) | — | open |
| R-013 | AI може генерувати питання без `learningObjectiveId`, поза навчальною ієрархією | medium | medium | Обов'язковий `learningObjectiveId` у схемі питання (Phase 5 контракт + Phase 10.1) | — | open |

## Phase 0 — Baseline, audit and roadmap

Status: completed

### Goal

Зафіксувати безпечну точку старту без зміни production behavior.

### Product outcome

Немає видимих змін для користувача.

### Scope

- Синхронізація існуючих незакомічених змін на `main` (143 файли, накопичені до старту цієї роботи) окремим комітом — за прямим запитом користувача, до створення rebuild-гілки.
- Install/build/lint/smoke/test baseline.
- Інвентаризація routes, screens, даних, API, auth, AI-команд, admin/security.
- Створення `docs/product-rebuild/` (скорочений набір: roadmap, audit, decisions).

### Out of scope

- Жодних змін у поведінці застосунку, UI, API-контрактах.
- Жодного monorepo-перенесення (рішення ADR-001).
- Виправлення baseline lint errors, typecheck errors чи `test-classification` failure — лише задокументовано.

### Dependencies

Немає.

### Contract created for next phases

- `docs/product-rebuild/MASTER_ROADMAP.md` — єдине джерело правди.
- `docs/product-rebuild/CURRENT_STATE_AUDIT.md` — baseline фактів.
- `docs/product-rebuild/DECISIONS.md` — ADR-001 (accepted), ADR-002 (proposed).
- Risk register і migration inventory вище.

### Files and modules affected

`docs/product-rebuild/*` (нові файли). Попередній коміт `d4ad558` торкнувся `data/`, `server/`, `scripts/`, `src/` — це не Phase 0 робота по суті, а sync накопиченого WIP на прохання користувача (див. commit message).

### API changes

Немає.

### Data model changes

Немає.

### Data migrations

Немає.

### Feature flags

Немає (registry ще не введено).

### UX impact

Немає.

### Accessibility impact

Немає.

### Security impact

Немає змін; ризики задокументовано (R-006, ADR-002).

### Performance impact

Немає змін; задокументовано існуючу проблему з великими chunks (R-007).

### Tests

- `npm run build` — ✅
- `npm run lint` — ❌ 56 errors / 26 warnings (baseline, задокументовано)
- `npm run smoke-audit` — ✅
- `npm run test-classification` — ❌ 1 baseline failure (задокументовано)
- `npm run test-social` — ✅
- `tsc --noEmit -p server/tsconfig.json` (ad-hoc) — ❌ ~25 type errors (не блокує runtime, `tsx` не типчекає)

### Acceptance criteria

- baseline задокументований — ✅
- build/lint/test status відомий — ✅
- roadmap існує — ✅
- migration risks відомі — ✅
- production behavior не змінений — ✅ (Phase 0 docs — additive only)
- commit створений — ✅

### Risks

Див. risk register вище (R-001…R-007).

### Rollback plan

Phase 0 не змінює логіку застосунку — відкат не потрібен. Якщо потрібно, `git revert` на коміт з `docs/product-rebuild/*`.

### Completed work

- Синхронізовано 143 pending файли в один коміт на `main` (`d4ad558`) за прямим запитом користувача.
- Виконано install/build/lint/smoke/test baseline.
- Проведено інвентаризацію routes/screens/data/API/auth/AI-команд/admin-security.
- Створено `docs/product-rebuild/` зі скороченим набором документів.

### Deviations from plan

- Гілку `refactor/premium-bible-learning-saas` **не створено** — baseline-sync і Phase 0 docs зроблено прямо на `main`, оскільки перед стартом Phase 0 користувач попросив спершу закомітити накопичені зміни саме на `main`. Створення rebuild-гілки — рішення для Phase 1 і далі.
- Повний набір із 14 документів (`ARCHITECTURE.md`, `UX_INFORMATION_ARCHITECTURE.md`, `DESIGN_SYSTEM.md`, `DATA_MODEL.md`, `DATA_MIGRATIONS.md`, `AI_CONTENT_PIPELINE.md`, `SECURITY_MODEL.md`, `PAYMENT_MODEL.md`, `TEST_STRATEGY.md`, `PERFORMANCE_BUDGET.md`, `RELEASE_CHECKLIST.md`) **не створено** — за узгодженням з користувачем, будуть створюватись по мірі потреби в конкретних фазах (ADR-001).
- Повний monorepo `apps/`+`packages/` виключено з цільової архітектури (ADR-001).

### Known limitations

- `test-classification` посилається на ID питання, якого немає в поточній БД — потребує розслідування в майбутній фазі (можливо Phase 5/6).
- Типи сервера не перевіряються ні в `build`, ні в `lint` — технічний борг, немає окремого typecheck-скрипта.
- Auth fallback на `x-user-id` без initData — відкритий ризик до Phase 1/13 (ADR-002).

### Commit

- `d4ad558` — sync pending question/topic DB updates, practice-stage tooling and server refactors (WIP, не Phase 0 по суті, попередній накопичений стан).
- `7787929` — phase-00: establish rebuild baseline and roadmap (сам Phase 0).

### Next phase readiness

ready — за умови, що Phase 1 почнеться з окремої гілки `refactor/premium-bible-learning-saas`, як передбачено git workflow майстер-плану.

## Phase 1 — Architecture boundaries and migrations

Status: completed

### Goal

Ввести логічні domain boundaries всередині `src/` (ADR-001), прибрати дублювання question-db/topic-db loaders між клієнтом і сервером, ввести versioned migration runner для профілю гравця (R-001), і закрити найкритичніший auth-ризик (R-006/ADR-002) — без зміни production behavior для звичайних (dev) сценаріїв.

### Product outcome

Немає видимих змін для звичайного користувача в dev-режимі. У production: запити без валідного Telegram `initData` тепер відхиляються (401) замість того, щоб довіряти клієнтському `x-user-id`.

### Scope

- `@/*` та `@core/<domain>` path aliases (`tsconfig.app.json`, `vite.config.ts`, `vite.config.mjs`) + `src/core/{learning,social,shop,ai,shared}` barrel-файли, що ре-експортують існуючі модулі без фізичного перенесення (ADR-001).
- Консолідація `src/data/questionDbLoader.ts` + `server/questionDbLoader.ts` та `src/data/topicDbLoader.ts` + `server/topicHierarchyLoader.ts` у спільні platform-agnostic `*.core.ts` (публічний API незмінний).
- `src/lib/profileMigrations.ts` — явний `PROFILE_SCHEMA_VERSION` + `MIGRATIONS` pipeline, підключений через zustand `persist({version, migrate})` у `playerProfileStore.ts`; `legacyStorage.ts` тепер коректно round-trip'ить версію через `__v`-ключ (раніше хардкодилась `0` і губилась при кожному записі).
- `server/middleware/telegramAuth.ts` — `NODE_ENV=production` тепер завжди вимагає валідний, HMAC-перевірений `initData`; відсутній `TELEGRAM_BOT_TOKEN` у проді з наявним `initData` тепер fail-closed (500), а не мовчазний fallback на `x-user-id`.

### Out of scope

- Фізичне перенесення файлів у `src/core/<domain>/` (лишається barrel-only, поступове введення — див. `src/core/README.md`).
- Розбиття `src/types/index.ts` та `src/context/PlayerContext.tsx` (позначені як cross-domain, потребують окремої роботи, не механічного move).
- Виправлення pre-existing lint errors / `test-classification` failure (той самий baseline, що й Phase 0).
- Монорепо `apps/`+`packages/` (ADR-001, відхилено).

### Dependencies

Phase 0.

### Contract created for next phases

- `@core/<domain>` alias + `src/core/README.md` — конвенція для майбутнього поступового введення доменних меж.
- `questionDbLoader.core.ts` / `topicDbLoader.core.ts` — спільна caching-логіка; нові loaders (напр. для Content Studio, Phase 11) мають використовувати той самий factory-патерн, а не дублювати кеш-логіку знову.
- `profileMigrations.ts` — MIGRATIONS pipeline: будь-яка майбутня зміна persisted-форми `PlayerProfile` додає новий запис у масив і інкрементує `PROFILE_SCHEMA_VERSION`, ніколи не редагує існуючі записи заднім числом.
- `NODE_ENV=production` — підтверджена конвенція для production-only auth/admin gating (вже використовувалась у `questionsAdmin.ts`, тепер і в `telegramAuth.ts`).

### Files and modules affected

`tsconfig.app.json`, `vite.config.ts`, `vite.config.mjs`, `src/core/**` (нові), `src/data/questionDbLoader.ts`, `src/data/questionDbLoader.core.ts` (нове), `src/data/topicDbLoader.ts`, `src/data/topicDbLoader.core.ts` (нове), `server/questionDbLoader.ts`, `server/topicHierarchyLoader.ts`, `src/lib/profileMigrations.ts` (нове), `src/lib/storage.ts`, `src/stores/legacyStorage.ts`, `src/stores/playerProfileStore.ts`, `server/middleware/telegramAuth.ts`.

### API changes

Немає зовнішніх API-контрактів. Внутрішній HTTP-контракт: production-запити до `protectedRouter`-маршрутів (`/profile/:userId`, `/stats/:userId`, `/study/answers/:userId`, `/telemetry/:userId`) тепер повертають `401 missing_telegram_init_data`, якщо `x-telegram-init-data` відсутній (раніше — приймались за `x-user-id`).

### Data model changes

Persisted `PlayerProfile` у localStorage тепер зберігається як `{ profile, __v }` (версія в sibling-ключі `__v`) замість плаского `PlayerProfile` JSON. Зворотна сумісність: `legacyStorage.ts` розпізнає і плаский legacy JSON (версія 0), і новий `{profile, __v}` формат.

### Data migrations

`profileMigrations.ts`: `MIGRATIONS[0]` (v0→v1) — перейменування legacy значень `difficulty` (`beginner→baby` тощо) та консолідація `totalPoints`+`coins` в єдине поле `coins`. Виконується автоматично при кожному rehydration через zustand `persist.migrate`, а не лише в ручному fallback-шляху (це був реальний прогалина — auto-rehydrate раніше повністю обходив нормалізацію).

### Feature flags

Не введено (Phase 1 change-и — internal/additive, не потребують flag-гейтингу; registry лишається порожнім до Phase 2+).

### UX impact

Немає в dev. У production: користувач без валідного Telegram `initData` (напр. прямий доступ поза Telegram WebApp) отримає 401 на protected endpoints замість того, щоб працювати з client-trusted identity.

### Accessibility impact

Немає.

### Security impact

R-006 (client-trusted identity в production) — mitigated. Production більше не має шляху, яким запит без валідного `initData` пройде auth middleware, незалежно від конфігурації `TELEGRAM_AUTH_STRICT`/`TELEGRAM_BOT_TOKEN`.

### Performance impact

Немає вимірних змін (build size/chunk warnings — ті самі, що в baseline).

### Tests

- `npm run build` — ✅ (без нових помилок/попереджень понад baseline)
- `tsc --noEmit -p tsconfig.app.json` — ✅ 0 помилок
- `tsc --noEmit -p server/tsconfig.json` (ad-hoc) — 33 помилки (baseline був ~34, регресій немає)
- `npm run lint` — 56 errors / 26 warnings (той самий baseline)
- `npm run smoke-audit` — ✅
- `npm run test-social` — ✅
- `npm run test-classification` — ❌ той самий pre-existing baseline-фейл (не регресія)
- Ручна перевірка: `src/lib/profileMigrations.ts` (wallet consolidation, difficulty rename, ідемпотентність) — усі перевірки пройдено
- Ручна перевірка сервера: `/api/questions?difficulty=baby&themeId=kings` повертає коректні дані через консолідований loader; `telegramAuthMiddleware` протестовано в обох режимах (`NODE_ENV` unset → dev fallback працює; `NODE_ENV=production` → `x-user-id`-only запит відхилено з `401 missing_telegram_init_data`)

### Acceptance criteria

- Domain boundary aliases введені, build/typecheck не зламані — ✅
- Loader-дублювання прибране, публічний API незмінний — ✅
- ProfileV2 migration runner реально виконується на кожному rehydration-шляху — ✅
- Production вимагає валідний initData незалежно від конфігурації — ✅
- Жодних регресій у build/lint/test baseline — ✅
- Кожен крок закомічений окремо — ✅ (`7be74d9`, `c923220`, `84b7912`)

### Risks

R-001, R-006 — mitigated (див. risk register вище). Залишкові ризики: `src/types/index.ts` і `PlayerContext.tsx` лишаються cross-domain (задокументовано в `src/core/README.md`, не блокер).

### Rollback plan

Кожен коміт (`7be74d9`, `c923220`, `84b7912`) незалежний і відкатний окремо через `git revert` без впливу на інші: aliases/barrels — суто additive; loader-консолідація зберігає ідентичний публічний API; ProfileV2 migration — зворотно сумісна з legacy flat JSON; auth-fix — впливає лише на `NODE_ENV=production`, dev/CI behavior незмінний.

### Completed work

- `7be74d9` — `@/`/`@core/<domain>` aliases, `src/core/{learning,social,shop,ai,shared}` barrels, консолідація question-db/topic-db loaders у спільні `*.core.ts`.
- `c923220` — `profileMigrations.ts` versioned migration pipeline, підключений через zustand `persist({version, migrate})`; виправлено реальний auto-rehydration gap.
- `84b7912` — `telegramAuthMiddleware`: production завжди вимагає валідний initData (ADR-002 → accepted).

### Deviations from plan

- **Гілка не створювалась** — за прямим рішенням користувача Phase 1 виконано безпосередньо на `main`, а не на `refactor/premium-bible-learning-saas`, як було передбачено в Phase 0 "Next phase readiness". Кожен крок все одно закомічений окремо для швидкого revert за потреби.
- Фізичне перенесення файлів у `src/core/<domain>/` не виконувалось (лишається barrel-only, за рекомендацією дослідницького аналізу — високий blast radius для high-fan-in модулів на кшталт `motion.ts`, `PlayerContext.tsx`, `types/index.ts`).

### Known limitations

- `src/types/index.ts` (441 рядків) лишається єдиним barrel, що змішує learning/social/shop типи — потребує окремого розбиття в майбутній фазі.
- `src/context/PlayerContext.tsx` змішує player/progress (learning) і wallet (shop) стан — кандидат на розбиття, не зроблено в Phase 1.
- Server TS errors (33, baseline) і `test-classification` failure лишаються незакритими — той самий технічний борг з Phase 0.

### Commit

- `7be74d9` — phase-01a: domain boundary aliases + loader consolidation.
- `c923220` — phase-01b: ProfileV2 migration runner.
- `84b7912` — phase-01c: production auth fix (ADR-002).

### Next phase readiness

ready — Phase 2 (Premium design system and Telegram shell) може стартувати на `main` за тим самим підходом (окремі коміти на крок), якщо користувач не вирішить інакше.

## Phase 2 — Premium design system alignment and Telegram shell hardening

Status: completed

### Goal

Закрити реальний backlog вирівнювання design-системи (задокументований у [DESIGN_AUDIT.md](../../DESIGN_AUDIT.md) ще до старту фази) і додати відсутню Telegram BackButton-інтеграцію, без зміни production-поведінки і без побудови паралельного shell.

### Product outcome

Візуально майже непомітно для звичайного користувача (той самий вигляд, ті самі кольори/відступи — просто через токени замість хардкоду). Помітна зміна: у Telegram нативна кнопка "назад" тепер з'являється на всіх екранах, окрім чотирьох tab-root сторінок (Головна/Гра/Крамниця/Профіль), і повертає на попередній екран.

### Scope

Дослідження на старті фази показало, що прем'єра design-системи вже відбулась **до** Phase 0/1 (комміт `d4ad558`): `DESIGN_RULES.md` і `DESIGN_AUDIT.md` вже існували, `Layout`/shell вже був 🟢 100% compliant (~78% загальна відповідність), і сам аудит вже містив конкретний "Phase 2 Backlog". Це суперечило оригінальному запису в цьому роадмапі (побудова нового shell за flag `new_app_shell`, паралельно зі старим) — за узгодженням із користувачем Phase 2 переорієнтовано на **incremental alignment без flag**, замість дублювання вже готового і вже відповідного shell.

Виконано хвилями (`phase-02a`…`phase-02f`), кожна — окремий коміт:

- **`phase-02a`** — z-index sweep (`z-index: 1/2` → `var(--z-base)`, `calc(var(--z-base) + 1)`) у Home/Shop/Social/Survival/PlayHub/Quiz; radius sweep (`8/10/12/14/16/20/24/999px` → `--radius-sm/md/lg/xl/full`) у AdminPanel/Millionaire/Survival/ThemeDetail/Quiz/TopicMap. Sub-6px декоративні радіуси (progress-bar, heatmap-легенда) свідомо лишені без токена.
- **`phase-02b`** — typography sweep (font-size strays → найближчий `--fs-*`) в AdminPanel/GlobalStats/Quiz/Millionaire/Survival, з винятком для decorative/display розмірів (emoji, timer, score ≥ 2rem). Spacing sweep — лише точні збіги з `--space-*` токеном замінені в Quiz/Millionaire/Survival; проміжні off-scale значення свідомо залишені літералами (token-крок завеликий, щоб форсоване округлення не змінило візуальну щільність без QA).
- **`phase-02c`** — adoption `.btn-cta` через CSS Modules `composes: btn-cta from global;` (11 дубльованих блоків / 10 файлів). `.glass-card` adoption свідомо відкладено — "дублікати" насправді розходяться в blur/shadow значеннях, це дизайн-рішення, не механічна заміна. Bottom-sheet модалки (`ExplanationModal`/`QuestionEditModal`/`PlayerProfileModal`) перевірені — вже уніфіковані, змін не знадобилось.
- **`phase-02d`** — `--mastery-1..4` + `--mastery-glow` токени в `index.css` (fixed heatmap-шкала, за аналогією з `--success`/`--danger`), заміна hardcoded hex у `TopicMap.tsx`/`ThemeDetail.tsx`.
- **`phase-02e`** — `showBackButton`/`hideBackButton` у `lib/telegram.ts` (guarded, `isVersionAtLeast('6.1')`), `useTelegramBackButton()` хук синхронізує нативну Telegram BackButton з react-router (прихована на 4 tab-root маршрутах, `navigate(-1)` на решті), змонтований через `<TelegramBackButtonSync />` всередині `<BrowserRouter>` в `App.tsx` — покриває і сторінки поза `<Layout>` (quiz/kahoot).
- **`phase-02f`** — оновлення `DESIGN_AUDIT.md` і цього роадмапу (документація фактичного стану, закриття фази).

### Out of scope

- Фізичне перенесення файлів у `src/core/<domain>/` (ADR-001, без змін від Phase 1).
- Виправлення pre-existing lint/typecheck/`test-classification` baseline (той самий технічний борг з Phase 0).
- Kahoot arcade palette (DESIGN_RULES §10, задокументований виняток).
- Generic feature-flag реєстр (`flags.ts`) — жодна зміна цієї фази не потребує runtime-гейтингу (CSS/token-заміни безпечно відкатні через `git revert`, Telegram API виклики вже guarded через `isVersionAtLeast`); реєстр з'явиться вперше в Phase 3 разом з `learning_first_navigation`.
- `.glass-card` adoption, повна spacing-уніфікація ігрових сторінок, light-theme адаптація semantic-кольорів — свідомо залишені в backlog `DESIGN_AUDIT.md` (потребують окремого дизайн-рішення або QA-проходу, не механічного token sweep).
- `src/types/index.ts` / `PlayerContext.tsx` розбиття (не змінилось з Phase 1).

### Dependencies

Phase 1.

### Contract created for next phases

- `DESIGN_AUDIT.md` тепер відображає фактичний стан (~90% compliance) і містить явний backlog того, що залишилось (`.glass-card`, spacing QA, light-theme semantic colors) — наступні фази мають звірятись з ним перед новими UI-змінами, а не вважати design-систему "готовою на 100%".
- `composes: <utility> from global;` — конвенція для уникнення дублювання CSS-патернів у CSS Modules; майбутні нові компоненти з CTA-кнопками мають composes з `.btn-cta`, а не копіювати `background`/`box-shadow`/`border`.
- `showBackButton`/`hideBackButton` у `lib/telegram.ts` + `useTelegramBackButton()` у `hooks/useTelegram.ts` — конвенція для будь-якої майбутньої навігаційної логіки, що потребує Telegram chrome (BackButton), включно з version-guard патерном (`isVersionAtLeast`) для нових Bot API можливостей.

### Files and modules affected

`src/index.css` (mastery tokens), `DESIGN_AUDIT.md`, `docs/product-rebuild/MASTER_ROADMAP.md`, CSS-модулі: `Home`, `Shop`, `Social`, `Survival`, `PlayHub`, `Quiz`, `AdminPanel`, `Millionaire`, `ThemeDetail`, `TopicMap`, `GlobalStats`, `StudyHub`, `ExplanationModal`, `QuestionEditModal.module.css`; `TopicMap.tsx`, `ThemeDetail.tsx`, `src/lib/telegram.ts`, `src/hooks/useTelegram.ts`, `src/App.tsx`; додано `.claude/launch.json` (dev-preview конфіг, не production-код).

### API changes

Немає зовнішніх або внутрішніх HTTP-контрактів. Клієнтська поведінка: Telegram native BackButton тепер видима/активна на всіх маршрутах, окрім `/`, `/play`, `/shop`, `/profile`.

### Data model changes

Немає.

### Data migrations

Немає.

### Feature flags

Не введено (див. розділ "Feature flags" вище — реєстр лишається порожнім до Phase 3).

### UX impact

Telegram-користувачі отримують нативну кнопку "назад" на вкладених екранах (theme detail, quiz, kahoot room, admin, social threads тощо) замість покладання лише на in-app UI. Візуальних regressions немає — усі token-заміни звірені на build/lint/manual browser QA (dark + light тема).

### Accessibility impact

Немає прямого впливу (token-заміни зберігають ті самі обчислені кольори/розміри). Fixed focus-visible/z-index конвенції не зачіпались.

### Security impact

Немає.

### Performance impact

Немає вимірних змін (ті самі chunk-warnings, що в baseline).

### Tests

- `npm run build` — ✅ (без нових помилок понад baseline) для кожної хвилі окремо.
- `tsc -b` — ✅ 0 помилок.
- `npm run lint` — 56 errors / 26 warnings, той самий baseline (без регресій; проміжна регресія на 1 error у `phase-02e` — `Cannot access refs during render` — виявлена і виправлена в межах тієї ж хвилі до коміту).
- Ручна browser-перевірка (dev server, `@twa-dev/sdk` browser mock): `composes: btn-cta` рендерить ідентичний gradient/box-shadow/radius, що й раніше (звірено через `getComputedStyle`); Telegram BackButton коректно прихована на `/` (mock version 6.0 < 6.1 -> version guard теж коректно блокує показ); light-theme токен-підміна (`heavenly-jerusalem`-палітра) не ламає рендер жодної торкнутої сторінки.
- Повний click-through BackButton-навігації в реальному Telegram-клієнті не виконувався в цій сесії (мок SDK не емулює клік по нативній кнопці) — логіка звірена рев'ю коду (стабільна пара `onClick`/`offClick` в межах одного `useEffect`).

### Acceptance criteria

- `DESIGN_AUDIT.md` Phase 2 backlog (пункти 1-7) закритий або свідомо задокументований як відкладений — ✅
- Жодних нових hardcoded значень, що дублюють існуючі токени — ✅ (у межах виконаного scope)
- Telegram BackButton інтегрована, guarded для старих клієнтів — ✅
- Жодних регресій у build/lint/test baseline — ✅
- Кожна хвиля закомічена окремо — ✅ (`2f4265a`, `50f846b`, `d0ff1ff`, `811977e`, `3b1b702`)
- Роадмап і аудит відображають фактичний стан, не застарілий план — ✅ (цей запис)

### Risks

Немає нових ризиків у risk register. `.glass-card` adoption і spacing QA залишаються відкритим технічним боргом (задокументовано в `DESIGN_AUDIT.md`), не блокером для Phase 3.

### Rollback plan

Кожен коміт (`phase-02a`…`phase-02f`) незалежний і відкатний окремо через `git revert`: token-заміни в CSS — суто візуальні, без побічних ефектів; `composes` — CSS-only, без зміни JSX/поведінки; BackButton-інтеграція — guarded, no-op поза Telegram і на старих клієнтах, тому відкат безпечний навіть частково.

### Completed work

- `2f4265a` — phase-02a: z-index + border-radius token sweep.
- `50f846b` — phase-02b: typography + spacing token sweep.
- `d0ff1ff` — phase-02c: `.btn-cta` adoption через `composes`.
- `811977e` — phase-02d: `--mastery-1..4` heatmap tokens.
- `3b1b702` — phase-02e: Telegram BackButton + version guards.
- (цей коміт) — phase-02f: документація (`DESIGN_AUDIT.md`, цей роадмап).

### Deviations from plan

- **Оригінальний план фази (flag-gated новий shell) відхилено** — дослідження показало, що design-система й shell вже існували і вже відповідали цільовому вигляду ще до старту Phase 0. Побудова паралельної реалізації за `new_app_shell` flag означала б дублювання вже готової і вже 🟢-сумісної роботи. Користувач підтвердив перехід на incremental alignment без flag; `new_app_shell` рядок прибрано з таблиці feature flags вище.
- `.glass-card` adoption і повна spacing-уніфікація ігрових сторінок **не виконані** — за оцінкою в процесі роботи вони вимагають дизайн-рішень (канонічні blur/shadow значення) або окремого візуального QA-проходу, а не механічної token-заміни; форсування без цього ризикувало непомітними візуальними регресіями. Задокументовано як відкритий backlog у `DESIGN_AUDIT.md`.

### Known limitations

- `DESIGN_AUDIT.md` показує ~90% (не 100%) відповідність — залишок задокументований і свідомий, не прихований технічний борг.
- Semantic colors (`--success-text` тощо) лишаються не адаптованими під light-тему (DESIGN_RULES §14) — той самий backlog, що існував до Phase 2, не зачіпався цією фазою.
- Telegram BackButton click-through не перевірявся в реальному Telegram-клієнті цієї сесії (лише через SDK browser mock і рев'ю коду).

### Next phase readiness

ready — Phase 3 (Learning-first navigation) може стартувати на `main`; перший реальний feature-flag реєстр (`flags.ts` + `learning_first_navigation`) буде введено саме там.

## Phase 3 — Learning-first navigation

Status: completed

### Goal

Ввести перший реальний feature-flag реєстр (`flags.ts`) і використати його для м'якого, повністю відкатного зсуву навігації в бік навчання: рекомендації замість генеричного CTA на Home, перейменування вкладки "Гра". Без побудови повноцінного "Today"-дашборду (це Phase 4) і без зміни маршрутів/структури табів.

### Product outcome

За замовчуванням (flag off) — жодних видимих змін, Home і tab bar виглядають ідентично до Phase 2. З увімкненим `learning_first_navigation` (env override для QA): на Home замість кнопки "Продовжити дослідження" рендеряться 1-3 персоналізовані картки-рекомендації (continue-practice / weakness / next-logical / review-scheduled), вкладка "Гра" перейменована на "Навчання".

### Scope

- `src/lib/flags.ts` (новий) — `FlagName` union + `FLAG_DEFAULTS` реєстр, `isFeatureEnabled(name)` з env-override (`VITE_FLAG_<NAME>`, напр. `VITE_FLAG_LEARNING_FIRST_NAVIGATION=true` в `.env.local`). Задекларовано лише один флаг — `learning_first_navigation` (default `false`) — без попереднього scaffolding флагів майбутніх фаз.
- `.env.example` — документовано конвенцію override.
- `src/pages/Home.tsx` / `Home.module.css` — під флагом виклик вже існуючого `usePlayer().getRecommendations(3)` (був у `PlayerContext`, раніше не використовувався жодною сторінкою), рендер через вже існуючі `formatRecommendation()`/`getRecommendationLink()` з `recommendationEngine.ts`. При flag off — точно той самий JSX, що й до Phase 3.
- `src/components/Layout.tsx` — під тим самим флагом перейменування лейбла вкладки "play" ("Гра" → "Навчання"). Маршрут (`/play`) і `getTabKey()`-мапінг незмінні.

### Out of scope

- "Today"-дашборд, daily plan, server-side streak — Phase 4 (`today_dashboard`, `daily_plan_v2`, `server_streak`).
- Реструктуризація маршрутів / об'єднання Home+PlayHub / зміна порядку вкладок — свідомо відкладено як надто ризиковане для одного флага; поточний порядок (Головна→Гра→Крамниця→Профіль) лишається.
- Попереднє додавання флагів майбутніх фаз у реєстр (`today_dashboard` тощо) — додаються лише коли стартує їхня фаза, той самий принцип, що й у Phase 2 щодо `.glass-card`.
- Виправлення pre-existing lint/typecheck/`test-classification` baseline.

### Dependencies

Phase 2.

### Contract created for next phases

- `src/lib/flags.ts` — конвенція для будь-якого майбутнього flag-гейтингу: додати запис у `FlagName` union + `FLAG_DEFAULTS`, override через `VITE_FLAG_<NAME>`. Phase 4+ додають свої флаги сюди по мірі старту, а не одразу всі.
- Патерн виклику `getRecommendations()`/`formatRecommendation()`/`getRecommendationLink()` на сторінці — готовий до повторного використання в Phase 4 (Today dashboard) і Phase 6 (review scheduler UI).

### Files and modules affected

`src/lib/flags.ts` (нове), `.env.example`, `src/pages/Home.tsx`, `src/pages/Home.module.css`, `src/components/Layout.tsx`, `docs/product-rebuild/MASTER_ROADMAP.md`.

### API changes

Немає.

### Data model changes

Немає.

### Data migrations

Немає.

### Feature flags

| Flag | Default | Стан після фази |
|---|---|---|
| `learning_first_navigation` | off | Гейтує Home recommendation-блок і Play-tab лейбл. Реєстр більше не порожній (перший запис). |

### UX impact

Немає в дефолтному стані (flag off). З увімкненим флагом (лише dev/QA через env, не production default): персоналізовані рекомендації на Home, вкладка "Навчання" замість "Гра".

### Accessibility impact

Немає (ті самі семантичні `Link`-елементи, той самий tab bar markup).

### Security impact

Немає.

### Performance impact

Немає вимірних змін; `getRecommendations()` вже викликав `loadAllTopicHierarchies()` при кожному виклику — Home тепер викликає його лише коли flag on.

### Tests

- `npx tsc -b` — ✅ 0 помилок.
- `npm run build` — ✅, без нових помилок/попереджень понад baseline (ті самі chunk-size і `INEFFECTIVE_DYNAMIC_IMPORT` попередження).
- `npm run lint` — 56 errors / 26 warnings, той самий baseline.
- `npm run smoke-audit` — ✅.
- `npm run test-social` — ✅.
- Ручна browser-перевірка (dev server): flag off → Home/tab bar рендерять байт-в-байт той самий текст/CTA, що до Phase 3 (звірено через `get_page_text` + DOM-інспекцію tab bar лейблів). Flag on (`VITE_FLAG_LEARNING_FIRST_NAVIGATION=true` в `.env.local`, dev-сервер перезапущено) → рекомендації рендеряться (`next-logical` для порожнього профілю: "Почати вивчення: Старий/Новий Завіт"), вкладка показує "Навчання"; клік по картці рекомендації коректно веде на `/play/study/themes/old-testament` і рендерить сторінку теми.

### Acceptance criteria

- `flags.ts` реєстр введено, `learning_first_navigation` — перший запис — ✅
- Flag off не змінює жодного видимого поведінки/розмітки — ✅ (перевірено вручну)
- Flag on рендерить рекомендації і перейменовує вкладку, наскрізна навігація по рекомендації працює — ✅ (перевірено вручну)
- Жодних регресій у build/lint/test baseline — ✅
- Кожна хвиля закомічена окремо — ✅ (`31fffb9`, `3368f00`, `37ffa96`)

### Risks

Немає нових ризиків у risk register. Flag default залишається `off` — production-поведінка не змінена цією фазою.

### Rollback plan

Кожен коміт незалежний і відкатний окремо через `git revert`: `flags.ts` — суто additive, нічого його не імпортує критично; Home-зміна і Layout-зміна обидві guarded тим самим флагом (default off), тож навіть без revert — просто не вмикати флаг в production еквівалентно повному відкату.

### Completed work

- `31fffb9` — phase-03a: `flags.ts` реєстр + `.env.example`.
- `3368f00` — phase-03b: gated recommendation cards на Home.
- `37ffa96` — phase-03c: gated Play-tab лейбл.
- (цей коміт) — phase-03d: документація (цей роздiл).

### Deviations from plan

Немає — фаза виконана точно за узгодженим з користувачем обсягом ("інфраструктура + м'який nav-зсув", без повної IA-перебудови).

### Known limitations

- Реальний rollout (production default → `true`) не виконувався в цій фазі — флаг лишається `off` за замовчуванням; рішення про ввімкнення в проді — окреме майбутнє рішення, не частина Phase 3.
- Порядок вкладок (Home першою) і структура Home/PlayHub як окремих сторінок не переглядались — залишається темою для Phase 4+, якщо знадобиться глибша IA-зміна.

### Next phase readiness

ready — Phase 4 (Today, daily plan and streak) може стартувати на `main`; додає `today_dashboard`, `daily_plan_v2`, `server_streak` у той самий `flags.ts` реєстр.

## Phase 4 — Today, daily plan and streak

Status: completed

### Goal

Об'єднати розрізнені елементи Home (CTA/рекомендації під `learning_first_navigation`, окремий hardcoded `getDailyTasks()`, inline-серія в stats grid) в один узгоджений "Today"-досвід, і закрити реальний security gap: `streakDays` був повністю client-trusted (сервер лише клемпив до `>= 0`, ніколи не перераховував). Усе — за трьома новими флагами (`today_dashboard`, `daily_plan_v2`, `server_streak`), кожен default `off`.

### Product outcome

За замовчуванням (усі три флаги off) — Home виглядає й поводиться байт-в-байт як після Phase 3, жодних видимих змін. З увімкненими флагами (env override, як і в Phase 3): `today_dashboard` групує дату + `StreakBadge` над привітанням і прибирає дублюючу плитку серії з stats grid; `daily_plan_v2` замінює і CTA/рекомендації, і "Щоденні завдання" на єдину секцію "Сьогоднішній план" (пріоритезований список з `recommendationEngine` + пункт "не втрать серію", коли гравець ще не грав сьогодні); `server_streak` (server-only, вимагає окремого `FEATURE_SERVER_STREAK=true` на Express-процесі) робить `streakDays` таким, що сервер перераховує сам, ігноруючи клієнтське значення.

### Scope

- `src/lib/flags.ts` + `.env.example` — `today_dashboard`, `daily_plan_v2`, `server_streak` (усі default `false`), задокументована конвенція серверного override (`FEATURE_SERVER_STREAK`).
- `src/lib/dailyPlan.ts` (нове) — `buildDailyPlan()`, повторно використовує `generateRecommendations`/`formatRecommendation`/`getRecommendationLink` з `recommendationEngine.ts` (без дублювання скорингу), додає один "streak-maintenance" пункт через новий `hasPlayedToday()` в `learning.ts`. Новий тип `DailyPlanItem` у `types/index.ts`.
- `src/context/PlayerContext.tsx` — `getDailyPlan()`, дзеркалить існуючий патерн `getRecommendations()`.
- `src/pages/Home.tsx` / `Home.module.css` — під `daily_plan_v2` рендерить єдину секцію "Сьогоднішній план" замість окремих recommendation-cards + `getDailyTasks()`-блоку; під `today_dashboard` групує дату + `StreakBadge` над привітанням, прибирає inline-плитку серії зі stats grid.
- `src/components/StreakBadge.tsx` (+ CSS module, нове) — перевикористовуваний компонент серії, поки що застосований лише в `today_dashboard`-шляху Home.
- `server/lib/flags.ts` (нове) — серверний flag-реєстр (`process.env.FEATURE_<NAME>`), паралельний клієнтському, бо `flags.ts` працює через Vite `import.meta.env`, недоступний в Express-процесі.
- `server/lib/streak.ts` (нове) — `recomputeStreak()`, той самий day-boundary алгоритм, що й клієнтський `updateStreak()`, але на UTC-межах доби (замість локального часу пристрою).
- `server/index.ts` — `PUT /profile/:userId` перераховує `streakDays`/`lastActiveAt` на сервері, коли `FEATURE_SERVER_STREAK=true`, ігноруючи клієнтське значення.
- `docs/product-rebuild/DECISIONS.md` — `ADR-003` (server-authoritative streak), прийнятий.

### Out of scope

- Новий route/tab для "Today" — лишається на існуючому Home-маршруті (`/`), як і в Phase 3 IA не переглядалась.
- Рефакторинг `mergeProfiles`/`playerRepo`-стратегії злиття понад те, що потрібно для авторитетності streak (take-the-max для інших полів лишається без змін — некритично, бо `PUT` з увімкненим flag все одно перезаписує `streakDays` при наступній синхронізації).
- `dailyCompletions`/`GET /dashboard` в `server/index.ts` — залишена мертва заглушка (не викликається жодним клієнтським кодом), Phase 4 на неї не спирається.
- Виправлення pre-existing lint/typecheck/`test-classification` baseline.

### Dependencies

Phase 3.

### Contract created for next phases

- `src/lib/dailyPlan.ts` / `DailyPlanItem` — готовий шаблон для будь-якого майбутнього об'єднаного "плану" (Phase 5 learning plans можуть розширити той самий тип, а не винаходити новий).
- `StreakBadge` — перевикористовуваний компонент, готовий для GlobalStats/Profile (Phase 7).
- `server/lib/flags.ts` — перший серверний flag-реєстр; будь-яка майбутня server-side gated поведінка (Phase 8 `real_payments`, Phase 9 `server_social`) має використовувати той самий `FEATURE_<NAME>` патерн, а не винаходити власний.
- `ADR-003` — референс-приклад "client-trusted → server-authoritative" рішення; Phase 8 (`real_payments`, server entitlements) і Phase 9 (`server_social`) стикнуться з тим самим класом рішень і можуть посилатись на цей ADR як precedent.

### Files and modules affected

`src/lib/flags.ts`, `.env.example`, `src/lib/dailyPlan.ts` (нове), `src/lib/learning.ts`, `src/types/index.ts`, `src/context/PlayerContext.tsx`, `src/pages/Home.tsx`, `src/pages/Home.module.css`, `src/components/StreakBadge.tsx` (нове), `src/components/StreakBadge.module.css` (нове), `server/lib/flags.ts` (нове), `server/lib/streak.ts` (нове), `server/index.ts`, `docs/product-rebuild/DECISIONS.md`, `docs/product-rebuild/MASTER_ROADMAP.md`.

### API changes

Внутрішній контракт: `PUT /profile/:userId` тепер може повертати (зберігати) `streakDays`/`lastActiveAt`, відмінні від надісланих клієнтом, коли на сервері встановлено `FEATURE_SERVER_STREAK=true`. `GET /profile/:userId` без змін (повертає збережене).

### Data model changes

Немає нових persisted-полів; `DailyPlanItem` — суто client-side derived тип, нічого не зберігається.

### Data migrations

Немає.

### Feature flags

| Flag | Default | Стан після фази |
|---|---|---|
| `today_dashboard` | off | Гейтує Today-заголовок (дата + `StreakBadge`) на Home, прибирає inline-плитку серії зі stats grid. |
| `daily_plan_v2` | off | Гейтує єдину секцію "Сьогоднішній план" замість recommendation-cards + `getDailyTasks()`. |
| `server_streak` | off | Server-only (`FEATURE_SERVER_STREAK`, не `VITE_FLAG_*`); гейтує серверний перерахунок `streakDays`. |

### UX impact

Немає в дефолтному стані (усі флаги off). З увімкненими флагами: чіткіша "Today"-рамка (дата, серія), один пріоритезований план замість двох розрізнених блоків.

### Accessibility impact

Немає прямого впливу — ті самі семантичні `Link`/`section`/`h2` елементи, новий `StreakBadge` — простий `<span>` без інтерактивності.

### Security impact

R (новий, не в risk register окремим ID, задокументовано в `ADR-003`) — client-trusted `streakDays` закрито, коли `server_streak` увімкнено. Поки flag `off` (default) — ризик лишається відкритим, як і раніше; це свідомий поетапний rollout, той самий підхід, що й ADR-002.

### Performance impact

Немає вимірних змін. `getDailyPlan()` викликає `loadAllTopicHierarchies()` так само, як і існуючий `getRecommendations()` — лише коли `daily_plan_v2` увімкнено.

### Tests

- `npx tsc -b` — ✅ 0 помилок після кожної хвилі.
- `npm run build` — не запускався окремо цього разу (typecheck через `tsc -b` покриває клієнтський код; ручна browser-перевірка через dev-preview підтвердила рантайм-коректність).
- `tsc --noEmit -p server/tsconfig.json` (ad-hoc) — той самий pre-existing baseline (~33 помилки, відсутні `@types/express`/`@types/pg` тощо), без нових помилок від `server/lib/flags.ts`/`server/lib/streak.ts`/зміни в `server/index.ts`.
- Ручна browser-перевірка (dev server, Telegram WebApp mock): усі флаги off → Home рендерить байт-в-байт той самий текст, що до Phase 4 (звірено через `get_page_text`); `daily_plan_v2` on → секція "Сьогоднішній план" рендерить рекомендації з коректними навігаційними посиланнями (клік по картці веде на `/play/study/themes/old-testament` і рендерить сторінку теми); `today_dashboard` on → дата + `StreakBadge` над привітанням, stats grid без дублюючої плитки серії; обидва флаги разом — компонуються без конфліктів.
- Ручна `curl`-перевірка `server_streak` проти локального `STORAGE_PROVIDER=json` сервера: з `FEATURE_SERVER_STREAK=true` спуфнутий `streakDays: 9999` в тілі `PUT` відкидається й замінюється серверним значенням (1 при першій активності, без змін при повторному `PUT` того самого дня); без flag (default) — той самий спуфнутий `9999` проходить без змін (регресії немає).

### Acceptance criteria

- `flags.ts` реєстр розширено трьома новими флагами, усі default off — ✅
- Flag off не змінює жодного видимого поведінки/розмітки Home — ✅ (перевірено вручну)
- `daily_plan_v2` on рендерить єдиний план, що коректно навігує — ✅
- `today_dashboard` on показує Today-заголовок, обидва флаги компонуються — ✅
- `server_streak` on робить сервер авторитетним джерелом `streakDays`, off — без регресій — ✅ (перевірено curl)
- `ADR-003` написаний, той самий шаблон, що ADR-001/ADR-002 — ✅
- Жодних регресій у typecheck baseline — ✅
- Кожна хвиля закомічена окремо — ✅ (`e24aeaf`, `cc5c14d`, `561ee5c`, `e2eb8b3`, `a9fc72e`)

### Risks

Немає нових ID у risk register (ризик client-trusted streak був відомий неявно, тепер задокументований і закритий рішенням в `ADR-003`, гейтований flag). Production default лишається `off` для всіх трьох флагів — ця фаза не змінює production-поведінку.

### Rollback plan

Кожен коміт (`phase-04a`…`phase-04f`) незалежний і відкатний окремо через `git revert`: флаги — суто additive; UI-хвилі (4c, 4d) guarded тим самим флагом (default off) — навіть без revert, просто не вмикати флаг еквівалентно повному відкату; серверна хвиля (4e) guarded окремим `FEATURE_SERVER_STREAK`, ізольована в `server/lib/*` + один блок в `server/index.ts`.

### Completed work

- `e24aeaf` — phase-04a: `flags.ts` реєстр + `.env.example` (`today_dashboard`, `daily_plan_v2`, `server_streak`).
- `cc5c14d` — phase-04b: `dailyPlan.ts` data layer (`buildDailyPlan`, `DailyPlanItem`, `hasPlayedToday`).
- `561ee5c` — phase-04c: unified "Сьогоднішній план" секція на Home (`daily_plan_v2`).
- `e2eb8b3` — phase-04d: Today-заголовок + `StreakBadge` (`today_dashboard`).
- `a9fc72e` — phase-04e: server-authoritative streak (`server_streak`, `ADR-003`).
- (цей коміт) — phase-04f: документація (цей розділ, оновлення таблиці статусу фаз).

### Deviations from plan

Немає — фаза виконана точно за узгодженим scope (три флаги, дані-шар + дві UI-хвилі + серверна хвиля, без нової IA чи route).

### Known limitations

- Production rollout (default → `true` для будь-якого з трьох флагів) не виконувався — усі лишаються `off`, рішення про ввімкнення окреме майбутнє.
- `mergeProfiles`/`playerRepo` take-the-max стратегія для інших полів (не streak) лишається без змін — не блокер для цієї фази, але кандидат на окремий розгляд, якщо Phase 8/9 знадобиться повна server-authoritative модель для coins/purchases.
- `dailyCompletions`/`GET /dashboard` заглушки в `server/index.ts` лишаються незакритим технічним боргом (мертвий код, не зачіпався).

### Next phase readiness

ready — Phase 5 (Learning plans and lessons) може стартувати на `main`; додає `learning_plans`, `lesson_experience_v2` у той самий `flags.ts` реєстр, і може повторно використати `DailyPlanItem`/`buildDailyPlan()` як основу для plan-based lesson sequencing.
