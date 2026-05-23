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

### Phase 6 — Розширення системи складності + ієрархія тем (2026-05-22)

**Статус: Completed**

#### 6.1. Нова система рівнів складності
- Замінено 5 рівнів на 7: `baby`(👶), `child`(🧒), `youth`(🧑), `student`(🎓), `preacher`(📖), `teacher`(👨‍🏫), `theologian`(⛪)
- Оновлено `Difficulty` тип + всі константи (`DIFFICULTIES`, `DIFFICULTY_LABELS`, `DIFFICULTY_POINTS`, `DIFFICULTY_ORDER`) в `src/types/index.ts`
- Оновлено всі існуючі питання зі старими ID (`beginner→baby`, `easy→child`, `medium→youth`, `hard→student`, `expert→preacher`)
- Оновлено `data/question-db/*.json` AI-питання (difficulty + ID)

#### 6.2. Оновлення AI функцій
- `scripts/lib/themes-config.mjs` — масив DIFFICULTIES на 7 рівнів
- `scripts/generate-questions-ai.mjs` — `buildPrompt` для 7 рівнів
- `src/lib/questionQuality.ts` — `calibrateDifficulty`, `validateDifficulty`, `getDifficultyLevel`, `getDifficultyByLevel`
- `src/lib/questionPools.ts` — POOL_CONFIGS, mode rules, difficultyOrder
- `src/pages/AdminPanel.tsx` — `difficultyColor` для 7 рівнів
- `bot/index.mjs` — валідація DIFFICULTIES
- `src/data/kahootQuestions.ts` — default difficulty
- `src/data/questions.ts` — `getQuestionDistribution`

#### 6.3. AI функція генерації ієрархії тем
- Новий тип `TopicNode` (рекурсивний, `children: TopicNode[]`) в `src/types/index.ts`
- Нова директорія `data/topics-db/` з 15 JSON файлами (по одному на тему)
- `scripts/generate-topics-ai.mjs` — генерація підтем через Ollama
- `src/data/topicDbLoader.ts` — завантажувач для фронтенду
- npm script: `npm run generate-topics`

#### 6.4. Оновлення адмін-панелі
- Розділено на вкладки "🏷️ Теми" та "❓ Запитання"
- Теми: дерево з розкриттям, аналіз кількості питань
- Запитання: підвкладки (Карантин, Звіти, Пули)

#### 6.5. AI сортування існуючих питань
- `scripts/sortQuestionsByCategory.ts` — призначення підтем для кожного питання
- Маппінг старих рівнів на нові
- Результат: `data/question-categories.json`
- npm script: `npm run sort-questions`

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

### Phase 7 — UI/UX Design System & Polish (2026-05)

**Статус: Completed**

**Мета:** Перевести інтерфейс на професійний рівень: дизайн-система, мікро-взаємодії, доступність, обробка станів.

#### 7.1. Розширення дизайн-системи
- Додати повні CSS-токени: `--space-{xs,sm,md,lg,xl}`, `--radius-{sm,md,lg,full}`, `--shadow-{sm,md,lg}`, `--ease-*`
- Створити типографічну шкалу (h1-h6, body, caption)
- Розширити палітру: `--success`, `--danger`, `--warning`, `--info` кольори

#### 7.2. SVG іконки замість emoji
- Створити набір SVG-іконок (24×24, stroke-based) замість emoji в навігації, картках, кнопках
- Утиліта `Icon` компонент з підтримкою `size`, `color`, `strokeWidth`

#### 7.3. Система мікро-анімацій та переходів
- Додати page transition (slide/zoom між сторінками)
- Додати loading spinner та skeleton-компоненти
- Додати анімований перехід при відповідях (плавне підсвічування correct/wrong)
- Додати toast/snackbar компонент замість `alert()`

#### 7.4. Система станів UI
- Створити `ToastProvider` + `useToast` hook (заміна `alert()`)
- Створити `EmptyState` компонент (ілюстрація + текст + action)
- Створити `ErrorBoundary` для кожного page-компонента
- Додати `Skeleton` компоненти для всіх списків та карток

#### 7.5. Доступність (a11y)
- Додати aria-атрибути до всіх інтерактивних елементів
- Додати focus ring стилі
- Додати focus trap в модальні вікна (ConfirmModal, ExplanationModal)
- Додати `role="alert"` для помилок

#### 7.6. Покращення Telegram інтеграції
- Синхронізація теми з Telegram (`tg.themeParams`)
- Використання `MainButton` Telegram де можливо
- Розширена підтримка haptic (impact medium/heavy)

