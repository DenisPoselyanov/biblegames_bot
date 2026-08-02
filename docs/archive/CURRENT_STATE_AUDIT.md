# Bible Games — перевірений baseline поточної версії

> **Тип документа:** історичний технічний знімок, не roadmap.  
> **Дата первинної перевірки:** 2026-08-01.  
> **Baseline:** `d4ad558`, додатково перевірено документаційні коміти до `7d074d5`.  
> **Актуальний план:** [BIBLE_GAMES_MASTER_SPECIFICATION.md](../BIBLE_GAMES_MASTER_SPECIFICATION.md).

Цей документ відповідає на питання: **що фактично існувало в коді перед початком нового плану**. Він не присвоює фічам production-ready статус і не визначає порядок наступної роботи.

---

# 1. Загальний стан

Bible Games є великим функціональним alpha-прототипом, а не просто Telegram-вікториною. У репозиторії вже є:

- mobile web frontend;
- Telegram Mini App integration;
- Express API;
- Socket.IO multiplayer;
- окремий Telegram bot;
- JSON і PostgreSQL storage;
- learning/progression logic;
- значний question bank;
- AI scripts;
- дизайн-система;
- admin і social експерименти.

Production build frontend проходив, але security, server authority, tests, content quality і deployment model ще не відповідали production SaaS.

---

# 2. Підтверджений стек

## Frontend

- React 19;
- TypeScript;
- Vite;
- React Router;
- Zustand persistence;
- TanStack React Query;
- react-vant;
- Framer Motion;
- Telegram Web App SDK.

## Backend

- Express;
- Socket.IO;
- `tsx` runtime;
- JSON store;
- PostgreSQL/Supabase-oriented store;
- question and topic loaders;
- Kahoot room manager.

## Інші компоненти

- `bot/` — окремий Telegram bot package;
- `scripts/` — генерація, аналіз, імпорт і repair контенту;
- `data/question-db/`;
- `data/topics-db/`;
- GitHub Pages static frontend deployment.

---

# 3. Route і screen inventory

Підтверджені основні user routes:

- `/` — Home;
- `/play` — Play Hub;
- `/play/study` — Study Hub;
- `/play/study/themes`;
- `/play/study/themes/:themeId`;
- `/play/study/themes/:themeId/:nodeId`;
- practice quiz routes;
- review;
- millionaire;
- survival;
- `/profile`;
- `/shop`;
- `/stats`;
- `/admin`;
- challenges;
- communities;
- Kahoot create/join/room/display/playlists.

Також є legacy redirects зі старих `/themes`, `/play/solo`, adaptive/micro/sprint routes.

## Важливий факт

`/admin` є звичайним lazy-loaded React route без server-derived role guard. Приховування посилання в UI не є authorization.

---

# 4. Навчальні та ігрові можливості

Підтверджені або частково реалізовані:

- 7 difficulties;
- topics і recursive topic nodes;
- practice stages;
- pass threshold;
- review mistakes;
- mastery;
- recommendations;
- streak;
- rank/plaque/wisdom;
- achievements;
- profile;
- cosmetics;
- Millionaire;
- Survival;
- Kahoot-like rooms;
- playlists;
- Scripture panel;
- question explanations у частині даних.

Наявність типу, route або UI не означає, що весь data flow server-backed або production-ready.

---

# 5. Дані та джерела правди

Одночасно існують:

- embedded questions у `src/data/questions.ts`;
- additional frontend question files;
- `data/question-db/*.json`;
- topic DB;
- question tags;
- question overrides;
- exclusions;
- localStorage/Zustand profile;
- server JSON DB;
- PostgreSQL DB;
- in-memory demo arrays.

Клієнтські та серверні loaders частково дублюють domain behavior. Це створює ризик, що різні surfaces побачать різні питання, нормалізацію або тему.

Профіль має legacy migration helpers, але не мав завершеної загальної versioned migration platform.

---

# 6. Auth і identity

`server/middleware/telegramAuth.ts` містить Telegram `initData` HMAC validation, що є позитивним фундаментом.

Підтверджена критична проблема:

- middleware спочатку читає `x-user-id`;
- якщо `initData` або bot token відсутній, може бути прийнятий client header;
- strict mode перевіряє `AUTH_STRICT && BOT_TOKEN`, тому відсутня production secret конфігурація не обов’язково fail-closed;
- user-scope check порівнює path user ID із тим самим client-controlled header.

Отже, до Phase 1 identity не можна вважати надійною production boundary.

---

# 7. Admin і content mutation

`server/routes/questionsAdmin.ts`:

- має feature/env enable check;
- не мав повного role check;
- не був обгорнутий у verified auth у `server/index.ts`;
- дозволяв update/delete questions.

`src/repos/questionAdminRepo.ts` викликав API без verified Telegram headers.

`server/questionAdmin.ts` міг:

- читати JSON;
- переписувати JSON;
- створювати overrides/exclusions;
- робити synchronous file writes;
- не мав publication revision, reviewer, atomic workflow або audit trail.

Це development/admin tooling, яке не можна залишати відкритим у production.

---

# 8. Server authority

У `PlayerContext` frontend обчислював або ініціював готові значення для:

