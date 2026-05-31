# Bible Game Modernization Plan (Study 2.0)

## Мета
Перейти від локальної вікторини до навчальної платформи з персоналізованим циклом навчання, retention-механіками, backend-ready архітектурою та контрольованою якістю контенту.

---

## Phase 1 (0-8 тижнів) — Foundation + retention
**Статус: Completed**

Вже зроблено:
- Розширені типи домену: `MasteryState`, `StudyPath`, `StudySession`, `AnswerEvent`, `DailyTask`, `LearningInsight`.
- Розширений `PlayerProfile`: `streakDays`, `lastActiveAt`, `studyMastery`.
- Додані поля Question v2: `explanationShort`, `explanationDeep`, `sourceQuality`.
- Доданий telemetry layer (`session_start`, `question_answered`, `quiz_completed`, `study_path_advanced`, `daily_task_completed`).
- Доданий telemetry export у backend:
  - фронтенд flush черги подій (`localStorage` queue + retry)
  - серверний endpoint `POST /telemetry/:userId` з user-scope перевіркою
- Доданий repository layer: `playerRepo`, `studyRepo`, `statsRepo`.
- Доданий learning engine: streak, mastery update, daily tasks, KPI.
- Інтегровано в `PlayerContext`, `Home`, `Quiz`.
- Додані backend-ready API контракти на сервері:
  - `GET /study/path`
  - `POST /study/answer`
  - `POST /daily/complete`
  - `GET /dashboard`
  - `GET /leaderboard`
  - `GET /profile/:userId`
  - `PUT /profile/:userId`
- Додана sync-модель профілю через `playerRepo`:
  - local fallback
  - remote mode через `VITE_API_BASE_URL`
  - offline->online merge профілю (без втрати очок/streak/mastery)
- Підготовлена server adapter-архітектура storage:
  - `server/db/store.ts` (контракт)
  - `server/db/jsonStore.ts` (поточний provider)
  - `server/db/sqlStore.ts` (реалізований PostgreSQL provider через `DATABASE_URL`)
  - `STORAGE_PROVIDER=json|sql` switch
- Підготовлена SQL схема для міграції: `server/db/schema.sql`
- Доданий storage health endpoint: `GET /health/storage`

Залишилось у Phase 1:
- Проведено інтеграційний прогін з реальним Postgres/Supabase. Етап закрито!

---

## Phase 2 (2-4 міс) — StudySession + adaptive learning
**Статус: Completed**

---

## Phase 3 (4-6+ міс) — Content quality + social
**Статус: Completed**

---

## Phase 4 — UI Integration
**Статус: Completed**

---

## Phase 5 — Administration
**Статус: Completed**

---

## Phase 6 — Розширення системи складності + ієрархія тем (2026-05-22)
**Статус: Completed**

### 6.1. Нова система рівнів складності
- Замінено 5 рівнів на 7: `baby`(👶), `child`(🧒), `youth`(🧑), `student`(🎓), `preacher`(📖), `teacher`(👨‍🏫), `theologian`(⛪)
- Оновлено `Difficulty` тип + всі константи (`DIFFICULTIES`, `DIFFICULTY_LABELS`, `DIFFICULTY_POINTS`, `DIFFICULTY_ORDER`) в `src/types/index.ts`
- Оновлено всі існуючі питання зі старими ID (`beginner→baby`, `easy→child`, `medium→youth`, `hard→student`, `expert→preacher`)
- Оновлено `data/question-db/*.json` AI-питання (difficulty + ID)

### 6.2. Оновлення AI функцій
- `scripts/lib/themes-config.mjs` — масив DIFFICULTIES на 7 рівнів
- `scripts/generate-questions-ai.mjs` — `buildPrompt` для 7 рівнів
- `src/lib/questionQuality.ts` — `calibrateDifficulty`, `validateDifficulty`, `getDifficultyLevel`, `getDifficultyByLevel`
- `src/lib/questionPools.ts` — POOL_CONFIGS, mode rules, difficultyOrder
- `src/pages/AdminPanel.tsx` — `difficultyColor` для 7 рівнів
- `bot/index.mjs` — валідація DIFFICULTIES
- `src/data/kahootQuestions.ts` — default difficulty
- `src/data/questions.ts` — `getQuestionDistribution`

