# Bible Games — open-source reference architecture та уточнення roadmap

> **Статус:** binding architecture and roadmap refinement  
> **Дата перевірки референсів:** 2026-08-04  
> **Репозиторій:** `DenisPoselyanov/biblegames_bot`  
> **Канонічний roadmap:** [`BIBLE_GAMES_MASTER_SPECIFICATION.md`](./BIBLE_GAMES_MASTER_SPECIFICATION.md)  
> **Phase implementation plans:** [`phases/`](./phases/README.md)

Цей документ уточнює технологічні рішення, межі MVP, послідовність імплементації та спосіб використання open-source референсів. Він **не створює нову нумерацію Phase**, не замінює master specification і не дозволяє сліпо копіювати код сторонніх проєктів.

У разі конфлікту діє порядок:

1. `BIBLE_GAMES_MASTER_SPECIFICATION.md`;
2. прийняті ADR у `DECISIONS.md`;
3. цей документ;
4. binding domain-документ відповідної системи;
5. implementation-файл активної Phase;
6. актуальний код, migrations і tests.

---

# 1. Навіщо потрібні зовнішні референси

Bible Games поєднує кілька різних класів продуктів:

- біблійне навчання;
- велику versioned базу питань;
- уроки з інтерактивними блоками;
- практику та повторення;
- одиночні ігрові режими;
- live Kahoot;
- приватні спільноти та виклики;
- AI Content Studio;
- Telegram Mini App;
- майбутню економіку, теми й Church/Classroom.

Не існує одного open-source репозиторію, який якісно закриває весь цей scope. Тому зовнішні проєкти використовуються як **вузькі архітектурні референси**:

| Система Bible Games | Основний референс | Додатковий референс |
|---|---|---|
| Learning objectives, адаптивний feedback, revisions | Oppia | Frappe Learning |
| Типізовані lesson blocks | H5P | Oppia rich-text/interactions |
| Question Bank, attempts, behaviours | Moodle Question subsystem | H5P question types |
| Review scheduler | Anki / FSRS | `ts-fsrs` |
| Live rooms, host/player/display | ClassQuiz | Socket.IO documentation |
| Простий course authoring | Frappe Learning | Oppia editor workflow |
| Offline boundaries і content packages | Kolibri | AndBible |
| Scripture modules, notes, translations, licensing | AndBible | окремі ліцензовані Bible APIs/datasets |

Головне правило:

> Ми повторюємо перевірені **межі, контракти та принципи**, але не переносимо чужий стек або великий framework у Bible Games без окремого ADR.

---

# 2. Перевірений baseline Bible Games

Поточний frontend уже має достатній фундамент:

- React 19;
- TypeScript;
- Vite;
- React Router;
- TanStack Query;
- Zustand;
- Framer Motion;
- Telegram Web App SDK;
- Socket.IO client.

Поточний backend:

- Node.js/TypeScript;
- Express;
- Socket.IO;
- PostgreSQL/Supabase adapter;
- JSON storage для legacy/dev;
- окремий Telegram bot;
- набір AI та content scripts.

Основні baseline-проблеми, які впливають на roadmap:

- `server/index.ts` поєднує composition root, routes, demo state, profile API і realtime lifecycle;
- persisted `PlayerProfile` змішує profile, progress, economy, rank, review schedule й cosmetics;
- `Difficulty` використовується і як складність питання, і як player rank;
- question data існує в кількох JSON/frontend/server джерелах;
- lesson, question, game та review runtime не мають єдиного immutable revision contract;
- частина endpoints і leaderboard є demo/in-memory;
- TypeScript interfaces не забезпечують runtime validation;
- testing stack ще не є цілісним production gate.

Висновок:

> Потрібен не rewrite, а контрольована еволюція поточного проєкту в модульний моноліт із PostgreSQL як source of truth.

---

# 3. Канонічні архітектурні рішення

## 3.1. Модульний моноліт замість microservices

Фізичні процеси:

1. **Web Mini App** — React/Vite.
2. **API + realtime server** — Node.js/TypeScript/Express/Socket.IO.
3. **Background worker** — Node.js/TypeScript, той самий domain code, окремий process.
4. **Telegram bot** — тонкий integration adapter.
5. **PostgreSQL** — authoritative transactional data.
6. **S3-compatible object storage** — media.
7. **Redis** — тільки після доказаної потреби горизонтального realtime scaling.

Не створювати окремий service для lessons, questions, games або communities, поки один модульний backend задовольняє performance, ownership і deployment requirements.

## 3.2. Доменні межі

Backend і shared contracts поступово розділяються на модулі:

- `identity`;
- `content`;
- `scripture`;
- `question-bank`;
- `question-runtime`;
- `learning`;
- `review`;
- `games`;
- `realtime`;
- `social`;
- `economy`;
- `ai-content`;
- `notifications`;
- `shared`.

Кожен модуль має:

- domain types;
- runtime schemas;
- service/application commands;
- repository interfaces;
- infrastructure adapters;
- tests;
- explicit public exports.

Заборонено створювати циклічні imports або використовувати frontend store як canonical business service.

## 3.3. Central learning model

Центральний ланцюг даних:

```text
LearningTopic
  → LearningObjective
    → LessonRevision
    → QuestionRevision
    → Practice/Review/Game usage
```

`LearningObjective` є найменшою педагогічно значущою одиницею. Topic потрібна для навігації, lesson — для пояснення, question — для перевірки, review state — для пам’яті конкретного користувача.

## 3.4. Розділення чотирьох понять

Не використовувати один enum для різних систем:

- `QuestionDifficulty` — складність конкретного питання;
- `PlayerRank` — мотиваційний ігровий статус;
- `ObjectiveMastery` — засвоєння конкретної навчальної цілі;
- `MemoryState` — коли користувачеві потрібно повторити знання.

Міграція legacy `Difficulty` повинна бути explicit, versioned і backward-compatible.

## 3.5. Question Bank і Question Runtime — різні модулі

### Question Bank відповідає за:

- draft/review/published/quarantined lifecycle;
- immutable revisions;
- категоризацію;
- learning objective mapping;
- difficulty;
- explanations;
- Scripture references;
- duplicate detection;
- quality reports;
- import/export;
- mode eligibility;
- редакторські дії.

### Question Runtime відповідає за:

- створення session blueprint;
- фіксацію конкретних `questionRevisionId`;
- randomization;
- answer visibility;
- перевірку відповіді;
- feedback policy;
- attempt state;
- idempotent submit;
- resume;
- final result.

Question Runtime не редагує Question Bank. Question Bank не розраховує player rewards.

## 3.6. Lesson block registry

Lesson не є HTML-статтею або великим JSX-компонентом. Published `LessonRevision` містить ordered blocks.

Початкові block types:

- `heading`;
- `rich_text`;
- `scripture`;
- `explanation`;
- `key_term`;
- `callout`;
- `image`;
- `map`;
- `timeline`;
- `reflection`;
- `checkpoint`;
- `summary`;
- `next_step`.

Кожен block type має:

- stable type ID;
- schema version;
- Zod schema;
- authoring form;
- renderer;
- accessibility contract;
- analytics event policy;
- migration path;
- media fallback;
- tests.

У MVP реалізуються лише block types, необхідні для першого повного learning loop. Карти, timelines, hotspots, video та advanced interactions додаються після стабілізації registry.

## 3.7. Immutable revisions

Published content не редагується на місці.

Потрібні окремі сутності:

- `Question` — stable identity;
- `QuestionRevision` — immutable content snapshot;
- `Lesson` — stable identity;
- `LessonRevision` — immutable ordered block snapshot;
- `PublicationSet` — atomic набір опублікованих revisions;
- `PracticeSessionQuestion` — посилання на конкретний revision;
- `GameSessionQuestion` — посилання на конкретний revision.

Редагування завтра не змінює активний Kahoot, завершену практику або історичний результат.

## 3.8. Scripture як окремий модуль

Lesson і Question зберігають canonical reference, наприклад:

```text
bookId + chapter + verseStart + verseEnd
```

Вони не повинні дублювати повний текст усіх перекладів.

`scripture` module відповідає за:

- canonical book IDs;
- translation metadata;
- lookup;
- caching;
- copyright/licensing metadata;
- offline permission;
- quote length rules;
- fallback, якщо translation недоступний.

AI не створює власний переклад Писання.

## 3.9. Server authority

Server визначає:

- identity;
- access;
- correct answer;
- attempt result;
- mastery update;
- review schedule;
- XP;
- level/rank;
- coins;
- challenge score;
- Kahoot score;
- leaderboard;
- purchases;
- entitlements.

Client надсилає intent і відображає authoritative outcome.

## 3.10. Background jobs

AI, imports і media processing не виконуються у request handler.

Job system потрібна для:

- AI generation;
- AI validation;
- duplicate analysis;
- bulk import;
- Scripture audit;
- image generation;
- thumbnail/transcoding;
- publication preparation;
- scheduled notifications;
- analytics aggregation.

Початкова рекомендація — PostgreSQL-backed queue (`pg-boss` або еквівалент після spike), щоб не вводити Redis лише заради jobs.

---

# 4. Рекомендований стек

## 4.1. Залишити

| Шар | Рішення | Причина |
|---|---|---|
| UI | React 19 + TypeScript | поточний стек, достатній для Mini App |
| Build | Vite | швидкий, простий, уже інтегрований |
| Routing | React Router | достатній для mobile web flow |
| Server state | TanStack Query | cache, invalidation, retries |
| Local ephemeral state | Zustand | UI/session state, але не server authority |
| Motion | Framer Motion | уже є canonical motion system |
| API | Express + TypeScript | не потребує rewrite |
| Realtime | Socket.IO | відповідає Kahoot lifecycle |
| Database | PostgreSQL/Supabase | transactional source of truth |
| Telegram | Mini App SDK + bot | основна платформа |

## 4.2. Додати по Phase

| Технологія/підхід | Phase | Для чого |
|---|---:|---|
| Zod | 1–2 | runtime validation для HTTP, Socket.IO, jobs, content blocks |
| Vitest | 1 | unit/domain tests |
| Supertest | 1 | HTTP integration tests |
| Playwright | 1–3 | критичні user flows і Telegram-like mobile viewport |
| Drizzle ORM + Drizzle Kit | 2 | typed PostgreSQL schema, migrations, explicit SQL |
| PostgreSQL test database | 1–2 | integration/migration tests |
| `pg-boss` або validated equivalent | 2–4 | background jobs без раннього Redis |
| S3-compatible storage | 2–4 | images, maps, audio, video, thumbnails |
| PostgreSQL FTS + `pg_trgm` | 2–4 | пошук по контенту й питаннях |
| Redis + Socket.IO adapter | 5, conditional | тільки для multi-instance realtime |
| `ts-fsrs` | 7 або пізня 3 | після накопичення review logs і A/B validation |
| Pino/OpenTelemetry/Sentry equivalent | 1–7 | structured logs, tracing, error monitoring |
| k6 або Artillery | 5–7 | Kahoot/load testing після окремого spike |

## 4.3. Не додавати без ADR

- Next.js;
- NestJS;
- Django/FastAPI;
- Frappe Framework;
- Moodle runtime;
- H5P runtime;
- microservices;
- GraphQL;
- Kafka;
- Kubernetes;
- Meilisearch;
- Redis як обов’язкову залежність першого MVP.

Ці рішення можуть бути корисними в інших продуктах, але зараз збільшать deployment і cognitive cost без доведеної користі.

---

# 5. Open-source референси

## 5.1. Oppia

**Репозиторій:** `oppia/oppia`  
**Використовувати для:** learning objectives, skills, interactive feedback, versioned content, editor workflow.

### Які задачі вирішує

- інтерактивні навчальні explorations;
- learning paths;
- skills;
- feedback залежно від відповіді;
- редакторський workflow;
- content migrations;
- learner progress.

### Архітектурний урок

Domain model, storage model, frontend model і editor state не повинні бути одним об’єктом. Контент має validation, versions і migration path.

### Що повторити

- `LearningObjective`/skill як canonical knowledge unit;
- response-specific feedback;
- draft → review → publish;
- versioned content;
- content validation до publication;
- editor preview;
- analytics по learning outcome.