- coins;
- theme points;
- rank;
- wisdom;
- streak;
- achievements;
- practice progression;
- cosmetic purchases.

`sanitizeProfileBody` приймав значну частину цих полів із клієнта та переважно перевіряв форму/межі, а не право користувача на значення.

Отже, навіть після identity fix система потребує server-side commands, reward calculation, wallet ledger, idempotency і transactions.

---

# 9. Demo та mock behavior

У сервері існували endpoint із hardcoded або in-memory станом:

- study path;
- answer collection;
- daily completion;
- dashboard;
- leaderboard.

`GlobalStats.tsx` містив virtual players і прямо позначав рейтинг як локальну демонстрацію.

Challenges/communities tests підтверджували певну domain logic, але не доводили повний production DB flow.

Ці фічі повинні або перейти на real server data, або бути development-only/feature-flagged із чесним UI label.

---

# 10. Questions і content quality

Підтверджені ризики:

- `normalizeCorrectIndex` повертав `0` для invalid value;
- embedded legacy questions часто мали answer index `0`;
- зустрічалися неоднозначні або фактично проблемні формулювання;
- зустрічалася неприродна українська;
- difficulty calibration нерівномірна;
- не всі питання мають достатнє пояснення;
- не всі references гарантовано перевірені;
- питання не мають єдиного publication/revision state;
- немає обов’язкового `learningObjectiveId` у всьому legacy bank.

Позитивні сторони:

- є quality scripts;
- dedupe/statistics tools;
- AI normalization у частині scripts;
- Scripture audit;
- topic classification;
- question overrides/exclusions;
- admin review surfaces.

Потрібен контрольований Phase 4 cleanup, а не автоматичне визнання всього bank published.

---

# 11. AI tooling

У `package.json` було понад 24 AI/content commands, серед яких:

- generation;
- repair;
- topic generation/sorting;
- classification;
- stats/dedupe;
- explanation analysis/repair;
- Scripture audit;
- pool analysis;
- practice fill;
- import;
- launcher.

Підтверджені проблеми:

- немає єдиного CLI/registry;
- JS/TS/Python tooling існує паралельно;
- provider configuration розподілена;
- retry/parser/normalizer logic дублюється;
- не всі writes мають dry-run/staging;
- немає universal job state, budgets, cancellation і resume;
- немає production review/publish gate;
- MockProvider не є центральною основою tests.

---

# 12. Build, lint, typecheck і tests

За audit run 2026-08-01:

| Перевірка | Результат baseline |
|---|---|
| `npm install` | успішно, із peer warning |
| frontend build | успішно |
| lint | 56 errors, 26 warnings |
| smoke audit | успішно |
| classification test | failure через відсутній question ID |
| social test | успішно |
| server `tsc --noEmit` | приблизно 25 errors |

Відомі категорії:

- Rules of Hooks;
- effect dependencies;
- set-state-in-effect;
- missing Express types;
- implicit any;
- Vite env/glob typing;
- unused code;
- server runtime через `tsx` без mandatory typecheck.

GitHub Pages workflow запускав `npm ci`, frontend build і publish. Він не був повним CI quality gate.

---

# 13. Performance

Build повідомляв про великі question chunks, зокрема окремі тематичні JSON на декілька мегабайт і `pentateuch` приблизно 12 MB uncompressed.

`import.meta.glob` і theme-level lazy loading уже є позитивним кроком, але mobile Telegram WebView не повинен отримувати весь великий question bank. Цільовий server session має віддавати лише потрібний набір.

---

# 14. Дизайн

Наявні:

- design tokens;
- runtime cosmetic themes;
- Vant integration;
- safe-area/reduced-motion practices;
- окремий Kahoot visual exception;
- design audit.

Відомий борг:

- дублікати CTA/glass patterns;
- inconsistent spacing/radius/typography;
- z-index без токенів;
- custom і react-vant modal patterns;
- частина inline styles.

Це важливо, але не стоїть вище за Phase 1 security/data foundation.

---

# 15. Документаційна проблема до 2026-08-02

Одночасно існували:

- `implementation_plan.md` із багатьма старими фазами `Completed`;
- `task.md` із completed Study 2.0 task board;
- новий `MASTER_ROADMAP.md`, де нові Phase 1–13 були `planned`;
- 1530-рядковий окремий AI roadmap із `10.0–10.10`;
- README з частково застарілим описом storage/global stats.

Ця розбіжність усунута новою canonical specification. Старі статуси тепер трактуються тільки як історія попередньої ітерації.

---

# 16. Чесний baseline verdict

## Зберігати й розвивати

- продуктову ідею;
- український контент;
- наявні learning mechanics;
- topic hierarchy;
- practice/review;
- Telegram UX;
- Kahoot concept;
- server adapters;
- design tokens;
- AI/content tools як джерело досвіду.

## Не вважати готовим

- production auth;
- admin security;
- economy integrity;
- authoritative progress;
- real global ranking;
- social production backend;
- reviewed content pipeline;
- full CI;
- public SaaS release.

## Наступний крок

Тільки Phase 1 — Production Safety & Engineering Foundation із головної специфікації.

Документаційні коміти після baseline не виправляють описані runtime проблеми; вони лише встановлюють правильний порядок їх вирішення.