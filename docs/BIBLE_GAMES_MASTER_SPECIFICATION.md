# Bible Games — головна специфікація продукту та розробки

> **Статус документа:** канонічне джерело правди  
> **Версія:** 1.0  
> **Дата:** 2026-08-02  
> **Репозиторій:** `DenisPoselyanov/biblegames_bot`  
> **Перевірений baseline коду:** `7d074d5` / `main`  
> **Основна мова продукту:** українська  
> **Цільова платформа:** Telegram Mini App і сучасний мобільний веб  
> **Наступна фаза після об’єднання документації:** Phase 1 — Production Safety & Engineering Foundation

---

# 0. Призначення документа

Цей файл об’єднує в одну систему:

- фактичний стан старої та поточної версії Bible Games;
- продуктове бачення;
- технічну архітектуру;
- вимоги до безпеки, даних, контенту, UI/UX і AI;
- великий послідовний план розвитку;
- критерії готовності кожної фази;
- правила роботи Codex, Claude Code та інших AI-агентів;
- release gates, які не дозволяють називати функцію завершеною без доказів.

Цей документ замінює старі конкуруючі roadmap і task board як джерело актуального плану. Історичні документи зберігаються лише для контексту та не визначають порядок майбутньої роботи.

## 0.1. Ієрархія документації

1. **Цей файл** — продукт, архітектура, фази, пріоритети, критерії готовності.
2. `AI_AGENT_MASTER_EXECUTION_PROMPT.md` — готовий промт для виконання конкретної фази за цією специфікацією.
3. `DECISIONS.md` — прийняті архітектурні рішення та причини.
4. `archive/CURRENT_STATE_AUDIT.md` — історичний baseline, а не активний roadmap.
5. `DESIGN_RULES.md` — доменне джерело правди лише для дизайн-системи.
6. `MOTION_SYSTEM.md` — доменне джерело правди для transitions, feedback, celebrations, reduced motion, authoritative triggers і motion QA.
7. `archive/DESIGN_AUDIT.md` — знімок відповідності UI дизайн-системі.
8. `SUPABASE_SETUP.md`, `AI_SETUP.md`, `LOCAL_TOOLS.md`, `DEVELOPER_GUIDE.md` — операційні інструкції, які не можуть змінювати продуктову архітектуру або порядок фаз.
9. `archive/implementation_plan.md`, `archive/task.md`, `archive/MASTER_ROADMAP.md` і `archive/AI_SYSTEM_REBUILD_ROADMAP.md` — історичні матеріали.

У разі розбіжності завжди перемагає цей документ.

## 0.2. Правило великих фаз

Проєкт не ділиться на десятки мікрофаз на кшталт `10.0`, `10.1`, `10.2`. Кожна фаза нижче є великим завершеним продуктово-технічним блоком.

Усередині фази дозволені:

- окремі робочі потоки;
- атомарні коміти;
- feature flags;
- проміжні міграції;
- окремі pull request, якщо обсяг занадто великий.

Але вони не створюють нову паралельну систему нумерації та не можуть бути оголошені самостійно завершеним продуктом. Фаза закривається лише після проходження всіх її release gates.

---

# 1. Коротке резюме продукту

Bible Games починався як українська Telegram-вікторина з біблійними темами, складностями, очками та профілем. За декілька ітерацій застосунок виріс у великий функціональний прототип навчальної платформи з практикою, ієрархією тем, mastery, рангами, магазином, режимами «Мільйонер», «Виживання», Kahoot-подібними кімнатами, сервером, PostgreSQL/Supabase-адаптером, Telegram-ботом та набором AI-інструментів для контенту.

Поточна версія має значну продуктову цінність, але її фундамент ще не відповідає production SaaS:

- ідентичність користувача може визначатися клієнтським `x-user-id`;
- монети, прогрес, streak і ранг значною мірою розраховує та надсилає клієнт;
- admin API не має повноцінної ролі та захисту;
- частина backend endpoint є demo/in-memory;
- CI перевіряє переважно build;
- lint, server typecheck і частина тестів мають відомі помилки;
- контентна база містить неоднозначні, мовно слабкі або фактично проблемні питання;
- документація раніше заявляла різні фази одночасно «completed» і «planned».

Тому головний напрям розвитку:

> **Спочатку безпечний і перевірений фундамент, потім цілісний learning-first продукт, після цього AI, social, economy, масштабування та бонусні можливості.**

---

# 2. Місія, цінність і межі продукту

## 2.1. Місія

Створити якісний український застосунок для системного вивчення Біблії, який поєднує:

- короткі щоденні навчальні сесії;
- послідовні навчальні плани;
- біблійний контекст і пояснення;
- практику та повторення;
- здорову гейміфікацію;
- групове навчання;
- безпечні AI-інструменти для редакторів і користувачів.

## 2.2. Основна продуктова обіцянка

Користувач не просто відповідає на випадкові питання. Він розуміє:

- що вивчає зараз;
- чому це важливо;
- як тема пов’язана з біблійним текстом;
- що вже засвоїв;
- що потрібно повторити;
- який наступний логічний крок.

## 2.3. Цільові користувачі

Основні:

- підлітки та молодь;
- дорослі, які хочуть системно вивчати Біблію;
- нові віруючі;
- учасники домашніх груп;
- учні недільної школи;
- молодіжні служителі, вчителі й наставники.

Додаткові:

- церкви та групи, які проводять інтерактивні заняття;
- редактори біблійного контенту;
- автори навчальних планів і тематичних добірок.

## 2.4. Що продукт не повинен робити

- подавати AI як духовний авторитет;
- автоматично формувати доктринальні вироки;
- замінювати пастора, наставника або особисте читання Біблії;
- публікувати неперевірений AI-контент;
- маніпулювати streak, страхом втрати або платними механіками;
- продавати користувачеві перевагу в знаннях чи рейтингу;
- приховувати, що функція є demo або експериментальною.

---

# 3. Стара та поточна версія застосунку

## 3.1. Технічний стек

Поточний репозиторій містить:

- React 19 + TypeScript;
- Vite;
- React Router;
- Zustand із persistence;
- TanStack React Query;
- react-vant;
- Framer Motion;
- Telegram Web App SDK;
- Express server;
- Socket.IO для Kahoot-подібних кімнат;
- JSON storage і PostgreSQL storage;
- окремий Telegram bot package;
- Ollama, Gemini та OmniRoute інструменти для AI-контенту;
- великі JSON-бази питань і тем.

Повний monorepo з багатьма пакетами не вводиться без реальної потреби. Логічні межі спочатку створюються всередині наявного репозиторію.

## 3.2. Наявні користувацькі екрани

