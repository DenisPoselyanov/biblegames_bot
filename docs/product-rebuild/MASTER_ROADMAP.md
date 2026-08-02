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
| 2 | Premium design system and Telegram shell | planned | — | Phase 1 |
| 3 | Learning-first navigation | planned | — | Phase 2 |
| 4 | Today, daily plan and streak | planned | — | Phase 3 |
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
| new_app_shell | off | 2 | TBD | |
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

Реєстр порожній до Phase 1 — жоден flag ще не введено в код.

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
