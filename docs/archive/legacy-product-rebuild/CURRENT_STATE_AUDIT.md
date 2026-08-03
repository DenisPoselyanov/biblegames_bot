# Current State Audit — Phase 0

Дата аудиту: 2026-08-01
Коміт baseline: `d4ad558` (main)

Мета документа: зафіксувати фактичний стан репозиторію перед стартом модернізації, без зміни production behavior.

## 1. Стек (підтверджено)

- React 19 + TypeScript, Vite (rolldown-vite), React Router.
- Zustand (`src/stores/`), React Query використовується частково.
- Express + Socket.IO сервер (`server/`), окремий `package.json`, запускається через `tsx`.
- Окремий Telegram bot (`bot/`, окремий npm workspace, скрипти `bot`, `bot:install`).
- Dual storage: JSON store (`server/db/jsonStore.ts`) і SQL store (`server/db/sqlStore.ts`, `pgPool.ts`) — обидва присутні.
- AI: Ollama, Gemini, OmniRoute провайдери через `scripts/lib/`, Python launcher (`scripts/ai_launcher.py`, `ollama_launcher.py`).

## 2. Route map (`src/App.tsx`)

Основні tabs (через `Layout`): `/` (Home), `/play` (PlayHub), `/play/study` (StudyHub), `/profile`, `/admin`, `/shop`, `/stats`, `/social/challenges(+:id)`, `/social/communities(+:id)`.

Поза Layout (fullscreen): практика/квіз (`/play/study/quiz/:themeId/:difficulty[/stage/:stageIndex][/:nodeId]`), review, millionaire, survival, весь `/play/kahoot/*` кластер (hub/create/join/playlists/room/display).

Legacy redirects присутні: `/themes`, `/themes/:themeId`, `/play/solo`, `/play/solo/themes/:themeId`, `/play/solo/quiz/:themeId/:difficulty`, `/play/solo/millionaire`, `/play/solo/survival`, `/play/study/sprint`, `/play/study/adaptive*`, `/play/study/micro*` — усі ведуть на нові шляхи. Wildcard `*` → `/`.

**Підтверджено:** `/admin` — звичайний route без будь-якого role-guard компонента в React-дереві (лише lazy-load). Захист покладається виключно на те, що посилання не показане в UI — це відповідає ризику з майстер-плану (client route guard ненадійний).

## 3. Screen inventory (`src/pages/`)

`Home`, `Themes`, `ThemeDetail`, `Quiz`, `StudyHub`, `Profile`, `GlobalStats`, `Shop`, `AdminPanel`, `play/PlayHub`, `play/Millionaire`, `play/Survival`, `play/kahoot/*` (Hub, Create, Join, Room, Display, Playlists, PlaylistEditor, PlaylistDetails), `social/Challenges`, `social/ChallengeDetails`, `social/Communities`, `social/CommunityDetails`.

Профіль (`Profile.tsx`) сумісний з описом плану — концентрує ідентичність, косметику, налаштування, соціальні входи в одному екрані.

## 4. Дані / сховище

- `data/question-db/*.json` — 17 тематичних файлів (acts, gospels, kings, judges, pentateuch, prophets, revelation, wisdom-poetry, geography, geography-nt, miracles, parables, patriarchs, paul, new-testament, general-epistles). `mosaic-law.json` видалено в baseline-коміті (замінено іншою структурою тем).
- `data/topics-db/*.json` — паралельна ієрархія тем, включно з `extensions/new-testament.json`.
- Деякі question-db JSON файли по 5–12 МБ у зібраному вигляді (bundle warning нижче) — це вже вплинуло на build.
- `src/data/questionDbLoader.ts`, `questionDbLoader.shared.ts`, `topicDbLoader.shared.ts` — клієнтські loaders; `server/questionDbLoader.ts`, `server/topicHierarchyLoader.ts` — серверні дублікати того ж домену (потенційне дублювання логіки між клієнтом і сервером).
- Профіль гравця — `localStorage` (`src/lib/storage.ts`), без версіонування схеми.
- `server/.data/db.json`, `server/.data/kahoot-sessions.json` — локальний JSON-стор для dev/сервера.

## 5. API / сервер

- `server/index.ts` — основний Express + Socket.IO entrypoint.
- `server/routes/questions.ts`, `server/routes/scripture.ts`, окремий `questionsAdmin.ts` роут для адмін-мутацій питань.
- `server/services/questionService.ts`, `questionRowMapper.ts` — новий шар сервісів (щойно доданий у baseline-коміті).
- `server/roomManager.ts`, `kahootSessions.ts`, `kahootScoring.ts` — Kahoot real-time логіка.

## 6. Auth (підтверджено фактичним кодом, не лише планом)

`server/middleware/telegramAuth.ts`:
- **initData validation вже реалізована** (HMAC-SHA256 за офіційною Telegram-схемою) — це випереджає очікування плану.
- **Але:** якщо `initData` header (`x-telegram-init-data`) відсутній або `TELEGRAM_BOT_TOKEN` не задано, middleware падає назад на довіру до `x-user-id` header без жодної перевірки.
- Є прапор `TELEGRAM_AUTH_STRICT`, але навіть у strict-режимі він блокує лише коли `BOT_TOKEN` заданий — тобто "strict" не гарантує суворості, якщо токен не сконфігуровано на проді.
- **Ризик підтверджено:** `x-user-id` є фактичним fallback source-of-truth в частині шляхів — саме те, що п.16.1 майстер-плану забороняє для production.