### Чого не повторювати

- повний branching engine в MVP;
- Angular/Python stack;
- масштаб усього Oppia;
- складний universal authoring platform до запуску базових уроків.

### Як AI-агенту шукати референси

Пошукові запити в `oppia/oppia`:

- `skill domain`;
- `exploration domain`;
- `state interaction`;
- `answer group feedback`;
- `versioned entity`;
- `migration job`;
- `validation errors`;
- `learner progress`.

Агент повинен спочатку описати патерн, а не копіювати файли.

## 5.2. H5P

**Організація:** `h5p`  
**Використовувати для:** lesson block registry, versioned content types, semantics/validation, interactive blocks.

### Які задачі вирішує

- незалежні типи навчального контенту;
- schema-driven authoring;
- dependencies між content types;
- rendering і upgrades;
- interactive questions/media.

### Що повторити

- stable block type;
- schema version;
- окремий editor і renderer;
- declared dependencies;
- migrations;
- accessibility metadata;
- content package validation.

### Чого не повторювати

- iframe/plugin runtime;
- виконання стороннього JavaScript;
- PHP integration;
- десятки block types до стабілізації базового registry;
- автоматичне встановлення community content types у production.

### Як шукати

У `h5p/*`:

- `library.json`;
- `semantics.json`;
- `upgrade.js`;
- `content type dependencies`;
- `accessibility`;
- `question type`.

Код можна використовувати лише після окремої license review; architecture vocabulary дозволено використовувати як референс.

## 5.3. Moodle Question subsystem

**Репозиторій:** `moodle/moodle`  
**Використовувати для:** Question Bank, attempts, question behaviours, grading/feedback visibility, import/export.

### Які задачі вирішує

- велика база питань;
- категорії;
- multiple question types;
- versioning;
- attempts;
- grading;
- feedback;
- import/export;
- різні behaviours.

### Що повторити

- Bank і Runtime як різні subsystems;
- attempt lifecycle;
- question usage незалежно від quiz/game;
- visibility policy;
- resumable attempt;
- question version references;
- import/export adapters.

### Чого не повторювати

- PHP;
- gradebook і plugin complexity;
- універсальні налаштування LMS;
- Moodle UI;
- GPL-код без legal review.

### Як шукати

У `moodle/moodle`:

- `question bank`;
- `question engine`;
- `question_attempt`;
- `question_usage`;
- `question behaviour`;
- `question version`;
- `question import`;
- `question export`.

## 5.4. ClassQuiz

**Репозиторій:** `mawoka-myblock/ClassQuiz`  
**Використовувати для:** Kahoot host/player/display, rooms, realtime state, load testing, self-hosting.

### Перевірений стек референсу

- SvelteKit frontend;
- FastAPI backend;
- Python Socket.IO;
- PostgreSQL;
- Redis;
- Meilisearch;
- Caddy.

Цей стек **не переноситься** у Bible Games. Вивчаються лише realtime boundaries.

### Що повторити

- host/player/display separation;
- authoritative server timer;
- room state machine;
- reconnect;
- stable participant identity;
- frozen quiz content;
- load tests;
- horizontal scaling через adapter лише після потреби.

### Чого не повторювати

- SvelteKit/FastAPI rewrite;
- Redis у першій версії;
- Meilisearch без виміряної потреби;
- room result тільки в process memory;
- довіру до client score.

### Як шукати

У `mawoka-myblock/ClassQuiz`:

- `room`;
- `game state`;
- `player join`;
- `socketio`;
- `reconnect`;
- `answer`;
- `score`;
- `load test`;
- `frontend host`;
- `frontend player`.

## 5.5. Anki та `ts-fsrs`

**Репозиторії:** `ankitects/anki`, `open-spaced-repetition/ts-fsrs`  
**Використовувати для:** review state, scheduling, immutable review logs.

### Що повторити

- scheduler як окремий pure/domain module;
- review log;
- deterministic transition;
- algorithm version;
- user-specific memory state;
- preview нового schedule без mutation;
- ability to recompute/audit.

### Чого не повторювати

- UI `Again/Hard/Good/Easy` у звичайному quiz flow;
- повну Anki card model;
- user self-rating як єдиний signal;
- parameter optimization до накопичення достатніх logs.