У поточній версії існують або частково існують:

- Home;
- Play Hub;
- Study Hub;
- список тем;
- деталізація теми та ієрархії;
- практика за складністю, етапом і вузлом;
- повторення помилок;
- профіль;
- магазин косметики;
- статистика та demo-рейтинг;
- «Мільйонер»;
- «Виживання»;
- Kahoot hub;
- створення і приєднання до кімнати;
- display screen;
- playlists та playlist editor;
- challenges;
- communities;
- admin panel.

Також збережені legacy redirects зі старих маршрутів.

## 3.3. Наявна навчальна модель

Реалізовано або частково реалізовано:

- сім рівнів складності: `baby`, `child`, `youth`, `student`, `preacher`, `teacher`, `theologian`;
- тематичні question pools;
- ієрархія: розділ → тема → підтема → мікротема;
- practice stages;
- мінімальний поріг проходження;
- mastery;
- streak;
- rank, plaque і wisdom points;
- рекомендації;
- review mistakes;
- короткі та розширені пояснення у частині контенту;
- біблійні посилання;
- вибір перекладу.

Це сильний прототип, але модель ще не має єдиного канонічного `LearningObjective`, повноцінного lesson lifecycle, серверного review scheduler і стабільної версії схем.

## 3.4. Дані та storage

Наявні паралельні джерела:

- embedded питання у `src/data/questions.ts`;
- додаткові питання у frontend data files;
- `data/question-db/*.json`;
- `data/topics-db/*.json`;
- question tags, overrides та exclusions;
- клієнтський Zustand/localStorage;
- server JSON store;
- PostgreSQL/Supabase store;
- in-memory demo масиви в окремих endpoint.

Паралельність джерел створює ризик розсинхронізації. У майбутній архітектурі кожен тип даних повинен мати одне авторитетне джерело та чіткий migration path.

## 3.5. Наявний AI-контур

У проєкті є понад два десятки окремих команд для:

- генерації питань;
- виправлення питань;
- генерації тем;
- сортування тем і питань;
- аналізу якості;
- аналізу пулів;
- виправлення пояснень;
- Scripture audit;
- балансування;
- заповнення практики;
- імпорту;
- launcher GUI.

Сильні сторони:

- декілька provider;
- часткова валідація;
- dedupe;
- dry-run у частині команд;
- аналіз якості;
- локальний Ollama режим.

Недоліки:

- немає єдиного registry і CLI;
- повторюється JSON parsing, retry і normalization;
- не всюди є staging;
- можливий прямий запис у active DB;
- немає єдиного job lifecycle;
- немає повноцінного MockProvider;
- provider/model configuration фрагментована;
- AI-контент не має обов’язкового редакторського gate.

## 3.6. Сильні сторони старої версії

Стару версію не потрібно переписувати з нуля. Варто зберегти:

- українську продуктову ідентичність;
- наявні теми та значну частину перевіреного контенту;
- сім рівнів складності;
- режим practice stages;
- mastery і recommendation concepts;
- ранги як декоративну мотивацію;
- вибір косметичної теми;
- Kahoot-подібний груповий формат;
- режим повторення помилок;
- дизайн-токени;
- Telegram інтеграцію;
- server storage abstraction;
- ліниве завантаження сторінок і question chunks;
- legacy route compatibility.

## 3.7. Відомі demo та неповні функції

Не вважати production-ready без окремої перевірки:

- локальний рейтинг із віртуальними гравцями;
- `/study/path`, `/dashboard`, `/leaderboard` та частина daily endpoint;
- in-memory збереження answer/daily events;
- social/challenges/communities, якщо вони працюють через локальний або mock шар;
- admin panel без server-side role gate;
- клієнтські покупки та нагороди;
- GitHub Pages build як повний production deployment;
- AI-команди, що пишуть без review workflow.

## 3.8. Критичні проблеми baseline

### Ідентичність і auth

- сервер може довіряти `x-user-id` без перевіреного Telegram `initData`;
- strict mode не є fail-closed при відсутньому bot token;
- user id не повинен бути клієнтським source of truth.

### Admin і content mutation

- admin route присутній у user app;
- admin API не має повноцінного RBAC;
- mutation може писати прямо в JSON;
- немає versioning, review, atomic publication та rollback trail.

### Server authority

- клієнт розраховує coins, streak, ranks, unlocks і частину progression;
- сервер приймає готовий профіль;
- користувач потенційно може підробити economy/progress payload.

### Якість коду

За останнім baseline:

- frontend build проходить;
- lint має десятки errors і warnings;
- server typecheck не є обов’язковим і має помилки;
- один classification test падає;
- CI не запускає повну матрицю перевірок;
- є порушення React Hooks rules;
- є великі chunks питань.

### Якість контенту

У базі зустрічаються:

- неоднозначні питання;
- неправильні або змішані відповіді;
- неприродна українська;
- слабка відповідність складності;
- потенційно неправильні біблійні посилання;
- legacy fallback, який перетворює невалідний `correctIndex` на `0`;
- передбачуваний патерн першої правильної відповіді у частині старих питань.

---

# 4. Цільова версія Bible Games

## 4.1. Головний цикл користувача

```text
Відкрити застосунок
→ побачити план на сьогодні
→ продовжити активний навчальний план
→ пройти короткий урок
→ відповісти на практичні питання
→ отримати пояснення і біблійний контекст
→ повторити слабкі місця
→ побачити чесний прогрес
→ за бажанням приєднатися до групи або гри
```

## 4.2. Основні продуктові розділи

### Сьогодні

- активна ціль;
- наступний урок;
- заплановане повторення;
- коротка daily session;
- streak без токсичного тиску;
- продовження з останнього місця.

### Навчання

- навчальні плани;
- модулі;
- уроки;
- біблійний текст і контекст;
- пояснення;
- ключові поняття;
- practice;
- review cards;
- mastery.

### Гра

- практика за темами;
- review mistakes;
- «Мільйонер»;
- «Виживання»;
- Kahoot/кімнати;
- тематичні події.

Гра підтримує навчання, а не замінює його.

### Прогрес

- активні плани;
- засвоєні objectives;
- слабкі місця;
- історія сесій;
- streak;
- rank;
- досягнення;
- статистика без фальшивих global data.

### Спільнота

- групи;
- приватні навчальні кола;
- виклики;
- події;
- group leader tools;
- безпечна модерація.

### Профіль і магазин

- особисті налаштування;
- переклад Біблії;
- accessibility;
- косметичні теми та аватари;
- прозорий wallet;
- entitlement history;
- без pay-to-win.

## 4.3. Ролі