#### 7.7. Рефакторинг CSS modules
- Прибрати дублювання стилів між модулями
- Уніфікувати картки, кнопки, заголовки через CSS токени
- Додати `@media (prefers-reduced-motion)` повагу

---

### Етап 1: Перебудова UX (Користувацький досвід та Навігація)

#### 7.8. Розвантаження профілю
- **Налаштування:** Перенести блок чекбоксів ("Показувати профіль", "Показувати статистику" тощо) під іконку шестірні ⚙️ у верхній правий кут `Profile.tsx`. Відкривати як модальне вікно.
- **Досягнення:** Замість довгого списку карток — горизонтальна карусель з бейджами. Або винести в окрему вкладку/модальне вікно "Мої нагороди".

#### 7.9. Оптимізація головного екрана
- **Біблійний вірш:** Зробити картку компактнішою, інтегрувати як змінний текст у верхній частині header'а.
- **CTA "Продовжити дослідження":** Зробити візуальним центром екрана — крупніше, контрастніше, з анімацією.

#### 7.10. Спрощення соціальної взаємодії
- **Додавання друзів:** Замість поля вводу ID — кнопка "Запросити друга", яка відкриває нативне вікно Telegram для вибору контакту або генерує реферальне посилання.

---

### Етап 2: Оновлення UI (Візуальний стиль)

#### 7.11. Поглиблення візуальної глибини
- **Картки:** Додати більше негативного простору між блоками. Використовувати `border-radius: 16px-20px`.
- **Glassmorphism:** Легкий градієнт або ефект напівпрозорого скла для карток замість суцільної заливки.
- **Типографіка:** Чітка ієрархія — великі заголовки, середні назви карток, дрібний приглушений опис.
- **Золотий текст:** Додати `text-shadow` або зробити яскравішим, щоб не зливався з темним фоном.

#### 7.12. Ілюстрації для режимів гри
- Замінити малі іконки на `PlayHub` (`PlayHub.tsx`) на великі ілюстрації (3D або деталізовані графічні елементи на половину картки) для кожного режиму: Дослідження, Мільйонер, Виживання, Kahoot.

---

### Етап 3: Гейміфікація та Залучення (Engagement)

#### 7.13. Прогрес-бари та візуалізація
- **Щоденні завдання:** Додати кольорові прогрес-бари замість тексту "0/2", "0/10" на `Home.tsx`.
- **Аватари:** Відображати активний аватар на головному екрані, у лідерборді, в лобі мультиплеєру — підвищити цінність косметичних предметів.

---

### Етап 4: Інтеграція Telegram Mini Apps

#### 7.14. Нативна інтеграція Telegram
- **MainButton:** Використовувати `Telegram.WebApp.MainButton` для головних дій (режим гри, "Продовжити дослідження") замість кастомних кнопок.
- **Haptic Feedback:** Додати тактильний відгук при покупці в магазині, при виконанні щоденного завдання.
- **Свайпи та жести:** Дозволити закриття модальних вікон свайпом вниз. Додати свайп "назад" для повернення на попередній екран.

---

### Phase 8 — Profile Redesign & UX Polish (2026-05)

**Статус: Completed**

**Мета:** Переробити сторінку профілю: візуальна ієрархія, компактність, гейміфікація, мікроінтеракції.