### MVP-рішення

Спочатку реалізувати простий deterministic scheduler із versioned rules. `ts-fsrs` оцінити після накопичення реальних review logs і порівняння retention.

### Як шукати

У `open-spaced-repetition/ts-fsrs`:

- `createEmptyCard`;
- `repeat`;
- `next`;
- `ReviewLog`;
- `State`;
- `Rating`;
- `parameters`;
- `workflow`.

У `ankitects/anki`:

- `scheduler`;
- `revlog`;
- `card state`;
- `sync conflict`.

## 5.6. Frappe Learning

**Репозиторій:** `frappe/lms`  
**Використовувати для:** простий course authoring, course/chapter/lesson hierarchy, batches, instructor UX.

### Що повторити

- проста структура content tree;
- низький поріг створення курсу;
- preview;
- batches/group learning як окремий контур;
- course content не залежить від конкретної групи.

### Чого не повторювати

- Frappe Framework;
- ERP-style admin complexity;
- assignments/certificates/live classes у першому MVP;
- Python/Vue rewrite.

### Як шукати

У `frappe/lms`:

- `Course`;
- `Chapter`;
- `Lesson`;
- `Quiz`;
- `Batch`;
- `CourseProgress`;
- `certificate`;
- `lesson editor`.

## 5.7. Kolibri

**Репозиторій:** `learningequality/kolibri`  
**Використовувати для:** offline-first boundaries, content ingestion, content packages, sync/recovery.

### Що повторити

- content package versioning;
- content ingestion окремо від learner runtime;
- offline capability classification;
- resilient local progress queue;
- explicit conflict/retry rules;
- media variants;
- recovery після Android process stop.

### Чого не повторювати

- local school server topology;
- P2P distribution;
- повний offline у MVP;
- client-authoritative offline rewards;
- Python/Vue architecture.

### Як шукати

У `learningequality/kolibri`:

- `content node`;
- `channel import`;
- `content database`;
- `sync queue`;
- `offline`;
- `Android service`;
- `content annotation`;
- `progress sync`.

## 5.8. AndBible

**Репозиторій:** `AndBible/and-bible`  
**Використовувати для:** Scripture module, translations, offline modules, bookmarks, notes, licensing awareness.

### Що повторити

- Scripture content як окремий module;
- reference-based notes/bookmarks;
- translation metadata;
- module availability;
- offline/licensing distinction;
- UI не залежить від одного перекладу.

### Чого не повторювати

- Android native stack;
- повну Bible study feature set;
- копіювання GPL-коду;
- імпорт перекладів без permission review;
- дублювання verse text у кожному lesson/question record.

### Як шукати

У `AndBible/and-bible`:

- `Bible document`;
- `module`;
- `bookmark`;
- `note`;
- `translation`;
- `offline`;
- `copyright`;
- `osis`.

---

# 6. License і безпечне використання референсів

Open-source не означає, що код можна безумовно переносити.

Перед будь-яким copy/adaptation AI-агент повинен:

1. знайти актуальний `LICENSE` конкретного репозиторію й підмодуля;
2. визначити, чи сумісна ліцензія з Bible Games;
3. відрізнити architectural idea від copied implementation;
4. зафіксувати attribution obligations;
5. не копіювати GPL/AGPL/MPL код без окремого legal/owner decision;
6. не копіювати assets, translations або content datasets лише тому, що source code відкритий;
7. не переносити API keys, production configs або user data.

За замовчуванням:

> Використовувати зовнішній код тільки як матеріал для аналізу. Реалізацію писати нативно в поточному TypeScript stack.

---

# 7. Цільова структура системи

```text
apps (logical, не обов’язково окремі packages)
├── web-mini-app
├── api-realtime
├── worker
└── telegram-bot

domains
├── identity
├── content
├── scripture
├── question-bank
├── question-runtime
├── learning
├── review
├── games
├── realtime
├── social
├── economy
├── ai-content
├── notifications
└── shared

infrastructure
├── postgres
├── object-storage
├── job-queue
├── telemetry
├── telegram
└── optional-redis
```