- `learner` — звичайний користувач;
- `group_leader` — керівник групи;
- `content_editor` — редагує чернетки;
- `content_reviewer` — перевіряє і схвалює;
- `publisher` — публікує затверджену версію;
- `moderator` — модерує social;
- `admin` — технічне адміністрування;
- `service` — системні jobs.

Ролі зберігаються та перевіряються сервером. Клієнт може лише приховувати UI, але не надавати доступ.

---

# 5. Непорушні правила

## 5.1. Безпека

1. Production auth завжди fail-closed.
2. `userId` походить лише з перевіреного Telegram `initData` або серверної сесії.
3. Header, path param або body не можуть самостійно встановити особу користувача.
4. Кожна mutation має authorization check.
5. Admin/content endpoints мають RBAC.
6. Secrets не потрапляють у frontend, git або logs.
7. Sensitive actions мають audit trail.
8. Rate limits і payload limits застосовуються на сервері.
9. WebSocket identity та room permissions також перевіряються.

## 5.2. Server authority

Сервер сам обчислює та зберігає:

- coins;
- wallet transactions;
- purchases;
- entitlements;
- streak;
- completion;
- rank;
- wisdom;
- mastery updates;
- leaderboard score;
- challenge results;
- reward eligibility.

Клієнт надсилає подію або відповідь, а не остаточний фінансовий чи прогресивний результат.

## 5.3. Контент

1. Published content є versioned і immutable за ревізією.
2. Редагування створює нову draft revision.
3. AI ніколи не пише напряму в published content.
4. Невалідне питання відхиляється або quarantined; воно не отримує `correctIndex=0`.
5. Кожне питання має джерело, objective, difficulty, language status і review status.
6. Біблійні цитати та посилання перевіряються.
7. Теологічно чутливий матеріал має human review.
8. Видалення published content не стирає audit trail.

## 5.4. Якість коду

- не оголошувати роботу завершеною без build, lint, typecheck і tests;
- не вимикати правила lint для приховування проблеми;
- не використовувати `any` без пояснення;
- не залишати demo data в production без явної позначки та feature flag;
- не виконувати великий rewrite разом із функціональною зміною без міграційного плану;
- не дублювати canonical domain logic між frontend, server і scripts;
- не змінювати схему даних без версії, migration і rollback.

## 5.5. UX і доступність

- mobile-first;
- робота у Telegram WebView;
- мінімальні touch target 44×44 CSS px;
- safe-area support;
- keyboard і screen reader support там, де це можливо;
- reduced motion;
- зрозумілі loading, empty, offline та error states;
- не покладатися лише на колір;
- не блокувати основний learning flow через AI або оплату.

## 5.6. Документація

- одна фаза — одна актуальна секція в цьому документі;
- старі плани не отримують нових статусів;
- кожна завершена фаза оновлює baseline, decisions і README;
- `completed` означає пройдені acceptance criteria, а не лише написаний код.

---

# 6. Цільова архітектура

## 6.1. Логічні компоненти

```text
Telegram Mini App / Mobile Web
        │
        ▼
Authenticated API / BFF
        │
        ├── Identity and roles
        ├── Learning and sessions
        ├── Progress and review
        ├── Wallet and entitlements
        ├── Social and groups
        ├── Multiplayer rooms
        ├── Content delivery
        └── Telemetry and moderation

Protected Content Studio
        │
        ├── Drafts and revisions
        ├── Review queues
        ├── Scripture checks
        ├── AI jobs
        └── Controlled publication

Storage
        ├── PostgreSQL authoritative data
        ├── Object/file storage for exports and raw AI artifacts
        ├── Cache
        └── Development JSON adapters only
```

## 6.2. Репозиторій

На поточному етапі зберігається один репозиторій. Рекомендовані логічні межі:

```text
src/
├── app/
├── features/
├── core/
│   ├── learning/
│   ├── content/
│   ├── identity/
│   ├── economy/
│   └── shared/
├── components/
└── data/

server/
├── auth/
├── routes/
├── services/
├── repositories/
├── policies/
├── realtime/
└── jobs/

scripts/
├── ai/
├── content/
├── migrations/
└── audits/

content-studio/
└── створюється лише коли backend RBAC і content workflow готові
```

Не створювати десять npm-пакетів лише заради «чистої» схеми. Фізичний поділ робиться, коли потрібні окремий deployment, security boundary або незалежне versioning.

## 6.3. Середовища

- `development` — локальні fallback дозволені лише явно;
- `test` — deterministic fixtures, MockProvider, isolated DB;
- `staging` — production-like auth, migrations, review, feature flags;
- `production` — fail-closed, no demo fallback, no direct content write.

## 6.4. Feature flags

Feature flag має:

- owner;
- default;
- середовища;
- дату введення;
- критерій видалення;
- telemetry;
- rollback behavior.

Feature flag не замінює authorization і не приховує незахищений endpoint.

---

# 7. Канонічна модель даних

Нижче — концептуальна модель. Точні таблиці та TypeScript types створюються у відповідних фазах.

## Identity

- `UserIdentity` — Telegram ID, verified metadata, status;
- `RoleAssignment` — role, scope, grantedBy, timestamps;
- `UserSession` — server-issued session/claims, expiry;
- `UserSettings` — мова, переклад, accessibility, privacy.

## Learning

- `LearningPlan`;
- `LearningModule`;
- `Lesson`;
- `LessonBlock`;
- `LearningObjective`;
- `Question`;
- `QuestionRevision`;
- `Explanation`;
- `ReviewCard`;
- `ContentReference`;
- `ScriptureReference`;
- `ContentPublication`.

## Progress

- `StudySession`;
- `AnswerEvent`;
- `ObjectiveMastery`;
- `ReviewSchedule`;
- `LessonCompletion`;
- `PracticeTrack`;
- `StreakState`;
- `AchievementGrant`;
- `PlayerRankState`.

## Economy

- `WalletAccount`;
- `WalletTransaction`;
- `CatalogItem`;
- `Purchase`;
- `Entitlement`;
- `RefundOrReversal`.

Баланс не зберігається як довільне клієнтське число. Він або обчислюється з ledger, або оновлюється транзакційно сервером.

## Social і multiplayer

- `Community`;
- `CommunityMembership`;
- `Challenge`;
- `ChallengeParticipation`;
- `Playlist`;
- `GameRoom`;
- `RoomParticipant`;
- `GameSession`;
- `ModerationAction`.

## AI і редактура

- `AiJob`;
- `AiAttempt`;
- `AiArtifact`;
- `ValidationResult`;
- `ReviewTask`;
- `ReviewDecision`;
- `PublicationRecord`;
- `AuditEvent`.

---

# 8. Вимоги до UI/UX