### 6.3. AI функція генерації ієрархії тем
- Новий тип `TopicNode` (рекурсивний, `children: TopicNode[]`) в `src/types/index.ts`
- Нова директорія `data/topics-db/` з 15 JSON файлами (по одному на тему)
- `scripts/generate-topics-ai.mjs` — генерація підтем через Ollama
- `src/data/topicDbLoader.ts` — завантажувач для фронтенду
- npm script: `npm run generate-topics`

### 6.4. Оновлення адмін-панелі
- Розділено на вкладки "🏷️ Теми" та "❓ Запитання"
- Теми: дерево з розкриттям, аналіз кількості питань
- Запитання: підвкладки (Карантин, Звіти, Пули)

### 6.5. AI сортування існуючих питань
- `scripts/sortQuestionsByCategory.ts` — призначення підтем для кожного питання
- Маппінг старих рівнів на нові
- Результат: `data/question-categories.json`
- npm script: `npm run sort-questions`

---

## Phase 7 — Practice Mode 2.0 з ієрархічною системою тем (2026-05-23)
**Статус: Completed**

(18 нових/оновлених файлів, 9 нових бібліотек, адаптивні тести, мікротренування, рекомендації, карта прогресу тощо)

---

## Phase 7 — UI/UX Design System & Polish (2026-05)
**Статус: Completed**

---

## Phase 8 — Profile Redesign & UX Polish (2026-05)
**Статус: Completed**

---

## Phase 9 — Home Dashboard Redesign (2026-05)
**Статус: Completed**

---

## Phase 10 — PlayHub Redesign (2026-05)
**Статус: Completed**

---

## Phase 11 — Shop Redesign (2026-05)
**Статус: Completed**

---

## Phase 12 — UI Polish & Kahoot Redesign (2026-05-23)
**Статус: Completed**

---

## Phase 13 — Категорії та мультирівневий drill-down (2026-05-23)
**Статус: Completed**

### 13.1. Типи та дані
- ✅ Додано `Category` інтерфейс в `src/types/index.ts`
- ✅ Додано `aggregateThemeIds` поле до `TopicNode` для агрегатних вузлів
- ✅ Додано `categoryId` до інтерфейсу `Theme`
- ✅ Створено `src/data/categories.ts` з 2 категоріями: `old-testament`, `new-testament`
- ✅ Додано функції: `getCategoryById()`, `getThemeIdsByCategory()`
- ✅ Всі 15 тем у `src/data/themes.ts` отримали `categoryId`

### 13.2. Ієрархії груп
- ✅ Створено `data/topics-db/ot-group.json` — коренева група "Старий Завіт" з усіма темами
- ✅ Створено `data/topics-db/nt-group.json` — коренева група "Новий Завіт" з усіма темами
- ✅ Кожна група має агрегатний вузол "Усі питання з цієї теми" з тією ж іконкою що й батьківська група
- ✅ Кожна підтема з дітьми має свій агрегатний вузол як перший дочірній елемент (з іконкою батька)
- ✅ Жоден підрозділ не називається однаково з батьківською групою

### 13.3. topicDbLoader
- ✅ `loadAllTopicHierarchies()` повертає тільки `ot-group` та `nt-group`
- ✅ Індивідуальні теми досі завантажуються через `loadTopicHierarchy(themeId)`
- ✅ Додано `allHierarchiesCache` — модульний кеш для миттєвого повторного завантаження
- ✅ Кеш усуває flash loading при навігації назад з Themes до StudyHub

### 13.4. Themes.tsx — мультирівневий drill-down
- ✅ Повністю переписано: замість плоского `groupId` → стек `activeNodeId` + `nodeHistory`
- ✅ На корені — 2 великі картки "Старий Завіт" / "Новий Завіт"
- ✅ Клік по групі відкриває її дітей як сітку карток
- ✅ Клік по підтемі з дітьми → заглиблення (рекурсивний drill-down)
- ✅ Клік по листовому вузлу → перехід до ThemeDetail
- ✅ Агрегатний вузол "Усі питання з цієї теми" з золотим акцентом (`#a67c00`)
- ✅ Мінімалістичний divider `1px solid var(--border)` після агрегатного вузла
- ✅ Кнопка "Назад" з історією навігації (перший рівень → "До загальних тем")
- ✅ Показується кількість підтем для звичайних вузлів
- ✅ Питання кешуються, немає flash при навігації