Це логічна карта. Не потрібно одразу переносити все в monorepo packages.

## 7.1. Trusted principal

Auth middleware створює trusted object:

```text
AuthenticatedPrincipal
- userId
- telegramUserId
- roles
- permissions
- authTime
- session/request metadata
```

Routes і Socket.IO handlers не читають raw `x-user-id` як identity.

## 7.2. API contract

Кожен endpoint/event має:

- Zod input schema;
- Zod output schema;
- typed error contract;
- authenticated principal requirement;
- authorization rule;
- idempotency rule для mutations;
- audit policy;
- tests.

## 7.3. Read models

Великі UI screens отримують prepared read models, а не весь persisted aggregate.

Приклади:

- `TodayDashboard`;
- `LearningPlanSummary`;
- `PracticeSessionView`;
- `ProgressDashboard`;
- `CommunityOverview`;
- `StoreCatalogView`.

`PlayerProfile` не залишається універсальною таблицею для всього продукту.

---

# 8. Межі MVP

## 8.1. Основна перевірка MVP

MVP повинен довести один повний цикл:

```text
Published lesson
→ checkpoint
→ server-created practice session
→ answer feedback
→ mistake review
→ objective mastery update
→ progress dashboard
```

## 8.2. У MVP входить

### Identity і safety

- Telegram auth;
- explicit dev auth;
- trusted principal;
- RBAC foundation;
- audit foundation;
- rate limits для critical routes;
- server authority.

### Content model

- Topic;
- LearningObjective;
- Lesson/Revision;
- Question/Revision;
- ScriptureReference;
- publication status;
- quarantine.

### Lesson

- heading;
- rich text;
- Scripture;
- explanation;
- key term;
- image;
- checkpoint;
- summary;
- next step.

### Question Bank

- міграція якісного subset існуючої бази;
- сім `QuestionDifficulty`;
- explanations;
- references;
- objective mapping;
- eligibility;
- quality/quarantine;
- immutable revisions.

### Practice

- strict difficulty;
- mixed adjacent difficulty;
- 7 або 14 питань;
- frozen revisions;
- resume;
- idempotent submit;
- correct/wrong feedback;
- review mistakes.

### Review

- deterministic versioned scheduler;
- review queue;
- immutable review log;
- no FSRS optimization yet.

### Progress

- lesson completion;
- objective mastery;
- accuracy;
- weak objectives;
- streak;
- окремий player level/rank.

### Одна завершена гра

`Millionaire` входить у canonical MVP після стабілізації Question Runtime:

- демонструє сім рівнів складності;
- не потребує realtime;
- використовує той самий Question Bank;
- має server-authoritative game outcome;
- не впливає на mastery так само сильно, як practice.

### Design і motion

- тема `Світло`;
- shared components;
- lesson transitions;
- correct/wrong feedback;
- completion;
- level/rank event;
- reduced motion.

### Мінімальний Content Studio

- create/edit lesson draft;
- preview;
- review;
- publish;
- rollback;
- AI draft generation;
- AI не може publish.

## 8.3. Не входить у перший MVP

- live Kahoot;
- live duel;
- open communities;
- group chat;
- marketplace;
- Telegram Stars;
- Premium;
- Church billing;
- public author platform;
- user-facing AI chat;
- full offline rewards;
- audio/video production pipeline;
- advanced maps/hotspots;
- десятки платних themes;
- FSRS parameter optimization;
- multi-instance realtime;
- Redis requirement.

---

# 9. Уточнений roadmap Phase 0–8

Цей розділ не змінює нумерацію. Він уточнює product gate і референси кожної Phase.

## Phase 0 — Canonical Documentation and Verified Baseline

Додатковий результат:

- цей reference document індексований;
- зафіксовано поточний стек;
- external references не вважаються dependencies;
- license rule додано до AI workflow.

## Phase 1 — Production Safety & Engineering Foundation

### Обов’язково додати

- trusted Telegram principal;
- fail-closed auth;
- RBAC/permissions;
- Zod runtime schemas для critical API/events;
- standard errors;
- idempotency foundation;
- audit foundation;
- Vitest;
- Supertest;
- Playwright smoke;
- PostgreSQL test environment;
- production demo endpoint isolation/removal;
- structured logging.