## 8.1. Mobile-first shell

Основна ширина проєкту оптимізується для телефону, а не для планшета. Обов’язково:

- `100dvh`;
- safe areas;
- стабільний bottom navigation;
- sticky actions без перекриття контенту;
- one-thumb reach для основних дій;
- підтримка вузьких екранів;
- відсутність горизонтального scroll;
- коректна робота після Telegram keyboard open/close.

## 8.2. Навігація

Цільова навігація:

- Сьогодні;
- Навчання;
- Гра;
- Прогрес;
- Профіль.

Магазин доступний із профілю або окремої secondary дії, але не витісняє навчання.

## 8.3. Learning screen

Кожен урок має передбачувану структуру:

1. мета;
2. короткий вступ;
3. біблійний уривок або контекст;
4. пояснення;
5. ключові тези;
6. практика;
7. результат;
8. наступний крок.

## 8.4. Стан системи

Для кожного data-driven screen потрібні:

- skeleton/loading;
- empty state;
- first-use state;
- offline state;
- retryable error;
- permission denied;
- content unavailable;
- migration in progress;
- feature unavailable.

## 8.4.1. Motion system

`MOTION_SYSTEM.md` є джерелом правди для animation behavior. Motion не може визначатися випадковими inline transitions у конкретних компонентах. Великі reward, purchase і competitive celebrations запускаються лише authoritative events; усі critical sequences мають reduced-motion fallback.

## 8.5. Дизайн-система

`DESIGN_RULES.md` залишається джерелом правди для токенів і компонентних патернів. Під час фаз редизайну необхідно:

- прибрати дублікати CTA/glass patterns;
- стандартизувати radius, spacing, typography;
- зменшити inline styles;
- створити reusable primitives;
- зберегти окремий arcade-стиль Kahoot як контрольований виняток;
- не створювати нову дизайн-систему паралельно.

---

# 9. Політика якості біблійного контенту

## 9.1. Мінімальні поля питання

Кожне питання повинно мати:

- stable id;
- language;
- type;
- text;
- options або іншу typed answer model;
- correct answer;
- difficulty;
- theme/topic;
- `learningObjectiveId`;
- biblical reference або пояснення відсутності reference;
- short explanation;
- source status;
- validation status;
- review status;
- revision;
- publication state.

## 9.2. Deterministic validation

Автоматично перевіряються:

- непорожній текст;
- валідна кількість options;
- унікальність options;
- коректний answer index;
- відсутність answer leakage;
- дублікати;
- довжина;
- language consistency;
- reference format;
- required objective;
- difficulty enum;
- forbidden fallback;
- schema version.

## 9.3. Редакторська перевірка

Human reviewer перевіряє:

- фактичну правильність;
- контекст уривка;
- природність української;
- однозначність;
- рівень складності;
- конфесійну чутливість;
- коректність пояснення;
- відсутність маніпулятивної або образливої мови.

## 9.4. Теологічна політика

- відділяти прямий текст Біблії від інтерпретації;
- позначати, коли існують основні різні тлумачення;
- не видавати одну конфесійну традицію за єдиний біблійний факт без позначки;
- використовувати нейтральну мову там, де продукт не має затвердженої доктринальної позиції;
- дозволити редактору вказати tradition/context;
- дати користувачеві механізм повідомити про помилку.

---

# 10. Аналітика, privacy та observability

## 10.1. Product analytics

Відстежуються лише події, потрібні для покращення навчання:

- session started/completed;
- lesson started/completed;
- answer submitted;
- review completed;
- content error reported;
- feature failure;
- retention/cohort агрегати.

## 10.2. Не збирати без потреби

- текст приватних повідомлень;
- зайві Telegram profile fields;
- raw AI chat без явної політики;
- конфіденційні дані груп;
- повні payload у production logs.

## 10.3. Engineering observability

Потрібні:

- structured logs;
- request ID;
- user-safe error code;
- server metrics;
- WebSocket room metrics;
- DB migration status;
- AI job metrics;
- content publication metrics;
- alerts на auth failures, mutation errors і data corruption.

---

# 11. Порядок пріоритетів

## P0 — release blockers

- fail-closed auth;
- admin RBAC;
- server-authoritative economy/progress;
- CI gates;
- type safety;
- data migrations and backups;
- content validation;
- removal of unsafe fallbacks.

## P1 — core product

- canonical domain model;
- learning-first navigation;
- Today;
- plans, modules, lessons;
- practice/review/mastery;
- real progress.

## P2 — growth

- Content Studio;
- reviewed AI pipeline;
- real social/groups;
- secure multiplayer;
- catalog, entitlements, payments;
- offline and performance.

## P3 — additional and bonus

- in-app AI assistance;
- advanced church/classroom tools;
- multi-language content;
- public web version;
- author marketplace;
- sophisticated adaptive learning;
- optional integrations;
- richer theme-specific celebration packs;
- advanced optional sound design;
- classroom/presentation motion presets;
- seasonal motion only після performance/accessibility review.

---

# 12. Великий план фаз

# Phase 0 — Canonical Documentation and Verified Baseline

**Статус:** завершується цим об’єднанням документації.

## Мета

Прибрати суперечливі плани, зафіксувати чесний стан застосунку та створити один порядок розвитку.

## Обсяг

- одна головна специфікація;
- один універсальний AI-agent execution prompt;
- точний опис legacy/current state;
- документаційна ієрархія;
- великі фази без мікронумерації;
- чіткі P0/P1/P2/P3;
- старі roadmap позначені historical;
- README описує alpha-статус чесно;
- ADR log узгоджений із новим планом.

## Definition of Done

- немає двох активних phase systems;
- усі основні документи посилаються на цей файл;
- старі `Completed` не сприймаються як статус нового roadmap;
- наступною активною фазою є Phase 1;
- documentation-only зміни не заявляються як виправлення production-коду.

---

# Phase 1 — Production Safety & Engineering Foundation

**Пріоритет:** P0, обов’язкова перед будь-яким великим редизайном або новим AI-функціоналом.

## Мета

Зробити поточний продукт безпечним для реальних даних, створити перевірюваний engineering baseline і прибрати можливість підробити ідентичність, монети, прогрес або admin actions.

## Основні робочі потоки

### Auth та identity

- замінити довіру до `x-user-id` на verified identity;
- Telegram `initData` validation має бути fail-closed у production;
- відокремити dev identity provider;
- створити typed `AuthenticatedRequest`/auth context;
- перевіряти freshness/auth_date;
- використовувати timing-safe comparison;
- заборонити production start без необхідних secrets;
- уніфікувати HTTP і WebSocket identity;
- додати auth integration tests.