## 7. AI command inventory (`scripts/`, package.json)

Активні npm-скрипти: `fix-questions-ai`, `generate-topics`, `generate-topics-ai`, `sort-topics-ai`, `sort-questions`, `questions:stats`, `questions:dedupe-db`, `questions:import-supabase`, `analyze-questions`, `analyze-quality`, `analyze-explanations`, `fix-explanations-ai`, `analyze-topics`, `analyze-pools`, `scripture:audit`, `ai-topic-edit`, `generate-ai`, `topic-conveyor`, `topic-preview-index`, `ai-launcher`, `balance-questions`, `fill-practice`, `fill-practice-nodes`, `assign-practice-stages`, `import-practice-stages-list`, `prune-untagged`.

Це 24+ окремих команд без єдиного CLI/registry — підтверджує проблему фрагментації з розділу 13.5 майстер-плану. Є Python launcher (`ai_launcher.py`, `ollama_launcher.py`, GUI-варіант `launch-ai-gui.py/.vbs`) паралельно з `.mjs`-скриптами.

## 8. Admin / security inventory

- `/admin` route і `AdminPanel.tsx` — у тому ж бандлі, що й user app (окремий чанк при білді, але той самий домен/деплой).
- `questionsAdmin.ts` роут на сервері — без явної перевірки ролі в переглянутому коді (потрібна подальша перевірка в Phase 1/11 перед будь-якими змінами).
- Secrets: `.env.example` перевірено — не містить реальних значень. Реальний `.env` не трекається (є в `.gitignore`).

## 9. Baseline: install / build / lint / tests (2026-08-01, коміт `d4ad558`)

| Перевірка | Результат |
|---|---|
| `npm install` | ✅ успішно (peer-dep warning: `@react-spring/shared` очікує React 16-18, встановлено React 19 — не блокує) |
| `npm run build` | ✅ успішно за 25.85s. **Попередження:** кілька chunks > 500 kB, найбільші — `pentateuch` (12.1 MB / 1.67 MB gzip), `geography` (6.9 MB), `prophets` (5.5 MB), `kings` (5.2 MB). Також `INEFFECTIVE_DYNAMIC_IMPORT` для `topics-db.json` (одночасно статичний і динамічний імпорт). |
| `npm run lint` | ❌ 56 errors, 26 warnings (baseline, не спричинено цим аудитом). Основні категорії: `react-hooks/set-state-in-effect` (KahootRoom.tsx), `react-hooks/rules-of-hooks` (CommunityDetails.tsx — умовний виклик `useMemo`), `react-hooks/exhaustive-deps` (кілька social-сторінок), 1 unused var (`practiceNodeOverridesStore.ts`). |
| `npm run smoke-audit` | ✅ all checks passed |
| `npm run test-classification` | ❌ `Питання не знайдено: geography-child-1` (посилається на ID, якого немає в поточній question-db) |
| `npm run test-social` | ✅ обидва тести (friends + communities) пройдено |
| `tsc --noEmit -p server/tsconfig.json` (ad-hoc, немає окремого npm-скрипта) | ❌ ~25 помилок типів (відсутні `@types/express`, implicit `any`, `import.meta.glob`/`import.meta.env` не типізовані в цьому tsconfig). **Важливо:** сервер запускається через `tsx`, який не типчекає — тобто ці помилки не блокують runtime, але це технічний борг. |

**Висновок:** production build не зламаний. Lint і `test-classification` мають існуючі (pre-existing) провали, задокументовані як baseline, а не регресія. TypeScript-помилки сервера існують, але не впливають на runtime, бо `tsx` не типчекає.

## 10. Demo/experimental features

- `src/pages/social/*` — Challenges/Communities/Leaderboard: `npm run test-social` показує роботу через in-memory/local модель тестового скрипта (не обов'язково production DB) — потребує перевірки в Phase 9, чи це реальний server-backed стан, чи локальний/demo шар.
- `GlobalStats.tsx` (`/stats`) — потребує перевірки в Phase 9 на предмет virtual/seed-даних у leaderboard.

## 11. Рішення щодо обсягу Phase 0 (узгоджено з користувачем)

- Повний перехід на монорепо `apps/` + `packages/` (10 окремих пакетів) визнано невиправданим для соло-розробника на поточному етапі. Див. ADR-001 у [DECISIONS.md](./DECISIONS.md).
- Повний список із 14 документів у `docs/product-rebuild/` скорочено до практичного мінімуму: `MASTER_ROADMAP.md`, `CURRENT_STATE_AUDIT.md` (цей файл), `DECISIONS.md`. Інші документи (`SECURITY_MODEL.md`, `DATA_MODEL.md` тощо) створюються по мірі потреби в конкретних фазах, а не порожніми заздалегідь.