### Референси

- Oppia validation discipline;
- Moodle attempt safety concepts;
- ClassQuiz load/realtime test discipline, але не realtime implementation у цій Phase.

### Gate

Phase 2 не починає domain migration, доки identity, permission і transaction tests не доводять fail-closed behavior.

## Phase 2 — Core Architecture & Authoritative Data Platform

### Обов’язково додати

- modular monolith boundaries;
- Drizzle schema/migrations після spike;
- repositories/services;
- canonical IDs;
- Question/QuestionRevision;
- Lesson/LessonRevision;
- LearningObjective;
- ScriptureReference;
- attempts/review logs;
- worker foundation;
- PostgreSQL-backed jobs;
- object storage adapter;
- PostgreSQL FTS/trigram search;
- read model/query layer;
- profile decomposition.

### Референси

- Oppia domain/storage separation;
- Moodle Question Bank vs Runtime;
- H5P schema/version concepts;
- AndBible Scripture module boundaries.

### Gate

Phase 3 використовує лише versioned published content і authoritative session APIs, а не нові frontend-only mock structures.

## Phase 3 — Learning Product, MVP, Rebrand & Motion

### Обов’язково реалізувати

- lesson block registry;
- first published learning path;
- Question Runtime;
- frozen practice sessions;
- strict/mixed difficulty;
- explanations;
- review mistakes;
- deterministic scheduler;
- objective mastery;
- Today plan;
- progress;
- theme `Світло`;
- canonical motion;
- Millionaire як перша повністю інтегрована game mode.

### Референси

- Oppia learning objectives і feedback;
- H5P block registry;
- Moodle attempt lifecycle;
- Anki/FSRS scheduler boundaries;
- Frappe Learning simple course UX.

### Gate

Phase 3 вважається завершеною не через красиві screens, а після E2E циклу `lesson → practice → review → progress` із server authority.

## Phase 4 — Content Quality, AI Pipeline & Content Studio

### Обов’язково реалізувати

- unified authoring model;
- draft/review/publish/rollback;
- AI jobs через queue;
- prompt/model/version provenance;
- coverage matrix;
- generation тільки для gaps;
- Scripture validation;
- duplicate/ambiguity/difficulty checks;
- human theological review;
- media asset model;
- AI image prompt generation;
- image/map/icon proposal workflow;
- no automatic publication;
- atomic publication set.

### Референси

- Oppia editor/revisions;
- H5P semantics/versioning;
- Frappe Learning authoring simplicity;
- Kolibri content ingestion;
- AndBible licensing discipline.

### Gate

Content Studio не може публікувати контент, якщо хоча б один required validation/review state не завершений.

## Phase 5 — Social, Groups, Challenges & Multiplayer

Реалізація всередині Phase йде в такому порядку:

1. приватні communities;
2. memberships/roles/invites;
3. group learning plan;
4. cooperative group goal;
5. asynchronous friend challenge;
6. anti-spam/anti-farming;
7. Kahoot persistent room model;
8. host/player/display;
9. reconnect;
10. load testing;
11. conditional Redis adapter.

### Референси

- ClassQuiz для realtime lifecycle;
- Frappe Learning batches;
- Moodle roles/capabilities лише як conceptual reference;
- Kolibri recovery patterns.

### Gate

Redis не додається лише тому, що він є в ClassQuiz. Він додається, коли load/deployment tests доводять потребу multi-instance Socket.IO.

## Phase 6 — Economy, Shop, Entitlements & Monetization

### Уточнення

- immutable wallet ledger;
- entitlements окремо від profile JSON;
- themes — cosmetic only;
- purchase/event idempotency;
- Stars не змішуються з internal coins;
- monetization model потребує ADR;
- no pay-to-win;
- external reference code не визначає pricing/business policy.

## Phase 7 — Performance, Offline, Accessibility & Public Release

### Обов’язково додати

