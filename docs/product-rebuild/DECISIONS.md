# Decisions — Bible Games SaaS rebuild

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

Date: 2026-08-01
Status: proposed

### Context

Аудит (`CURRENT_STATE_AUDIT.md`, розділ 6) показав, що `server/middleware/telegramAuth.ts` вже має коректну HMAC-валідацію Telegram `initData`, але коли `initData` header відсутній (або `TELEGRAM_BOT_TOKEN` не заданий), middleware приймає запит на основі одного лише `x-user-id`, довіряючи клієнту.

### Decision (proposed, не виконано в Phase 0)

У Phase 1/13 потрібно явно розділити dev-fallback і production-режим: production не повинен приймати запити без валідного `initData`, незалежно від того, чи заданий `TELEGRAM_AUTH_STRICT`. Конкретний план виправлення — предмет окремої фази (не Phase 0), щоб не змінювати production behavior зараз.

### Alternatives considered

Не розглядались детально — зафіксовано як known risk, а не вирішено в межах Phase 0 (Phase 0 не повинен змінювати production behavior).

### Consequences

Поки не виправлено — залишається ризик R-004-подібного типу (client-trusted identity) для будь-яких шляхів без `initData`.

### Migration impact

TBD — залежить від того, наскільки клієнт (bot/telegram-app) фактично надсилає `x-telegram-init-data` вже зараз.

### Security impact

Високий — це основний auth-ризик, задокументований у майстер-плані (розділ 16.1).

### Rollback

Не застосовується (рішення ще не реалізоване, лише запропоноване).
