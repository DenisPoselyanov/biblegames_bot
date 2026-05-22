# Bible Game Modernization Plan (Study 2.0)

## Мета
Перейти від локальної вікторини до навчальної платформи з персоналізованим циклом навчання, retention-механіками, backend-ready архітектурою та контрольованою якістю контенту.

## Статус по фазах

### Phase 1 (0-8 тижнів) — Foundation + retention
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

## Bug Fixes & Maintenance (2026-05-21)

### Critical React Error Fix
**Проблема:** `Uncaught ReferenceError: Cannot access 'finished' before initialization` в Quiz.tsx:100
**Причина:** Змінна `finished` використовувалася в useEffect (рядок 91) до її оголошення через useState (рядок 106) - temporal dead zone error
**Виправлення:** Переміщено оголошення `const [finished, setFinished] = useState(false)` на рядок 33, перед useEffect, що його використовує
**Файл:** `src/pages/Quiz.tsx`

### Backend Server Setup & Configuration
**Проблема:** `ERR_CONNECTION_REFUSED` для всіх API ендпоінтів (`/profile/guest`, `/stats/guest`, `/study/answers/guest`, `/telemetry/guest`)
**Причина:** Бекенд сервер не був запущений на порті 3001
**Виправлення:**
- Запущено бекенд сервер через `npm run server`
- Сервер успішно стартував на `http://localhost:3001`
- Налаштовано CORS для `http://localhost:5173` та `http://127.0.0.1:5173`
**Перевірено:** Health endpoint повертає `{"ok":true}`, storage health - `{"ok":true,"provider":"json"}`

### API 404 Error Resolution
**Проблема:** `GET http://localhost:3001/profile/guest 404 (Not Found)` та аналогічні для stats
**Причина:** Нові користувачі (наприклад, "guest") не мають записів в базі даних, сервер повертав 404
**Виправлення в `server/index.ts`:**
- Змінено `/stats/:userId` GET endpoint: замість 404 повертає дефолтну статистику `{"themes":{},"lastUpdated":"..."}`
- Змінено `/profile/:userId` GET endpoint: замість 404 повертає дефолтний профіль з порожніми полями
- `/study/answers/:userId` вже повертав порожній масив `[]` для нових користувачів
**Результат:** Фронтенд тепер отримує коректні дефолтні значення, помилки 404 зникли

### External Tracking Errors
**Спостереження:** Помилки `ERR_BLOCKED_BY_CLIENT` та `ERR_NAME_NOT_RESOLVED` для `gtmpx.com` та `zmstat.com`
**Статус:** Зовнішні трекінгові сервіри, заблоковані браузером/ad-blocker
**Вплив на гру:** Немає - це не пов'язано з функціональністю біблійної гри

### Phase 2 (2-4 міс) — StudySession + adaptive learning
**Статус: Completed**