- performance budgets;
- bundle/data splitting;
- object storage/CDN variants;
- offline capability matrix;
- lesson caching;
- safe queued sync only for approved operations;
- no client-authoritative offline rewards;
- accessibility audit;
- reduced motion;
- backup/restore drills;
- observability/alerts;
- incident runbooks;
- load tests;
- FSRS evaluation тільки за достатніх review logs;
- public release gates.

### Референси

- Kolibri offline/content packaging;
- AndBible offline Scripture modules;
- Anki sync/review logs;
- ClassQuiz load tests.

## Phase 8 — Expansion and Bonus Capabilities

Кандидати:

- advanced adaptive learning;
- FSRS optimization;
- user-facing bounded AI assistant;
- Church/Classroom organization hierarchy;
- presenter mode;
- audio/video;
- advanced maps/timelines/hotspots;
- native/PWA expansion;
- public author ecosystem;
- internationalization;
- optional search service;
- plugin/API ecosystem.

Кожна ініціатива потребує окремого decision gate. Phase 8 не є дозволом реалізувати всі future options.

---

# 10. Послідовність MVP-імплементації всередині Phase 1–4

1. Auth principal і permissions.
2. Runtime schemas та standard errors.
3. Test foundation.
4. PostgreSQL schema/migrations.
5. Modular domain services.
6. Question/QuestionRevision import.
7. LearningObjective mapping.
8. Lesson/Block registry.
9. Question Runtime і attempt persistence.
10. Practice session generation.
11. Feedback/explanations.
12. Review scheduler/log.
13. Mastery і progress read models.
14. Today plan.
15. Theme/motion integration.
16. Millionaire reuse of Question Runtime.
17. Minimal Content Studio.
18. AI generation jobs.
19. Media asset pipeline.
20. Publication/rollback.

Паралельна UI-розробка дозволена лише за stable contracts і feature flags.

---

# 11. AI-agent workflow для використання GitHub референсів

Перед реалізацією функції агент повинен створити коротку evidence table:

| Поле | Вміст |
|---|---|
| Bible Games task | конкретна функція/constraint |
| Reference project | один основний репозиторій |
| Search queries | конкретні symbols/terms |
| Pattern found | принцип або state machine |
| What to reuse | architecture/test idea |
| What not to copy | stack, framework, code, assets |
| License checked | так/ні + висновок |
| Native implementation path | файли/модулі Bible Games |
| Tests required | unit/integration/E2E/load |

Агенту заборонено:

- писати «зробимо як Moodle/Oppia» без точного патерну;
- копіювати великі файли;
- додавати framework лише через reference project;
- змінювати стек без ADR;
- вигадувати path або API стороннього repo;
- вважати README доказом production correctness;
- копіювати assets/content/translations;
- використовувати застарілий branch без перевірки recent activity;
- змішувати кілька reference architectures в одному модулі без явного ownership.

---

# 12. Anti-patterns, яких треба уникнути

- один giant `PlayerProfile` як база всього;
- один giant `server/index.ts`;
- shared enum для difficulty/rank/mastery;
- correct answer у payload майбутніх питань;
- frontend-generated rewards;
- lesson як довільний HTML без schema version;
- редагування published question на місці;
- Kahoot room тільки в RAM без recovery;
- Redis/Meilisearch/Kubernetes до виміряної потреби;
- AI write directly to published data;
- Bible text без licensing metadata;
- offline mutation без idempotency;
- окремий selection algorithm у кожній грі;
- дублювання question checking у frontend, API, bot і Socket.IO;
- повний rewrite замість migration;
- копіювання чужого open-source коду без license review.

---

# 13. Definition of Done для цього уточнення roadmap

Це архітектурне уточнення вважається інтегрованим, коли:

- документ присутній у `docs/README.md`;
- `docs/phases/README.md` вимагає читати його для Phase 1–8;
- `docs/PHASE_STATUS.md` відображає уточнений MVP gate;
- AI documentation rules вимагають reference evidence і license review;
- нова функція не змінює стек лише через зовнішній референс;
- Phase 1–4 execution briefs використовують описані boundaries;
- Phase 5 не вводить Redis до load/deployment evidence;
- Phase 7 визначає offline capability per operation;
- майбутні агенти можуть знайти потрібний external pattern через наведені search queries;
- runtime-код не був змінений цим документаційним комітом.
