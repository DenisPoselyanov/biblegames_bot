# Task Board — Study 2.0 Modernization

## A. Phase 1 — Foundation (In Progress)

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

## B. Phase 1 — Remaining (Next)

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
  - [x] `Review mistakes`: Логіка вибірки **всіх** питань, у яких раніше були зроблені помилки.

- [x] **C3. Візуалізація та Insights**
  - [x] GitHub-like Mastery Heatmap у `Profile.tsx`.
  - [x] Функція рекомендації тем (персональний шлях) у `StudyHub`.
  - [x] Нові achievements по mastery/streak.

## D. Phase 3 — Content + Social (Completed)

- [x] **D1. AI question quality pipeline**
  - [x] Validation schema + quarantine.
  - [x] Duplicate detection — знайдено 2 дублікати: `new-testament-medium-5` ↔ `revelation-easy-2` (в карантині).
  - [x] Ambiguity scoring — найвищий `old-testament-medium-2` (45/100).
  - [x] Difficulty calibration.

- [x] **D2. Пули питань**
  - [x] Розділити на `study pool` та `game pool`.
  - [x] Налаштувати окремі правила відбору.

- [x] **D3. Соціальні функції**
  - [x] Kahoot custom playlists з підтем.
  - [x] Async friend challenges.
  - [x] Group/community leaderboards (opt-in).

## 🔧 Code Review — AI аналіз та адмін-панель

- [x] **D4. Додати AI-пошук дублікатів через Jaccard similarity**
  - Алгоритм: нормалізація тексту → Jaccard index слів → порівняння з порогом 0.85
  - Додатково: перевірка варіантів відповідей
- [x] **D5. Розширити аналіз на AI-питання з `data/question-db/*.json`**
  - Скрипти читають JSON через `fs.readdirSync` + `JSON.parse`
- [x] **D6. Синхронізувати карантин між QuestionQualityValidator та QuestionPoolManager**
  - Поля `qualityScore`, `ambiguityScore`, `duplicateIds`, `quarantined` синхронізуються
  - `questionPools.ts` перевіряє `questionQuarantineManager.getQuarantineInfo()`
- [x] **D7. Створити адмін-панель (`/admin`) з 3 вкладками:**
  - 🚧 Карантин (перегляд + схвалення/відхилення/видалення)
  - 📋 Звіти якості (фільтр за severity)
  - 🗂️ Пули питань (статистика study/game/overlap)

## E. Phase 4 — UI Integration (Completed)

- [x] **E1. UI для плейлистів**
  - [x] Екран створення/редагування плейлистів (KahootPlaylistEditor.tsx)
  - [x] Екран перегляду публічних плейлистів (KahootPlaylists.tsx)
  - [x] Інтеграція в Kahoot режим (KahootCreate.tsx + KahootPlaylistDetails.tsx)

- [x] **E2. UI для викликів друзів**
  - [x] Екран списку викликів (отримані/надіслані)
  - [x] Екран прийняття виклику
  - [x] Історія та статистика

- [x] **E3. UI для спільнот**
  - [x] Екран створення/пошуку спільнот
  - [x] Екран спільноти з лідербордом
  - [x] Управління учасниками

- [x] **E4. Соціальний профіль**
  - [x] Додати друзів/блокування в профіль
  - [x] Налаштування приватності
  - [x] Відображення соціальної статистики

## E. Phase 4 — UI Integration (Continued)

- [x] **E5. Адмін-панель якості контенту**
  - [x] Сторінка `AdminPanel.tsx` + маршрут `/admin` (3 вкладки)
  - [x] 🚧 Карантин: список, approve fix, reject, release
  - [x] 📋 Звіти якості: quality scores, issues, filter by severity
  - [x] 🗂️ Пули питань: study/game stats, by theme & difficulty

## F. Phase 5 — Administration (Completed)

- [x] **F1. Управління якістю через адмін-панель**
  - [x] Інтеграція `questionQualityValidator` + `questionQuarantineManager`
  - [x] Звіти з фільтрацією за severity
  - [x] Статистика пулів у реальному часі