### Authorization і admin

- серверні roles і policies;
- `requireRole`/`requirePermission` middleware;
- захист questions admin routes;
- вимкнути або ізолювати user-facing admin bundle;
- audit log для mutation;
- rate limit;
- не покладатися на `VITE_ADMIN_IDS` як security boundary.

### Server-authoritative progression та economy

- клієнт більше не зберігає остаточні coins, rank, streak і unlock result як істину;
- створити server commands/events для answer, completion, purchase;
- сервер обчислює reward;
- wallet ledger;
- idempotency keys;
- транзакції;
- replay protection;
- migration існуючих профілів;
- reconciliation для legacy local data;
- правила, що робити з підозрілими значеннями.

### Authoritative outcome events для UI і motion

Phase 1 повинна створити безпечні server-confirmed triggers для майбутніх анімацій нагород і перемог:

- stable result/event ID для completion, reward, purchase, achievement, level, rank і competitive outcome;
- idempotency і replay protection;
- повторний request, reconnect або retry не створює другий event;
- клієнт не може сам оголосити level up, rank up, entitlement, Kahoot victory або «Мільйонер» victory;
- authoritative response містить final state і delta;
- audit timestamps дозволяють відрізнити нову подію від повторно доставленої.

Phase 1 не реалізує повний візуальний motion, але без цього фундаменту Phase 3/5/6 не мають права запускати фінальні celebrations.

### Engineering gates

Створити стандартні команди:

```text
npm run lint
npm run typecheck
npm run typecheck:server
npm run test
npm run test:integration
npm run smoke-audit
npm run build
npm run check
```

CI має блокувати merge/deploy при помилці.

### Baseline cleanup

- виправити Rules of Hooks;
- виправити lint errors;
- виправити server typecheck;
- додати missing types;
- виправити classification test;
- прибрати silent catches у критичних шляхах;
- документувати лише реальні винятки.

### Data safety

- schema versioning;
- backup до міграції;
- atomic JSON writes для dev adapter;
- production data лише в transactional storage;
- migration journal;
- rollback instructions;
- health/readiness endpoints.

## Міграційна стратегія

Старі local profiles не видаляються. Потрібен одноразовий процес:

1. зчитати legacy profile;
2. нормалізувати;
3. позначити source і migration version;
4. передати серверу migration claim;
5. сервер перевіряє допустимі межі;
6. створює opening balance/migration record;
7. повертає authoritative profile;
8. клієнт зберігає migration marker.

Міграція повинна бути idempotent.

## Acceptance criteria

- підроблений `x-user-id` не дає доступу;
- production не запускається у небезпечній auth-конфігурації;
- admin mutation без ролі повертає 403;
- coins/progress не можна змінити прямим PUT профілю;
- повторна відправка однієї події не подвоює reward;
- всі CI gates зелені;
- server typecheck є частиною CI;
- є integration tests auth, profile, rewards, purchase і admin;
- є backup і rollback test;
- demo endpoint не маскуються під production.

## Out of scope

- повний редизайн;
- новий Content Studio;
- user-facing AI;
- real payments;
- масштабна зміна learning UX.

## Rollback

- feature flag для нового auth/session bridge лише на час контрольованої міграції;
- read-only fallback для legacy profiles;
- DB rollback script;
- не повертатися до client-trusted identity у production.

---

# Phase 2 — Core Architecture & Authoritative Data Platform

**Пріоритет:** P0/P1.

## Мета

Прибрати дублювання доменної логіки, визначити канонічні схеми та створити стабільний backend foundation для всіх наступних функцій.

## Основні робочі потоки

### Domain boundaries

Створити чіткі межі для:

- identity;
- learning;
- content;
- progression;
- economy;
- social;
- realtime;
- analytics.

Frontend може використовувати shared pure types/validation, але не імпортує server implementation.

### Canonical schemas

- versioned `PlayerProfile`;
- versioned content schemas;
- typed API contracts;
- error contracts;
- event contracts;
- schema validation на boundaries;
- generated or shared client types без копіювання вручну.

### Repository consolidation

- одне авторитетне питання/контентне repository API;
- одне topic hierarchy API;
- прибрати суперечливі loaders;
- JSON залишається import/export/dev format, а не production source of truth;
- чітко розділити published content, draft, overrides і exclusions.

### API architecture

- versioned API base;
- service layer;
- repository layer;
- policies;
- validation;
- consistent pagination;
- consistent error envelope;
- request IDs;
- idempotency для mutation;
- OpenAPI або еквівалентний machine-readable contract.

### Typed outcome і motion event contracts

Phase 2 визначає typed contracts, які UI використовує без дублювання бізнес-логіки:

- `ProgressionOutcome`;
- `EconomyOutcome`;
- `GameOutcome`;
- `AchievementGrantEvent`;
- `LevelChangedEvent`;
- `RankChangedEvent`;
- `EntitlementGrantedEvent`;
- stable `eventId`, `occurredAt`, `previousState`, `nextState`, `delta`;
- server-time contract для multiplayer timers;
- persisted consumed-event marker або equivalent deduplication;
- schema для motion intensity preference.

UI може вибирати presentation sequence, але не переобчислює final outcome.

### Deployment

Розділити:

- static frontend deployment;
- API deployment;
- bot deployment;
- background jobs;
- staging environment;
- production migrations.

GitHub Pages може лишитися demo frontend, але не описується як повний production stack.

## Acceptance criteria

- кожен domain має owner folder і dependency rules;
- немає двох різних normalizer для однієї canonical entity;
- profile/content schemas мають version;
- API contracts перевіряються в integration tests;
- production question delivery йде через єдине repository;
- local JSON і SQL adapters проходять однаковий contract test;
- frontend не вирішує security або final rewards;
- migrations відтворюються на чистій і legacy DB;
- documentation map актуальна.

## Out of scope

- великий learning redesign;
- AI generation rewrite;
- social expansion;
- payments.

---

# Phase 3 — Learning-First Product Rebuild

**Пріоритет:** P1.

## Мета

Перетворити набір режимів і тем на зрозумілий навчальний продукт із послідовним шляхом, уроками, практикою, повторенням і чесним прогресом.

## Продуктовий результат

Після фази користувач відкриває застосунок і одразу бачить:

- що робити сьогодні;
- який план він проходить;
- що вже завершено;
- що потрібно повторити;
- чому наступний крок логічний.

## Основні робочі потоки

### Navigation і app shell

- mobile-first navigation: Today, Learn, Play, Progress, Profile;
- збереження legacy deep links через redirects;
- feature flag і поступовий rollout;
- уніфіковані loading/error/offline states;
- app shell не залежить від AI.

