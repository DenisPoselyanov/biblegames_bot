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

- [ ] **B1. Реальна БД + синхронізація**
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
  - [x] Duplicate detection.
  - [x] Ambiguity score.
  - [x] Difficulty calibration.

- [x] **D2. Пули питань**
  - [x] Розділити на `study pool` та `game pool`.
  - [x] Налаштувати окремі правила відбору.

- [x] **D3. Соціальні функції**
  - [x] Kahoot custom playlists з підтем.
  - [x] Async friend challenges.
  - [x] Group/community leaderboards (opt-in).

## E. Phase 4 — UI Integration (Next Steps)

- [ ] **E1. UI для плейлистів**
  - [ ] Екран створення/редагування плейлистів
  - [ ] Екран перегляду публічних плейлистів
  - [ ] Інтеграція в Kahoot режим

- [ ] **E2. UI для викликів друзів**
  - [ ] Екран списку викликів (отримані/надіслані)
  - [ ] Екран прийняття виклику
  - [ ] Історія та статистика

- [ ] **E3. UI для спільнот**
  - [ ] Екран створення/пошуку спільнот
  - [ ] Екран спільноти з лідербордом
  - [ ] Управління учасниками

- [ ] **E4. Соціальний профіль**
  - [ ] Додати друзів/блокування в профіль
  - [ ] Налаштування приватності
  - [ ] Відображення соціальної статистики
