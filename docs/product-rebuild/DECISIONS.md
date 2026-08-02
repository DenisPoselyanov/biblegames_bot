# Decisions — Bible Games SaaS rebuild

## Note — AI System Rebuild Roadmap incorporated (2026-08-01)

`docs/product-rebuild/AI_SYSTEM_REBUILD_ROADMAP.md` was added as the detailed reference plan for Phase 10 (AI core and reviewed content pipeline), at the user's request. It defines 11 sub-phases (10.0–10.10) and ten AI-specific ADRs (`ADR-AI-001`…`ADR-AI-010`, listed in that document's section 29). Those ADRs are **not** created here yet — they get written one at a time, each alongside the sub-phase that needs it, starting with `ADR-AI-001` in Phase 10.2 (provider core). Creating all ten now, before Phase 10 even starts, would violate the same "don't scaffold empty docs ahead of need" principle as ADR-001.

## ADR-001 — Скорочення цільової архітектури: без повного monorepo (apps/ + packages/)

Date: 2026-08-01
Status: accepted

### Context

Оригінальний master prompt (`MASTER_PROMPT_BIBLE_SAAS_REBUILD.md`) пропонує цільову структуру `apps/{telegram-app,content-studio,server,bot}` + `packages/{ui,design-tokens,learning-core,content-schema,ai-core,telegram-sdk,data-access,analytics,security,shared}` — 10 окремих пакетів з власним версіонуванням.

### Decision

Не переходити на повний workspace-monorepo з 10 пакетами. Замість цього:
- Логічні межі (domain boundaries) вводяться через структуру директорій і TS path aliases всередині поточного `src/` (наприклад, майбутні `src/core/learning/`, `src/core/ai/`).
- Фізичне виділення в окремий деплоюваний `app` залишається виправданим лише там, де є конкретний security/деплой-мотив — а саме Content Studio (Phase 11), бо адмін-функціонал не повинен потрапляти в user-facing bundle.
- Документація в `docs/product-rebuild/` скорочена з 14 файлів до практичного мінімуму (`MASTER_ROADMAP.md`, `CURRENT_STATE_AUDIT.md`, `DECISIONS.md`); решта створюється за потреби конкретної фази.

### Alternatives considered

1. Повний monorepo одразу (як в оригінальному промпті) — відхилено.
2. Взагалі без логічних меж, залишити плоский `src/` — відхилено, бо ускладнить Phase 10/11 (AI core, Content Studio).

### Consequences

- Менше tooling-overhead (немає окремих package.json/tsconfig/build-степів на кожен пакет, немає ризику circular deps між пакетами).
- Швидша ітерація для соло-розробника.
- Якщо в майбутньому з'явиться друга команда або потреба незалежного версіонування (наприклад, `learning-core` як публічний пакет), рішення можна переглянути новим ADR.

### Migration impact

Немає — це рішення *не* переносить існуючі файли фізично. Change-only-additive: нові логічні межі вводяться поступово в межах `src/`.

### Security impact

Нейтрально для цього рішення; Content Studio (Phase 11) все одно отримає фізичну ізоляцію окремим bundle/деплоєм, коли до неї дійде черга.

### Rollback

Якщо рішення виявиться недостатнім (наприклад, aliases стають заплутаними при рості кодової бази) — можна почати фізичний перенос в `packages/` для конкретного домену окремим ADR, без відкату всього рішення одразу.

---

## ADR-002 — Auth: existing Telegram initData validation frontfall to x-user-id

Date: 2026-08-01 (proposed) / 2026-08-02 (accepted, implemented in Phase 1)
Status: accepted

### Context

Аудит (`CURRENT_STATE_AUDIT.md`, розділ 6) показав, що `server/middleware/telegramAuth.ts` вже має коректну HMAC-валідацію Telegram `initData`, але коли `initData` header відсутній (або `TELEGRAM_BOT_TOKEN` не заданий), middleware приймає запит на основі одного лише `x-user-id`, довіряючи клієнту.

### Decision

Реалізовано в Phase 1 (`84b7912`): `telegramAuthMiddleware` тепер гейтиться на `NODE_ENV === 'production'` (та сама конвенція, що вже використовувалась у `questionsAdmin.ts`). У production:
- відсутній `x-telegram-init-data` → `401 missing_telegram_init_data`, незалежно від `TELEGRAM_AUTH_STRICT`;
- `initData` присутній, але `TELEGRAM_BOT_TOKEN` не заданий (неможливо валідувати) → `500 telegram_auth_not_configured` (fail-closed, а не мовчазний fallback на `x-user-id`);
- невалідний `initData` → `401 invalid_telegram_init_data` (без змін).

Non-production (dev/CI) behavior лишився без змін — permissive fallback на `x-user-id`, щоб не зламати локальні/CI сценарії, які не надсилають реальний Telegram `initData`.

### Alternatives considered

1. Вимагати `initData` завжди (і в dev) — відхилено, зламало б локальну розробку/CI без додаткової tooling-роботи для мокання Telegram WebApp.
2. Окремий env-прапор замість `NODE_ENV` — відхилено, `NODE_ENV=production` вже є усталеною конвенцією в цьому репо (`questionsAdmin.ts`), додатковий прапор — зайва складність.

### Consequences

- R-006 mitigated: production більше не має шляху client-trusted identity.
- Незадеплоєний/неправильно сконфігурований `TELEGRAM_BOT_TOKEN` у production тепер явно провалює запити (500) замість тихого even-more-небезпечного fallback — це навмисний trade-off (fail loud > fail open).

### Migration impact

Немає — клієнт (bot/telegram-app) вже надсилає `x-telegram-init-data` в реальних Telegram WebApp-сесіях; зміна впливає лише на запити, які раніше покладались на самий лише `x-user-id` у production (за визначенням — небажаний шлях).

### Security impact

R-006 закрито для production. Ризик залишається відкритим лише для dev/CI (навмисно, для DX).

### Rollback

`git revert 84b7912` — зміна ізольована в одному файлі (`server/middleware/telegramAuth.ts`), не має залежних змін в інших комітах Phase 1.
