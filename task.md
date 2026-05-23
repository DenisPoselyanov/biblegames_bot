# Task Board — Study 2.0 Modernization

## A. Phase 1 — Foundation (Completed)

- [x] **A1. Розширити доменну модель**
  - [x] Додати `MasteryState`, `StudyPath`, `StudySession`, `AnswerEvent`, `DailyTask`, `LearningInsight`.
  - [x] Розширити `PlayerProfile`: `streakDays`, `lastActiveAt`, `studyMastery`.
  - [x] Додати Question v2 поля: `explanationShort`, `explanationDeep`, `sourceQuality`.

- [x] **A2. Learning engine + telemetry**
  - [x] Реалізувати update streak / mastery.
  - [x] Реалізувати daily tasks + learning KPI.
  - [x] Додати telemetry: `session_start`, `question_answered`, `quiz_completed`.

- [x] **A3. Repository layer**
  - [x] Додати `playerRepo`.
  - [x] Додати `studyRepo`.
  - [x] Додати `statsRepo`.

- [x] **A4. Інтеграція в UI**
  - [x] Підключити answer events з `Quiz`.
  - [x] Оновити `Home` на реальні daily/streak/KPI.
  - [x] Оновити сумісність типів у `GlobalStats`.

- [x] **A5. Backend-ready API contracts (mock)**
  - [x] `GET /study/path`
  - [x] `POST /study/answer`
  - [x] `POST /daily/complete`
  - [x] `GET /dashboard`
  - [x] `GET /leaderboard`

## B. Phase 1 — Remaining (Completed)

- [x] **B1. Реальна БД + синхронізація**
  - [x] Додати persistent backend storage (server JSON DB).
  - [x] Реалізувати синхронізацію профілю між пристроями.
  - [x] Реалізувати offline->online merge без втрати streak/очок.
  - [x] Поширити синхронізацію на `studyRepo` і `statsRepo`.
  - [x] Додати auth + user-scoped доступ у backend.
  - [x] Підготувати server storage adapter (json/sql) без зміни API.
  - [x] Підготувати SQL schema (`server/db/schema.sql`) для Postgres/Supabase.
  - [x] Реалізувати `sqlStore` (підключення реального DB клієнта).
  - [x] Додати storage health-check endpoint (`/health/storage`).
  - [x] Прогнати smoke-тест у режимі `STORAGE_PROVIDER=sql` з реальним `DATABASE_URL`.

- [x] **B2. Повний telemetry coverage**
  - [x] Додати `study_path_advanced`.
  - [x] Додати `daily_task_completed`.
  - [x] Підготувати експорт/відправку подій у backend.

## C. Phase 2 — Adaptive Study (Completed)

- [x] **C1. StudyHub & Routing**
  - [x] Створити `src/pages/StudyHub.tsx` з вибором режимів.
  - [x] Додати роутинг для `StudyHub` в `App.tsx`.

- [x] **C2. Оновлення Quiz Engine (`Quiz.tsx`)**
  - [x] Підтримка параметра `mode` (`practice`, `review`, `sprint`).
  - [x] `Sprint`: Додати таймер зверху екрана (5 хвилин) + логіка завершення гри.
  - [x] `Review mistakes`: Логіка вибірки всіх питань з помилками.

- [x] **C3. Візуалізація та Insights**
  - [x] GitHub-like Mastery Heatmap у `Profile.tsx`.
  - [x] Функція рекомендації тем (персональний шлях) у `StudyHub`.
  - [x] Нові achievements по mastery/streak.

## D. Phase 3 — Content + Social (Completed)

- [x] **D1. AI question quality pipeline**
  - [x] Validation schema + quarantine.
  - [x] Duplicate detection (2 дублікати в карантині).
  - [x] Ambiguity scoring.
  - [x] Difficulty calibration.

- [x] **D2. Пули питань**
  - [x] Розділити на `study pool` та `game pool`.

- [x] **D3. Соціальні функції**
  - [x] Kahoot custom playlists.
  - [x] Async friend challenges.
  - [x] Group/community leaderboards.

## E. Phase 4 — UI Integration (Completed)