### 13.5. ThemeDetail.tsx
- ✅ Агрегатний вузол: показує кількість питань на рівень складності
- ✅ Іконка теми в hero-секції (велика, зверху)
- ✅ Прибрано дублювання іконки з тексту heroChip
- ✅ Прибрано емодзі 📝🪙 з levelMeta — чистий текст "N питань · N очок"
- ✅ Дерево ієрархії (колапсне) з Mastery

### 13.6. Quiz.tsx
- ✅ `backToThemeUrl` включає `nodeId` коли присутній (фікс "Тематику не знайдено")
- ✅ Прибрано `profile.studyMastery` з залежностей ефекту завантаження питань (фікс перезавантаження)
- ✅ Всі навігаційні посилання (close, empty state, finish) використовують `backToThemeUrl`

### 13.7. DIFFICULTY_LABELS — прибрано емодзі
- ✅ В `src/types/index.ts` — лейбли без емодзі (дублювались з `.levelEmoji`)
- ✅ `src/pages/Profile.tsx` — показує повний текст лейбла замість першого символу
- ✅ `src/pages/play/Survival.tsx` — прибрано regex-стріп емодзі

### 13.8. Layout — глобальні виправлення
- ✅ `src/index.css`: `scrollbar-gutter: stable` на `<html>` — контент не смикається
- ✅ `src/components/Layout.module.css`:
  - Прибрано `backdrop-filter: blur()` з навбара (артефакти на краях)
  - Навбар `max-width: 480px` як у контенту
  - `border-radius` прибрано
  - `bottom: -1px` для усунення субпіксельних зазорів

### 13.9. Суміжні компоненти
- ✅ `ThemeCard.tsx` — обробляє `_isAggregateNode`, `_isThemeNode`, `_isTopicNode`
- ✅ `AdminPanel.tsx` — імпортує `CATEGORIES`, кнопки фільтрації категорій
- ✅ `MicroTraining.tsx` — виключає агрегатні вузли з кандидатів
- ✅ `scripts/lib/themes-config.mjs` — додано поле `category`
- ✅ `tsc --noEmit` проходить без помилок

---

## Bug Fixes & Maintenance (2026-05-21)

### Critical React Error Fix
**Проблема:** `Uncaught ReferenceError: Cannot access 'finished' before initialization` в Quiz.tsx:100
**Причина:** Temporal dead zone error — `finished` використовувалася в useEffect до оголошення через useState
**Виправлення:** Переміщено useState для `finished` вище useEffect

### Backend / API Fixes
- Запущено сервер на `http://localhost:3001`
- CORS для `localhost:5173` та `127.0.0.1:5173`
- `/profile/:userId` та `/stats/:userId` повертають дефолтні значення замість 404

---

## Phase 14 — AI Scripts Modernization: Групи, ієрархія, якість тем (2026-05-23)
**Статус: Completed**

### 14.1. GROUPS + topic traversal helpers (`scripts/lib/themes-config.mjs`)
- ✅ Додано `GROUPS` — масив із 2 груп: `ot-group` (Старий Завіт) та `nt-group` (Новий Завіт), кожна з `themeIds`
- ✅ Додано `loadTopicHierarchy(fileId)` — завантажує JSON теми/групи з `data/topics-db/`
- ✅ Додано `flattenTopicNodes(root)` — рекурсивно розгортає дерево в плоский масив вузлів
- ✅ Додано `findNodeById(root, id)` — пошук вузла в дереві за ID
- ✅ Додано `buildNodePath(root, id)` — будує шлях від кореня до вузла (масив `{id, title}`)
- ✅ Додано `getTopicContext(root, id)` — повертає шлях + опис вузла для AI контексту
- ✅ Додано `getAllTopicNodes()` — завантажує всі файли й повертає плоский масив вузлів