### Today

- server-generated daily plan;
- active lesson;
- due review;
- short optional challenge;
- streak state;
- resume;
- completion summary;
- timezone-aware day boundaries.

### Learning plans і lessons

- plan → module → lesson → objective;
- typed lesson blocks;
- Scripture block;
- explanation block;
- term/glossary block;
- reflection block;
- question/practice block;
- summary and next step;
- editorially published content only.

### Practice і review

- practice за objective, topic і difficulty;
- deterministic session creation server-side;
- answer events;
- explanations після відповіді;
- review scheduler;
- mistakes queue;
- spaced repetition із прозорими правилами;
- no infinite random grind.

### Progress

- objective mastery;
- lesson completion;
- plan progress;
- review health;
- streak history;
- rank як secondary motivation;
- achievements із server grants;
- без віртуальних гравців у production ranking.

### Profile і settings

- identity;
- Bible translation;
- accessibility;
- notifications only where platform supports them;
- privacy;
- theme/avatar;
- data export/delete request.

### Rebranding, theme і motion system

Phase 3 обов’язково реалізує активні domain-специфікації:

- [`PHASE_3_REBRANDING_AND_THEME_SYSTEM.md`](./PHASE_3_REBRANDING_AND_THEME_SYSTEM.md);
- [`DESIGN_RULES.md`](./DESIGN_RULES.md);
- [`MOTION_SYSTEM.md`](./MOTION_SYSTEM.md).

До scope входять:

- канонічні motion tokens, easing і distance;
- route/tab/fullscreen transitions;
- sheets і dialogs;
- loading/skeleton/data transitions;
- correct/wrong answer sequences;
- progress і animated numbers;
- lesson/practice completion;
- level up, rank up, achievement і streak;
- theme switching без flash;
- shared celebration layer;
- reduced/minimal motion;
- haptic preference;
- authoritative event deduplication на клієнті;
- visual regression fixtures для critical flows.

Motion має відчуватися як calm premium SaaS interaction design, а не arcade decoration. Повний contract, timings, sequences, fallbacks і phase allocation містяться тільки в `MOTION_SYSTEM.md`.

## Контентна міграція

Наявні теми та питання мапляться до `LearningObjective`. Питання без надійного objective або review status потрапляють у quarantine, а не автоматично в нові lessons.

## Acceptance criteria

- основний flow проходиться одним пальцем на телефоні;
- Today працює без demo data;
- lesson, practice і review мають серверні sessions;
- progress відтворюється після входу на іншому пристрої;
- old routes мають redirects;
- кожен published lesson має objectives і references;
- analytics показує start/completion/error, але не збирає зайвих даних;
- accessibility audit не має критичних блокерів;
- feature flag rollback повертає старий shell без втрати даних.

## Out of scope

- повний AI Content Studio;
- open-ended AI chat;
- real payments;
- масштабний public social feed.

---

# Phase 4 — Content Quality, Reviewed AI Pipeline & Protected Content Studio

**Пріоритет:** P1/P2.

## Мета

Створити безпечний життєвий цикл контенту від чернетки до публікації, очистити legacy question bank і перетворити розрізнені AI-скрипти на керовану систему.

## Основний принцип

```text
AI draft
→ schema validation
→ deterministic checks
→ duplicate/language/reference checks
→ staging
→ human review
→ approval
→ publication
→ immutable revision
→ quality analytics
```

## AI provider layer

Потрібен єдиний contract для Ollama, Gemini, OmniRoute та MockProvider.

Provider:

- генерує text/object/array;
- повертає provider, model, attempt, duration, usage, warnings;
- не знає про publication;
- не пише файли;
- не приховує errors;
- не змінює model непомітно.

Provider-specific env замість одного універсального `AI_MODEL`.

## Job runner

Кожен AI job має:

- id;
- task;
- requester;
- provider/model;
- input hash;
- status;
- attempts;
- retry policy;
- request/token/cost budget;
- cancellation;
- checkpoint/resume;
- raw artifact retention policy;
- logs;
- result reference.

Немає нескінченних retry або необмеженої генерації.

## Unified CLI

Ціль:

```text
npm run ai -- <task> [options]
```

Legacy команди можуть тимчасово бути aliases, але мають:

- deprecation message;
- replacement;
- removal target;
- contract tests;
- golden dataset comparison.

## Staging і publication

Стани:

```text
draft
→ generated
→ validation_failed | ready_for_review
→ changes_requested | approved
→ scheduled | published
→ superseded | archived
```

`repair`, `approve` і `publish` — різні permissioned operations.

## Scripture verification

- normalized references;
- trusted translation/source adapters;
- перевірка, що цитата відповідає reference;
- позначення paraphrase;
- відсутність вигаданого verse;
- human review для контексту та інтерпретації.

## Content Studio

Окремий protected surface із:

- job dashboard;
- staging queue;
- side-by-side diff;
- validation results;
- Scripture preview;
- duplicate warnings;
- review comments;
- approval;
- publication;
- rollback;
- audit history;
- role-based access.

Studio не входить у звичайний user bundle, якщо це створює security або deployment ризик.

## Content Studio motion

Phase 4 використовує restrained productivity motion:

- job state transitions відображають реальний queued/running/review/failed/completed state;
- не показувати fake percentage progress;
- diff, validation і review panels використовують shared UI motion;
- Scripture review surfaces не мають decorative motion;
- AI generation completion не подається як духовна або доктринальна перемога;
- reduced motion і keyboard/focus behavior є обов’язковими.

## Legacy content cleanup

Повний audit:

- schema;
- invalid correct answer;
- duplicate;
- ambiguous wording;
- Ukrainian language;
- difficulty;
- references;
- theological sensitivity;
- first-option bias;
- orphan topics;
- empty pools;
- broken explanations.

Published status надається тільки після проходження policy.

## Acceptance criteria

- AI не може писати в published store;
- `correctIndex` не fallback-иться;
- MockProvider покриває orchestration tests;
- job можна resume/cancel;
- budgets enforced;
- Content Studio захищений RBAC;
- є review і publication audit trail;
- Scripture checks зберігають evidence;
- legacy command matrix має replacement;
- усі published questions мають revision і status;
- можна rollback publication без ручного редагування JSON.

## Out of scope

- відкритий AI-чат для користувача;
- автоматичне духовне консультування;
- AI auto-approve;
- повний перенос у окремий monorepo.

---

# Phase 5 — Social, Groups, Challenges & Multiplayer

**Пріоритет:** P2.

## Мета

Зробити групові та ігрові функції реальними, server-backed і безпечними, не перетворюючи Bible Games на неконтрольовану соціальну мережу.