#### 8.1. Візуальна ієрархія та Header
- Сховати кнопку «Адмін-панель» в налаштування (під ⚙️).
- Виводити куплений користувачем аватар у header замість стандартного.
- ID користувача зробити менш помітним (показувати по тапу на ім'я).

#### 8.2. Компактність та навігація
- Редизайн магазину тем — горизонтальна swipeable карусель замість вертикального списку.
- Об'єднати «Виклики друзів» та «Спільноти» в один блок із вкладками (Tabs) або 50/50.

#### 8.3. Гейміфікація прогресу
- Редизайн «Рівня знань (Mastery)» — теплова карта (heatmap) з градієнтом заповнення, світіння при завершенні.
- Замінити текст "0%" на круговий прогрес-бар (circular chart) для Winrate.

#### 8.4. Стиль та мікроінтеракції
- Додати inner border та м'яку тінь для карток (3D-ефект).
- Haptic feedback на ключові дії: покупки, відкриття налаштувань, перемикання вкладок.
- Scale-down анімація (0.95) при тапі на всі клікабельні картки.

#### 8.5. Мікро-корекції
- Виправлено margin підзаголовка магазину тем (Profile).
- Оновлено стиль кнопки «Загальний Рейтинг» — золотий градієнт + світіння.

---

### Phase 9 — Home Dashboard Redesign (2026-05)

**Статус: Completed**

**Мета:** Перетворити головний екран на динамічний дашборд з преміальною карткою вірша, ігровою статистикою та гейміфікованими завданнями.

#### 9.1. Преміальна картка вірша
- Glassmorphic overlay з золотим внутрішнім світінням (box-shadow).
- Курсивний елегантний шрифт для тексту вірша.

#### 9.2. Блок статистики
- Сітка 2×2 квадратних карток (монети, рівні, стрік, теми) замість 4 колонок.
- Однаковий розмір, чистий мінімалістичний вигляд.

#### 9.3. Щоденні завдання
- Лінійні прогрес-бари (вже реалізовано).
- При 100% — зелений/золотий бордер картки, галочка замість цифр.

#### 9.4. Learning KPI
- Відсотки точності — кольорові badge (зелений/бірюзовий фон) замість звичайного тексту.
- Освоєні підтеми — бейдж з акцентним кольором.

#### 9.5. Точкові мікро-корекції (UI)
- Зменшено шрифт джерела вірша, додано `.verseRef` (opacity 0.55).
- Заголовки секцій — звичайний регістр (без uppercase), колір `--gold-light`.
- Іконки статистики збільшено (кружки 56px, іконки 30px).
- Додано `text-shadow` для цифр статистики (0 2px 4px rgba(0,0,0,0.45)).
- Прогрес-бари: яскравіша підкладка (rgba(255,255,255,0.15)) + світло-золоте заповнення.
- CTA кнопка: градієнт 180° gold-light → gold → gold-dark.
- Картки: додано `box-shadow` для відділення від фону.
- Фікс теми Eden Garden: CTA не використовує `--gold` (може бути зеленим).

---

### Phase 10 — PlayHub (Режими гри) Redesign (2026-05)

**Статус: Completed**

**Мета:** Перетворити екран вибору режимів гри на ігрове лобі з візуальною ієрархією, акцентними ілюстраціями та преміальними badge.

#### 10.1. Великі ілюстрації справа
- Кожна картка — горизонтальний `flex` з кольоровою градієнтною панеллю справа.
- Іконка 64px (featured: 96px) з `drop-shadow`, центрована в панелі.
- Кольори: книга — золото, діамант — фіолет, щит — червоний, блискавка — бірюза.

#### 10.2. Ієрархія режимів
- «Дослідження» — featured card: `min-height: 200px` (проти 120px).
- Золотий `border-color` + `box-shadow` для візуального акценту.
- Збільшені `padding` body (+16px по вертикалі).

#### 10.3. Pill-badges
- `NEW` — градієнт `#8b5cf6 → #06b6d4` (фіолет-бірюза) + світіння.
- `Мультиплеєр` — градієнт `#f97316 → #eab308` (помаранч-жовтий).
- `border-radius: 20px`, `font-weight: 800`.

#### 10.4. Мікро-корекції
- Видалено стрілки `→`.
- Замінено іконку «Мільйонер» з `$` на `diamond` (огранований діамант в SVG).
- Текст опису — `rgba(255,255,255,0.7)` замість `var(--text-muted)`.
- Іконки центровано посередині `cardArtBg`.
- `cardArtFeatured` ширина = 110px (однакова з іншими).

---

### Phase 11 — Shop (Крамниця Аватарів) Redesign (2026-05)

**Статус: Completed**

**Мета:** Перетворити крамницю аватарів на преміальну вітрину з компактним віджетом балансу, оновленими картками та кнопками.

#### 11.1. Редизайн Header
- Прибрано підзаголовок «Купуй аватари...»
- Компактний `balancePill` праворуч від заголовка: золота пігулка з іконкою монети.

#### 11.2. Картки аватарів
- Скляний фон (`--glass-bg` + `backdrop-filter`).
- Розділено на `avatarVisual` (100px) + `avatarInfo` (flex center).
- `Emoji` з `drop-shadow`, центрований у верхній частині.
- `border-top` між візуальною та інформаційною зонами.

#### 11.3. Кнопки та стани
- `btnBuy` — градієнт gold-light → gold → gold-dark (як CTA).
- `btnApply` — прозора з border.
- `badgeActive («Екіпіровано») ` — outline border, pill.
- Всі `border-radius: 999px`.
- Однакові `padding` та `font-size` для badgeActive/btnApply (без зсуву).

#### 11.4. Мікро-корекції
- Шрифт кількості монет — `--font-sans`.
- Відступ секції від хедера — `margin-top: 1.5rem`.
- Центрування контенту всередині картки.

### Phase 12 — UI Polish & Kahoot Redesign (2026-05-23)

**Status: Completed**

**Мета:** Уніфікувати візуальний стиль і UX усіх екранів — Survival, Quiz, Kahoot (hub/playlists/editor/join/create), Themes, ThemeDetail, ExplanationModal — з єдиною системою карток, кастомних інпутів та преміальних gold-акцентів.

#### 12.1. Survival — фідбек та game-over
- ✕ close button top-left замість текстової bottom.
- ❤️ neon glow active / 🖤 grayscale при втраті.
- Об'єднаний stats-віджет (Round / Points / Level) в одній картці.
- Лінійний gradient timer з цифровим countdown по центру.
- Бейджі «💔 Життя втрачено» / «🎉 Правильно» — капсульні напівпрозорі.
- Кнопка «Пояснення» → чисто outline (без заливки).
- Game-over: 💔, stats grid (Round / 🪙 Points / 🏆 Record), «🏆 Новий рекорд!» pulse.
- Sans-serif для цифр, `align-items: center` для іконок.

#### 12.2. Quiz — close button + таймер + empty states
- ✕ close button top-left (замість «Пропустити»).
- 15s SVG circular countdown з кольоровим переходом (зелений→жовтий→червоний).
- Empty states: 📜 «Питань більше нема»; 🎉 для review mode.

#### 12.3. ExplanationModal
- Правильна відповідь → зелений `--success-text`.
- Відступ тексту пояснення → 1.25rem.
- Кнопка «Зрозуміло» → gold gradient + active `scale(0.97)`.

#### 12.4. Kahoot Hub
- ← кругла кнопка з `rgba(0,0,0,0.3) + 1px solid rgba(255,255,255,0.1)`.
- ⚡ glow: `radial-gradient` + `drop-shadow(0 0 12px gold)` + `iconPulse` анімація.
- «Приєднатися за кодом» → gold outline. «Плейлисти» → text link.
- 3 інструкційні step-баджі (кольорові кола).
- Сітка: `.page` — `max-width: 480px; margin: 0 auto; padding: 0 1rem`.

#### 12.5. Kahoot Playlists
- ← кругла кнопка + `.pageTitle`.
- Сегментний перемикач (`.segmentControl` з `.segmentGlider` gold gradient).
- «+ Створити» → gold gradient full-width.
- Empty state: 📜 + «Тут порожньо» + опис.

#### 12.6. Kahoot Playlist Editor
- 3 `.sectionCard` (border-radius: 16px): загальна / теми / параметри.
- Складність → multi-select capsule chips.
- Слайдер питань з `X / maxAvailable` та плаваючим `.sliderValue`; debounce 400ms.
- Без ліміту 20 питань (cap = загальна кількість для вибраних тем+складностей).
- `pickQuestionsForPlaylist` → параметр `difficulties?: Difficulty[]`.
- 🔄 spin анімація (0.4s) на батьківському контейнері.
- ThemePicker: colored dots замість emoji; gold border при active.
- Зберегти → gold gradient `#b8860b → #f5d76e`.

#### 12.7. Kahoot Join
- 6 code cells grid (`display: grid; grid-template-columns: repeat(6, 1fr)`).
- Cells: монопростір 1.6rem bold, gold border + glow при заповненні.
- `.joinCenter` — `flex: 1; justify-content: center` для вертикального центрування.
- Server error → `.serverError` small red text; button `disabled`.

#### 12.8. Kahoot Create
- 2 `.sectionCard`: налаштування ведучого / параметри кімнати.
- Segmented control для перемикання Теми / Плейлист; при playlist → `<select>`, теми ховаються.
- Складність → multi-select chips.
- Час → 4 chips (10/20/30/60с) замість слайдера.
- Слайдер питань без ліміту 20; `maxAvailable` через `getQuestionCountByDifficulty`.

#### 12.9. Inputs & field styles (глобальні)
- `padding: 0.75rem 1rem` для input/textarea.
- `cursor: pointer` на `.checkboxRow`.
- Range slider: `::-webkit-slider-runnable-track` / `::-moz-range-track` / `::-ms-track`; яскравіший трек `rgba(255,255,255,0.18)`.
- `btnPrimary` градієнт пом'якшено до `#b8860b → #f5d76e`.

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

## Acceptance критерії
- Home показує реальні daily tasks, streak, learning KPI.
- Після кожної відповіді оновлюється answer history і mastery підтеми.
- Study path генерується за слабкими місцями користувача.
- Збірка фронтенду стабільна, без type помилок.
- Сервер має робочі backend-ready ендпоінти (мінімум mock).