## Open Questions
> [!IMPORTANT]
> 1. **Sprint Mode UI**: Де має відображатися таймер? (Зверху по центру чи біля рахунку?)
> 2. **Review Mistakes**: Скільки питань давати на "роботу над помилками"? Фіксовано 7 чи скільки є в базі помилок?
> 3. **Heatmap**: Чи хочеш ти графік-сітку (як контриб'юції на GitHub) для візуалізації Mastery, чи прості кольорові бейджі (Червоний/Жовтий/Зелений)?

## Proposed Changes

### Frontend - Study Hub
#### [NEW] [StudyHub.tsx](file:///e:/Portfolio/Denis%20Poselyanov/Telegram/%D0%91%D1%96%D0%B1%D0%BB%D1%96%D0%B9%D0%BD%D0%B0%20%D0%B3%D1%80%D0%B0/bible-game/src/pages/StudyHub.tsx)
- Створити новий екран (хаб) для режимів навчання (`Practice`, `Review mistakes`, `Sprint`).
- Додати відображення рекомендацій (напр. "Вам варто повторити тему X").

### Frontend - Quiz Engine
#### [MODIFY] [Quiz.tsx](file:///e:/Portfolio/Denis%20Poselyanov/Telegram/%D0%91%D1%96%D0%B1%D0%BB%D1%96%D0%B9%D0%BD%D0%B0%20%D0%B3%D1%80%D0%B0/bible-game/src/pages/Quiz.tsx)
- Додати підтримку `mode` (`practice`, `review`, `sprint`).
- Якщо `mode === 'sprint'`, додати 5-хвилинний таймер. Завершувати гру по закінченню часу.
- Якщо `mode === 'review'`, фільтрувати пул питань так, щоб показувати лише ті, де користувач робив помилки (з `errorTags`).

### Frontend - Profile & Insights
#### [MODIFY] [Profile.tsx](file:///e:/Portfolio/Denis%20Poselyanov/Telegram/%D0%91%D1%96%D0%B1%D0%BB%D1%96%D0%B9%D0%BD%D0%B0%20%D0%B3%D1%80%D0%B0/bible-game/src/pages/Profile.tsx)
- Додати відмальовку Mastery Heatmap (візуалізація рівня знань по підтемах).
- Додати відображення нових ачівок по mastery та review.

### Backend Contracts / Logic
#### [MODIFY] [learning.ts](file:///e:/Portfolio/Denis%20Poselyanov/Telegram/%D0%91%D1%96%D0%B1%D0%BB%D1%96%D0%B9%D0%BD%D0%B0%20%D0%B3%D1%80%D0%B0/bible-game/src/lib/learning.ts)
- Реалізувати алгоритм генерації `StudyPath` на основі слабких місць.
- Оновити `buildLearningInsight` для більш детальних рекомендацій.

## Verification Plan
### Automated Tests
- Type checking (`tsc --noEmit`).
- Перевірка логіки таймера Sprint режиму.

### Manual Verification
- Зіграти гру в `Sprint` режимі і дочекатися закінчення таймера.
- Зробити кілька помилок у `Practice`, а потім зайти в `Review mistakes` і перевірити, чи підтягнулися саме ці питання.
- Перевірити `Profile`, чи правильно працює Mastery Heatmap.
---

### Phase 3 (4-6+ міс) — Content quality + social
**Статус: Completed**

- Контент-пайплайн AI-питань:
  - ✅ validation schema + quarantine
  - ✅ duplicate detection
    - Виявлено 2 дублікати: `new-testament-medium-5` ↔ `revelation-easy-2`
    - Обидва поміщено в карантин (`qualityScore: 80`)
  - ✅ ambiguity scoring
    - Найвищий ambiguityScore: `old-testament-medium-2` (45), `miracles-hard-1` (25)
  - ✅ difficulty calibration
- Розділення пулів питань:
  - ✅ `game pool` (225 питань)
  - ✅ `study pool` (184 питання)
  - 41 питання виключено з study pool (відсутні біблійні посилання)
- Соціальні функції:
  - ✅ Kahoot custom playlists з підтем
  - ✅ friend async challenges
  - ✅ group/community leaderboards (opt-in)

**Створені модулі:**
- `src/lib/questionQuality.ts` - валідація якості питань
- `src/lib/questionQuarantine.ts` - система карантину
- `src/lib/questionPools.ts` - управління пулами питань
- `src/lib/playlists.ts` - Kahoot плейлисти
- `src/lib/friendChallenges.ts` - виклики друзів
- `src/lib/communities.ts` - спільноти та лідерборди

**Скрипти для аналізу:**
- `npm run analyze-quality` - аналіз якості питань (вбудовані + AI JSON)
- `npm run analyze-pools` - аналіз пулів питань
- `npm run test-social` - тест соціальних функцій

**Алгоритм AI-пошуку дублікатів:**
- Косинусна схожість через Jaccard index (перетин слів / об'єднання слів)
- Пороги: `0.85` — автокарантин, `0.75` — ручний перегляд
- Додатково: порівняння варіантів відповідей (якщо текст схожий > 60% + варіанти збігаються > 85%)

### Phase 4 (UI Integration)
**Статус: Completed**

**Ціль:** Інтегрувати backend функціонал Phase 3 в UI для повноцінної користувацької взаємодії.

#### E1. UI для плейлистів
- Екран створення/редагування плейлистів (`src/pages/PlaylistEditor.tsx`)
- Екран перегляду публічних плейлистів (`src/pages/PlaylistBrowser.tsx`)
- Інтеграція вибору плейлистів в Kahoot режим
- Компоненти: `PlaylistCard`, `QuestionSelector`

#### E2. UI для викликів друзів
- Екран списку викликів (`src/pages/Challenges.tsx`)
- Екран прийняття виклику (`src/pages/ChallengeAccept.tsx`)
- Модальне вікно результатів виклику
- Історія та статистика викликів
- Компоненти: `ChallengeCard`, `ChallengeResult`

#### E3. UI для спільнот
- Екран створення/пошуку спільнот (`src/pages/Communities.tsx`)
- Екран спільноти з лідербордом (`src/pages/CommunityView.tsx`)
- Управління учасниками та запрошеннями
- Компоненти: `CommunityCard`, `LeaderboardTable`, `MemberList`

#### E4. Соціальний профіль
- Оновити `src/pages/Profile.tsx` з соціальними функціями
- Секція друзів (додати/видалити/блокувати)
- Налаштування приватності
- Відображення соціальної статистики
- Історія викликів та участь у спільнотах

#### E5. Адмін-панель якості контенту
- Екран для перегляду питань в карантині
- Інструменти для виправлення проблемних питань
- Звіти про якість контенту
- Керування пулами питань

**Пріоритети (виконано):**
1. ✅ E1 - UI плейлистів
2. ✅ E2 - UI викликів друзів
3. ✅ E4 - Соціальний профіль
4. ✅ E3 - UI спільнот
5. E5 - Адмін-панель (в роботі)

### Phase 5 (Administration) — Completed
**Статус: Completed**

**Ціль:** Надати інструменти для контролю якості контенту та управління пулами питань.

#### F1. Адмін-панель якості контенту ✅
- ✅ Екран перегляду питань в карантині (`questionQuarantineManager`)
- ✅ Інструменти виправлення: approve fix, reject, release from quarantine
- ✅ Звіти про якість контенту: quality scores, issues breakdown, filter by severity
- ✅ Керування пулами: статистика пулів (study/game), розбивка за темами та складністю
- ✅ Сторінка `AdminPanel.tsx` + маршрут `/admin` + CSS модуль
- ✅ TypeScript typecheck пройдено

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

## Acceptance критерії
- Home показує реальні daily tasks, streak, learning KPI.
- Після кожної відповіді оновлюється answer history і mastery підтеми.
- Study path генерується за слабкими місцями користувача.
- Збірка фронтенду стабільна, без type помилок.
- Сервер має робочі backend-ready ендпоінти (мінімум mock).