## Communities

- приватні або invite-based групи;
- roles: owner/leader/member/moderator;
- group progress;
- group learning plan;
- announcements;
- member privacy;
- report/moderation;
- leave/remove/ban lifecycle.

## Challenges

- server-defined rules;
- start/end time;
- eligibility;
- idempotent scoring;
- anti-cheat;
- transparent rewards;
- no client-submitted final score;
- audit.

## Leaderboards

- реальні дані;
- privacy controls;
- сезонність;
- group/local/global scope;
- display name policy;
- no virtual players у production;
- pagination;
- abuse prevention.

## Kahoot/multiplayer

- authenticated host permissions;
- room lifecycle;
- reconnect;
- server-authoritative timer and score;
- playlist ownership;
- safe imports;
- session persistence;
- expiry/cleanup;
- export permissions;
- rate limits;
- WebSocket tests;
- display role separated from host role.

## Social і multiplayer motion

Phase 5 реалізує server-backed motion для:

- community join/leave і member count;
- activity feed;
- friend challenge send/accept;
- leaderboard reordering;
- Kahoot lobby, participant join, countdown, timer, answer reveal, intermediate leaderboard і final podium;
- respectful result state для non-winners;
- reconnect і room recovery без повторного відтворення старої victory animation.

Timer і score синхронізуються із сервером. Final podium/victory запускаються лише для нового authoritative `GameOutcome.eventId`.

## Acceptance criteria

- social data зберігається в production DB;
- user не може редагувати чужу group membership;
- challenge score не підробляється payload;
- room host permissions перевіряються сервером;
- reconnect не дублює participant;
- session survives permitted server restart scenario або має чесний recovery state;
- moderation actions auditable;
- demo data видалено або чітко feature-flagged тільки для development.

---

# Phase 6 — Economy, Shop, Entitlements & Monetization

**Пріоритет:** P2.

## Мета

Перебудувати магазин на прозору server-authoritative систему та підготувати безпечну монетизацію без pay-to-win.

## Economy

- wallet ledger;
- transaction types;
- reward sources;
- idempotency;
- reversals;
- audit;
- balance integrity;
- abuse limits.

## Catalog

- versioned catalog items;
- cosmetic themes;
- avatars;
- badges;
- bundles;
- availability windows;
- price history;
- localization;
- asset validation.

## Purchases і entitlements

- purchase command;
- transactional balance update;
- entitlement grant;
- duplicate purchase protection;
- restore purchases;
- refunds/reversals;
- ownership check server-side.

## Shop, entitlement і theme motion

Phase 6 реалізує:

- store entrance і catalog states;
- theme preview;
- flash-free apply owned theme;
- purchase pending;
- server-confirmed balance update;
- entitlement reveal;
- insufficient balance;
- restore/refund/reversal states;
- Stars/payment success лише після verified callback і reconciliation.

Заборонена оптимістична purchase celebration. Duplicate purchase/result не може запускати motion двічі.

## Real payments

Додаються лише після стабільної внутрішньої economy:

- provider abstraction;
- signed callbacks/webhooks;
- payment state machine;
- reconciliation;
- fraud handling;
- receipts;
- legal/privacy review;
- sandbox/staging tests.

## Product rules

- навчальні плани, правильні відповіді й essential progress не продаються;
- покупки переважно cosmetic або optional supportive features;
- no loot boxes без окремого юридичного й етичного рішення;
- зрозумілі ціни;
- немає штучного покарання за відсутність оплати.

## Acceptance criteria

- client не може сам grant entitlement;
- ledger сходиться;
- duplicate request не списує двічі;
- purchase атомарна;
- restore працює на іншому пристрої;
- catalog versioned;
- payment callback перевіряється;
- shop доступний і безпечний для неповнолітніх;
- є rollback/disable switch.

---

# Phase 7 — Performance, Offline, Accessibility & Public Release

**Пріоритет:** P2, release preparation.

## Мета

Підготувати застосунок до стабільного масового використання на мобільних пристроях і слабких мережах.

## Performance

- не доставляти користувачу багатомегабайтні question banks;
- server session повертає тільки потрібний набір;
- route/data code splitting;
- cache headers;
- bundle budgets;
- image/font optimization;
- memory profiling у Telegram WebView;
- WebSocket resource limits;
- DB indexes і query profiling.

## Offline

- app shell cache;
- IndexedDB для дозволеного published content;
- version/hash;
- offline lesson state;
- queued answer events лише якщо вони можуть бути безпечно reconciled;
- конфліктна політика;
- чесне повідомлення, що multiplayer/payment недоступні offline.

## Accessibility

- WCAG-oriented audit;
- contrast;
- touch targets;
- focus;
- keyboard;
- screen reader labels;
- reduced motion;
- text scaling;
- semantic headings;
- no color-only meaning.

## Reliability

- error monitoring;
- SLO для API;
- readiness/liveness;
- backup restore drill;
- migration rehearsal;
- incident runbook;
- rate limit tuning;
- data retention;
- security review;
- dependency audit.

## Motion performance і accessibility hardening

Phase 7 завершує motion як production capability:

- frame profiling у Telegram Android/iOS;
- low-end device tier;
- reduced/minimal motion audit;
- performance budgets;
- no CLS;
- interruption, background restore і reconnect tests;
- timer/listener cleanup;
- ARIA announcements і focus restoration;
- visual regression для major sequences;
- no duplicate celebration;
- particle/bundle budgets.

Release candidate не проходить Phase 7, якщо core UI зрозумілий лише з animation або великі sequences блокують navigation.

## Rollout

- internal testing;
- closed alpha;
- controlled beta;
- staged production percentage;
- feature flags;
- rollback;
- changelog;
- user feedback;
- content error reporting.

## Acceptance criteria

- mobile performance budgets виконані;
- initial screen не залежить від великих question chunks;
- core learning session працює на повільній мережі;
- backup restore перевірений;
- немає critical accessibility issues;
- security checklist пройдений;
- staging migration повторює production plan;
- monitoring і incident owner визначені;
- README містить точну deployment модель;
- release candidate проходить повний `npm run check` та E2E smoke.

---

# Phase 8 — Expansion and Bonus Capabilities

**Пріоритет:** P3. Жоден пункт цієї фази не блокує якісний основний продукт.

## Можливі напрями

### In-app AI learning assistance

Після стабільного published content retrieval:

- «Поясни мою помилку»;
- «Покажи контекст»;
- «Поясни простіше»;
- «Створи коротке повторення»;
- citations;
- AI label;
- feedback/report;
- privacy;
- rate/cost limits;
- deterministic fallback;
- retrieval лише з approved content.

### Church/classroom tools