- [x] **E1–E5. UI для плейлистів, викликів, спільнот, соціального профілю, адмін-панелі**

## F. Phase 5 — Administration (Completed)

- [x] **F1. Управління якістю через адмін-панель**
  - [x] Інтеграція валідатора + карантину
  - [x] Звіти з фільтрацією за severity
  - [x] Статистика пулів

## G. Phase 6 — Difficulty System + Topics (Completed)

- [x] **G1. Нова система складності (7 рівнів)**
  - [x] `Difficulty` тип + константи + оновлення всіх файлів

- [x] **G2. AI генерація ієрархії тем**
  - [x] `TopicNode`, `TopicHierarchyMap`, 15 JSON, `topicDbLoader.ts`

- [x] **G3. Оновлення адмін-панелі**
  - [x] Вкладки Теми / Запитання, дерево, аналіз

- [x] **G4. AI сортування питань**
  - [x] `sortQuestionsByCategory.ts`, `question-categories.json`

## H. Phase 7 — Practice Mode 2.0 з ієрархією (Completed)

- [x] **H1–H13. 18 нових/оновлених файлів**
  - Типи, адаптивні тести, рекомендації, TopicMap, Quiz, Themes, StudyHub, Profile, ThemeDetail, MicroTraining, App.tsx, PlayerContext

## I. Phase 8 — Profile Redesign (Completed)

## J. Phase 9 — Home Dashboard Redesign (Completed)

## K. Phase 10 — PlayHub Redesign (Completed)

## L. Phase 11 — Shop Redesign (Completed)

## M. Phase 12 — UI Polish & Kahoot Redesign (Completed)

## N. Phase 13 — Категорії та мультирівневий drill-down (2026-05-23)

**Статус: Completed**

- [x] **N1. Типи та дані**
  - [x] `Category` інтерфейс в `src/types/index.ts`
  - [x] `aggregateThemeIds` на `TopicNode`
  - [x] `categoryId` на `Theme`
  - [x] `src/data/categories.ts` — 2 категорії + хелпери
  - [x] Всі 15 тем з `categoryId`

- [x] **N2. Ієрархії груп**
  - [x] `data/topics-db/ot-group.json` — "Старий Завіт"
  - [x] `data/topics-db/nt-group.json` — "Новий Завіт"
  - [x] Агрегатний вузол у кожній групі з іконкою батька
  - [x] Агрегатні вузли в кожній підтемі (перший дочірній, іконка батька)

- [x] **N3. topicDbLoader**
  - [x] Повертає тільки 2 групи
  - [x] `allHierarchiesCache` — модульний кеш (миттєве повторне завантаження)
  - [x] Індивідуальні теми через `loadTopicHierarchy` (backward compat)

- [x] **N4. Themes.tsx — мультирівневий drill-down**
  - [x] `activeNodeId` + `nodeHistory` замість плоского `groupId`
  - [x] 2 картки груп на корені
  - [x] Рекурсивний drill-down для підтем з дітьми
  - [x] Агрегатна картка з золотим акцентом (`#a67c00`)
  - [x] `flatMap` divider після агрегатного вузла
  - [x] Кнопка "Назад" / "До загальних тем"
  - [x] Показ кількості підтем
  - [x] Без кількості питань на агрегатній картці

- [x] **N5. ThemeDetail.tsx**
  - [x] Агрегатний вузол: підрахунок питань по складностях
  - [x] Іконка в hero (повернуто)
  - [x] Прибрано іконку з heroChip text
  - [x] levelMeta: чистий текст без 📝🪙
  - [x] Дерево ієрархії з Mastery

- [x] **N6. Quiz.tsx — виправлення**
  - [x] `backToThemeUrl` включає `nodeId` (фікс "Тематику не знайдено")
  - [x] Прибрано `profile.studyMastery` з deps (фікс перезавантаження питань)
  - [x] Всі навігаційні посилання через `backToThemeUrl`

- [x] **N7. DIFFICULTY_LABELS — прибрано емодзі**
  - [x] `src/types/index.ts` — лейбли без емодзі
  - [x] `Profile.tsx` — повний текст замість `[0]`
  - [x] `Survival.tsx` — прибрано regex-стріп