### 14.2. Генерація топіків з групами (`scripts/generate-topics-ai.mjs`)
- ✅ Додано `--group <groupId>` — генерація для групи (об'єднує всі `themeIds` групи)
- ✅ Промпт оновлено до 3-рівневої ієрархії: Завіт > Тема > Підтема
- ✅ Кожен вузол тепер генерує `themeId` (яка коренева тема) та `aggregateThemeIds` (для агрегатних вузлів)
- ✅ Зворотна сумісність: `--theme` все ще працює

### 14.3. Генерація питань з контекстом теми (`scripts/generate-questions-ai.mjs`)
- ✅ Додано `--topic <nodeId>` — генерація для конкретної підтеми (будь-якої глибини)
- ✅ Додано `--group <groupId>` — генерація для всіх тем у групі
- ✅ Покращено промпт: використовує шлях вузла + опис для контексту
- ✅ Питання тепер містять `topicPath` (масив шляху) та `topicNodeId` (ID вузла)

### 14.4. Нормалізація питань (`scripts/lib/question-db.mjs`)
- ✅ `normalizeAiQuestion()` тепер зберігає поля `topicPath` та `topicNodeId`

### 14.5. Аналіз якості тем (`scripts/analyze-topics.mjs`) — НОВИЙ
- ✅ CLI-скрипт для оцінки якості кожної підтеми в ієрархії
- ✅ **Breadth (ширина, 0-100):** оцінка на основі довжини опису, кількості дітей, нащадків, глибини, ключових слів
- ✅ **Uniqueness (унікальність):** виявлення дублікатів назв між файлами
- ✅ **Опис:** перевірка наявності та якості `description`
- ✅ **ID валідація:** перевірка на дублікати ID у межах файлу та між файлами
- ✅ **Логічна консистентність:** перевірка чи всі `themeId` посилаються на існуючі теми
- ✅ Вивід: `data/topics-quality-report.json`
- ✅ npm script: `npm run analyze-topics`

### 14.6. Ollama Launcher — 4-та картка "Якість тем" (`scripts/ollama_launcher.py`)
- ✅ Додано картку "🔍 Якість тем" з аналізом та редактором тем
- ✅ Аналіз запускається синхронно (без потоку — швидко, <1с, немає проковтування помилок)
- ✅ Результати сортуються за breadth score (найгірші перші)
- ✅ Фільтри: за файлом (all / ot-group / nt-group / індивідуальні теми) та діапазоном балів
- ✅ Список тем рендериться в `Text` widget (замість 300+ Frame-карток) — миттєво
- ✅ Клік по темі відкриває редактор: зміна іконки, назви, опису
- ✅ Збереження змін назад у відповідний JSON-файл
- ✅ Кольорове маркування: 🔴 <30 вузькі, 🟡 30-60 середні, 🟢 >=60 широкі

---

## Phase 15 — AI Scripts: Ollama Launcher v2 та інтеграція інструментів (2026-05-24+)
**Статус: Done**

### 15.1. Ollama Launcher v2
- ✅ Вкладки: Питання / Теми / Якість тем / Налаштування
- ✅ `npm run ai-launcher`, cwd = корінь проєкту, статус Ollama
- ✅ Інтеграція: analyze-quality, analyze-pools, analyze-topics, sort-questions, scripture:audit, merge-topics-db, ai-topic-edit (add-children)
- ✅ `balance-questions.mjs` — вирівнювання кількості питань між підтемами
- ✅ Якість тем з `data/topics-quality-report.json` (без дубльованої Python-логіки)

### 15.2. Документація
- ✅ Оновлено `scripts/AI_SETUP.md`, `TOOLS.md`

---

## Технічна архітектура

### Frontend
- React + TypeScript + Router + Context.
- Context працює через repository layer, не напряму через storage.
- Local mode залишається як fallback.

### Data layer
- Репозиторії:
  - `playerRepo` — профіль, streak, achievements
  - `studyRepo` — answers history, study path, sessions
  - `statsRepo` — глобальна статистика та рейтинги
- Підтримка двох джерел:
  - local storage (поточний)
  - remote backend (з persistence через `server/.data/db.json`)
- User-scoped API доступ:
  - фронтенд відправляє `x-user-id`
  - бекенд перевіряє scope (`:userId === x-user-id`)

### Backend contracts (ціль)
- `GET /study/path`
- `POST /study/answer`
- `POST /daily/complete`
- `GET /dashboard`
- `GET /leaderboard`
- `GET /study/answers/:userId`
- `PUT /study/answers/:userId`
- `GET /stats/:userId`
- `PUT /stats/:userId`
- `POST /telemetry/:userId`