- lesson presenter mode;
- group assignments;
- teacher dashboard;
- attendance optional;
- printable/exportable materials;
- scheduled group plans;
- classroom Kahoot controls.

### Content ecosystem

- invited authors;
- templates;
- content packs;
- translation workflow;
- versioned public collections;
- approval marketplace без автоматичної публікації.

### Internationalization

- UI locale framework;
- content language variants;
- translation review;
- locale-specific references;
- не змішувати language fallback усередині одного lesson.

### Advanced learning

- adaptive sequencing;
- misconception tags;
- prerequisite graph;
- personalized review;
- cohort insights;
- experiments із ethical guardrails.

### Platforms

- повноцінний standalone web;
- PWA;
- optional desktop wrapper;
- external integrations;
- API для approved partners.

Кожен bonus-напрям отримує окреме рішення лише після виміряної потреби. Не будувати його лише тому, що він технічно цікавий.

---

# 13. Залежності між фазами

```text
Phase 0 Documentation
        ↓
Phase 1 Safety/Foundation
        ↓
Phase 2 Architecture/Data
        ↓
Phase 3 Learning Product
        ↓
Phase 4 Content/AI/Studio
        ├───────────────┐
        ↓               ↓
Phase 5 Social       Phase 6 Economy
        └───────┬───────┘
                ↓
Phase 7 Performance/Release
                ↓
Phase 8 Bonus Expansion
```

Phase 5 і Phase 6 можуть частково виконуватися паралельно після стабілізації Phase 3/4, але не повинні обходити Phase 1/2.

---

# 14. Глобальний Definition of Done

Функція або фаза не є завершеною, поки немає:

1. Product behavior, описаного через acceptance criteria.
2. Реалізації без прихованого demo fallback.
3. Security review відповідно до ризику.
4. Data migration і rollback, якщо змінюється schema.
5. Unit tests для domain logic.
6. Integration tests для API/storage/auth.
7. E2E або smoke test для основного user flow.
8. Зелених lint/typecheck/build.
9. Accessibility і mobile перевірки для UI.
10. Logs/metrics для критичного server flow.
11. Оновленої документації.
12. Feature flag removal plan, якщо flag введений.
13. Перевірки, що legacy users не втратили дані.
14. Чіткого списку відомих обмежень.
15. Commit/PR, який не змішує випадковий unrelated scope.

Слова «готово», «completed», «production-ready» або «fully implemented» заборонено використовувати лише на основі наявності файлів чи успішного build.

---

# 15. Протокол виконання кожної фази

## Перед змінами

- прочитати цей документ;
- перевірити актуальний `main`;
- запустити baseline checks;
- зафіксувати pre-existing failures;
- знайти всі relevant files, routes, schemas, env, tests;
- перевірити реальний runtime path, а не лише документацію;
- скласти dependency і migration map;
- визначити feature flags і rollback;
- не починати implementation, якщо немає способу перевірити критичний результат.

## Під час змін

- працювати в окремій branch;
- робити атомарні коміти за змістом;
- не змішувати масовий formatting із логічною зміною;
- підтримувати backward compatibility або явну migration;
- не залишати тимчасовий insecure fallback;
- додавати tests разом із поведінкою;
- не копіювати domain logic;
- оновлювати docs у тій самій фазі.

## Перед завершенням

- повторити повну check matrix;
- протестувати negative cases;
- протестувати migration на legacy fixture;
- перевірити rollback;
- перевірити mobile UI;
- переглянути diff на secrets і accidental data;
- оновити phase status лише після evidence;
- сформувати чесний final report із невирішеними ризиками.

---

# 16. Правила покращення промтів для AI-агентів

Якісний промт повинен:

- називати конкретну фазу;
- вказувати canonical specification;
- вимагати read-only audit перед змінами;
- описувати product outcome, а не лише список файлів;
- містити non-negotiable security/data/content rules;
- вимагати migration, feature flag і rollback;
- вимагати test matrix;
- забороняти заявляти completion без evidence;
- дозволяти агенту виправити необхідні суміжні проблеми лише в межах фази;
- забороняти scope creep і speculative architecture;
- вимагати оновити documentation і ADR;
- вимагати human decision тільки там, де справді існують різні продуктові або доктринальні варіанти.

Промт не повинен:

- просити «просто реалізувати все» без baseline;
- фіксувати вигадані назви файлів як факт;
- вимагати monorepo без аналізу;
- дозволяти вимкнути lint/tests;
- дозволяти AI auto-publish;
- поєднувати security rewrite, редизайн і новий режим в один неперевірюваний коміт;
- вимірювати прогрес кількістю створених файлів.

Готовий універсальний master prompt міститься в `AI_AGENT_MASTER_EXECUTION_PROMPT.md`.

---

# 17. Активна черга після цієї документації

Порядок не змінюється без ADR:

1. Phase 1: auth fail-closed.
2. Phase 1: admin RBAC і content mutation protection.
3. Phase 1: server-authoritative profile, reward, wallet і progression.
4. Phase 1: CI/typecheck/tests і baseline cleanup.
5. Phase 1: migrations, backups, rollback.
6. Phase 2: canonical schemas і domain boundaries.
7. Phase 2: repositories/API consolidation.
8. Phase 3: learning-first product.
9. Phase 4: content quality, AI pipeline і Studio.
10. Phase 5/6: social та economy.
11. Phase 7: release hardening.
12. Phase 8: bonus.

Новий екран, AI-функція або game mode не може перескочити P0 лише тому, що його швидше або цікавіше реалізувати.

---

# 18. Політика підтримки цієї специфікації

- Версія змінюється при суттєвій зміні scope або порядку фаз.
- Кожна зміна phase order потребує запису в `DECISIONS.md`.
- Після завершення фази оновлюються: status, verified commit, acceptance evidence, known limitations.
- Не створювати новий master roadmap поруч із цим файлом.
- Детальні domain-документи можуть існувати, але вони мають посилатися на відповідну фазу тут і не створювати власну нумерацію фаз.
- Історичні документи не видаляються без потреби, але чітко позначаються як historical.

---

# 19. Фінальний продуктовий критерій

Bible Games можна вважати зрілим продуктом не тоді, коли в ньому багато режимів, а коли:

- користувач безпечно входить;
- його дані не можна підробити або випадково втратити;
- навчальний шлях зрозумілий;
- біблійний контент перевірений;
- progress чесний;
- AI допомагає, але не публікує істину самостійно;
- застосунок швидкий на телефоні;
- групові та платні функції не шкодять основній місії;
- команда може змінювати систему без страху зламати старих користувачів.

Це і є головний напрям усіх наступних робіт.