- [x] **N8. Layout — глобальні виправлення**
  - [x] `scrollbar-gutter: stable` на `<html>` у `index.css`
  - [x] Навбар: без `backdrop-filter`, `max-width: 480px`, `bottom: -1px`
  - [x] Прибрано `border-radius` з навбара

- [x] **N9. Суміжні компоненти**
  - [x] `ThemeCard.tsx` — прапорці `_isAggregateNode` та ін.
  - [x] `AdminPanel.tsx` — фільтр категорій
  - [x] `MicroTraining.tsx` — виключення агрегатних вузлів
  - [x] `scripts/lib/themes-config.mjs` — поле `category`
  - [x] `tsc --noEmit` — чисто

## O. Phase 14 — AI Scripts Modernization: Групи, ієрархія, якість тем (2026-05-23)

**Статус: Completed**

- [x] **O1. GROUPS + topic traversal helpers (`scripts/lib/themes-config.mjs`)**
  - [x] `GROUPS` — масив із 2 груп (`ot-group`, `nt-group`) з `themeIds`
  - [x] `loadTopicHierarchy(fileId)` — завантаження JSON теми/групи
  - [x] `flattenTopicNodes(root)` — рекурсивне розгортання дерева в плоский масив
  - [x] `findNodeById(root, id)` — пошук вузла в дереві за ID
  - [x] `buildNodePath(root, id)` — шлях від кореня до вузла
  - [x] `getTopicContext(root, id)` — шлях + опис для AI контексту
  - [x] `getAllTopicNodes()` — плоский масив вузлів з усіх файлів

- [x] **O2. Генерація топіків з групами (`scripts/generate-topics-ai.mjs`)**
  - [x] `--group <groupId>` — генерація для групи (об'єднує всі `themeIds`)
  - [x] Промпт: 3-рівнева ієрархія (Завіт > Тема > Підтема)
  - [x] Вузли тепер мають `themeId` та `aggregateThemeIds`
  - [x] `--theme` все ще працює (зворотна сумісність)

- [x] **O3. Генерація питань з контекстом теми (`scripts/generate-questions-ai.mjs`)**
  - [x] `--topic <nodeId>` — генерація для підтеми будь-якої глибини
  - [x] `--group <groupId>` — генерація для всіх тем у групі
  - [x] Промпт використовує шлях вузла + опис для контексту
  - [x] Питання містять `topicPath` та `topicNodeId`

- [x] **O4. Нормалізація питань (`scripts/lib/question-db.mjs`)**
  - [x] `normalizeAiQuestion()` зберігає `topicPath` та `topicNodeId`

- [x] **O5. Аналіз якості тем (`scripts/analyze-topics.mjs`) — НОВИЙ**
  - [x] CLI-скрипт: breadth (0-100), uniqueness, description quality, ID validity, logical consistency
  - [x] Вивід: `data/topics-quality-report.json`
  - [x] npm script: `npm run analyze-topics`

- [x] **O6. Ollama Launcher — 4-та картка "Якість тем"**
  - [x] Синхронний аналіз (без потоку — немає проковтування помилок)
  - [x] Сортування за breadth score
  - [x] Фільтри: за файлом + діапазон балів
  - [x] Рендер через `Text` widget (миттєво, без 300+ Frame)
  - [x] Клік → редактор: іконка, назва, опис
  - [x] Збереження назад у JSON
  - [x] Кольорове маркування: 🔴 <30, 🟡 30-60, 🟢 >=60

## P. Phase 15 — AI Scripts: Подальші покращення (2026-05-24+)

**Статус: Pending**

- [ ] **P1. Оновлення AI_SETUP.md** — документація нових флагів, лаунчера

- [ ] **P2. Тематична генерація питань** — використовувати `--topic` для генерації по підтемі

- [ ] **P3. Автоматичний аналіз** — запуск `npm run analyze-topics` після генерації тем

- [ ] **P4. Візуалізація в лаунчері** — графік розподілу якості тем

- [ ] **P5. Експорт CSV** — кнопка для звіту аналізу
