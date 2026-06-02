# MEMORY.md — Біблійна гра: контекст проєкту

> Довгострокова пам'ять OpenClaw-агента про цей застосунок. Оновлювати після значних рішень.

## Що це за застосунок

Telegram Mini App «Біблійна гра» — інтерактивна платформа для вивчення Біблії:
- 15 тем (ВЗ/НЗ, географія, заповіді, притчі…)
- 7 рівнів складності (Немовля → Богослов)
- Режими: Practice (етапи × 10), Review, Millionaire, Survival, Kahoot
- Гейміфікація: монети, streak, achievements, shop (аватари/теми)
- Соціальне: challenges, communities, Kahoot multiplayer (Socket.io)

## Архітектура (2026-05)

```
biblegames_bot/
├── src/           React 19 + TS (pages, components, lib, repos)
├── server/        Express + Socket.io (Kahoot rooms, study API)
├── bot/           Telegram bot (окремий npm package)
├── data/          topics-db + question-db (888 питань)
├── scripts/       AI генерація, аналіз, сортування
└── AGENTS.md…     OpenClaw workspace files
```

## Ключові технічні факти

- **Профіль гравця:** `localStorage` (`src/lib/storage.ts`) — не синхронізується між пристроями
- **Backend:** dual storage json/sql; study answers API є, але frontend частково на localStorage
- **Auth:** `x-user-id` header — placeholder, потрібен Telegram WebApp initData validation
- **Питання:** 888 total; слабкі теми: psalms (27), revelation (22), kings (35)
- **Практика:** `practiceProgression.ts` — етапи, `playerRank`, `practiceTracks`; `recommendationEngine.ts` — рекомендації (continue-practice + mastery)
- **AI-скрипти:** `scripts/lib/practice-config.mjs` — константи етапів для `questions:stats`, `balance-questions --practice-ready`, `generate-ai --stages`

## Відкриті проблеми (пріоритет)

1. localStorage → server sync для profile + study history
2. Telegram initData auth на backend
3. Production deploy pipeline (frontend + server + bot)
4. Баланс питань по темах і рівнях preacher/teacher/theologian (мало контенту)
5. Kahoot — потрібен постійний server (VPS/Railway), не localhost

## Рішення та уроки

- 2026-05-29: OpenClaw workspace прив'язано до `biblegames_bot/` (не порожня папка «Біблійна гра»)
- Cursor workspace name ≠ actual folder name — використовувати `biblegames_bot`
- 2026-05-31: **Конвеєр тем** — нова гілка в завіті (`extensions/{covenant}.json`), review з редагуванням назви, чекбокси L2/L3; merge → stats.
