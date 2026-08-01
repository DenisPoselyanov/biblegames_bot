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
| 1 | Architecture boundaries and migrations | planned | — | Phase 0 |
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

- Профіль гравця (`localStorage`, без версії схеми) → потребує `ProfileV2` + migration runner у Phase 1.
- `data/question-db/*.json` та `data/topics-db/*.json` — паралельні структури; дублювання loaders між `src/data/` і `server/` (`questionDbLoader.ts`, `topicHierarchyLoader.ts`) — консолідувати в Phase 1/5.
- Auth: перехід з `x-user-id`-fallback на строгу initData-валідацію — Phase 1/13 (ADR-002).
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
| R-001 | Profile data loss | medium | critical | Versioned migrations and backups | — | open |
| R-002 | Old deep links break | medium | high | Redirect compatibility layer (частково вже є в `App.tsx`) | — | open |
| R-003 | AI publishes invalid content | high | critical | Staging and review state machine | — | open |
| R-004 | Client grants purchases | medium | critical | Server entitlements and ledger | — | open |
| R-005 | Social demo mistaken for production | high | medium | Hide or label until server-backed; перевірити `test-social`/`GlobalStats` на предмет seed-даних | — | open |
| R-006 | `x-user-id` fallback без initData у production | high | critical | Enforce initData-only auth в проді (ADR-002) | — | open |
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
