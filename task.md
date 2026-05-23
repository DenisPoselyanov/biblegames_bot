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

## G. Phase 6 — Difficulty System + Topics (Completed)

- [x] **G1. Нова система складності (7 рівнів)**
  - [x] Оновити `Difficulty` тип: `baby`, `child`, `youth`, `student`, `preacher`, `teacher`, `theologian`
  - [x] Додати emoji в `DIFFICULTY_LABELS`
  - [x] Оновити `DIFFICULTY_POINTS` та `DIFFICULTY_ORDER`
  - [x] Оновити `isValidDifficulty`
  - [x] `src/data/questions.ts`: замінити всі old difficulty на new у `q()` викликах
  - [x] `src/data/questions-extra.ts`: замінити всі old difficulty на new
  - [x] `src/data/kahootQuestions.ts`: default difficulty + fallback
  - [x] `src/pages/AdminPanel.tsx`: `difficultyColor` для 7 рівнів
  - [x] `src/lib/questionPools.ts`: `POOL_CONFIGS` + `getModeSpecificRules` + `difficultyOrder`
  - [x] `src/lib/questionQuality.ts`: `calibrateDifficulty` + `validateDifficulty` + `getDifficultyLevel` + `getDifficultyByLevel`
  - [x] `scripts/lib/themes-config.mjs`: `DIFFICULTIES` масив на 7
  - [x] `scripts/generate-questions-ai.mjs`: `buildPrompt` опис 7 рівнів
  - [x] `bot/index.mjs`: валідація DIFFICULTIES
  - [x] `scripts/analyzeQuestionPools.ts`: фільтри складності
  - [x] `scripts/testSocialFeatures.ts`: оновлено difficulty + question IDs
  - [x] `src/types/gameModes.ts`: default difficulty
  - [x] `data/question-db/*.json`: оновлено difficulty та ID у всіх AI-питаннях

- [x] **G2. AI функція генерації ієрархії тем**
  - [x] Додати тип `TopicNode` (рекурсивний) + `TopicHierarchyMap` в `src/types/index.ts`
  - [x] Створити `scripts/generate-topics-ai.mjs` (Ollama) + додати npm script
  - [x] Створити директорію `data/topics-db/` з 15 JSON файлами
  - [x] Створити `src/data/topicDbLoader.ts` для завантаження (loadTopicHierarchy, loadAllTopicHierarchies, flattenTopicNodes, countTopicNodes)

- [x] **G3. Оновлення адмін-панелі**
  - [x] Розділити на "🏷️ Теми" та "❓ Запитання" (основні вкладки)
  - [x] Вкладка Теми: дерево з розкриттям (TopicTreeNode компонент), аналіз кількості питань
  - [x] Вкладка Запитання: підвкладки 🚧 Карантин / 📋 Звіти якості / 🗂️ Пули питань
  - [x] Оновити CSS (subTabs, subTabBtn, themeGrid)

- [x] **G4. AI сортування існуючих питань**
  - [x] Створити `scripts/sortQuestionsByCategory.ts` з tsx
  - [x] Маппінг старих рівнів на нові (DIFICULTY_MAP)
  - [x] Призначення підтем для кожного питання з topic hierarchy
  - [x] Збереження в `data/question-categories.json`
  - [x] npm script: `npm run sort-questions`

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

## H. Phase 7 — UI/UX Design System & Polish (Completed)

- [x] **H1. Розширення дизайн-системи**
  - [x] CSS-токени: spacing, radius, shadows, transitions
  - [x] Типографічна шкала (h1–h6, body, caption)
  - [x] Розширена кольорова палітра (success, danger, warning, info)

- [x] **H2. SVG іконки замість emoji**
  - [x] Набір SVG-іконок (24×24, stroke-based)
  - [x] `Icon` компонент (size, color, strokeWidth)
  - [x] Заміна emoji в Layout (навігація)

- [x] **H3. Мікро-анімації та переходи**
  - [x] Page transitions між сторінками
  - [x] Loading spinner та skeleton компоненти
  - [x] Анімація correct/wrong при відповідях
  - [x] Toast/snackbar компонент

- [x] **H4. Система станів UI**
  - [x] ToastProvider + useToast hook
  - [x] EmptyState компонент
  - [x] ErrorBoundary для кожної сторінки
  - [x] Skeleton для списків та карток

- [x] **H5. Доступність (a11y)**
  - [x] ARIA атрибути для всіх інтерактивних елементів
  - [x] Focus ring стилі
  - [x] Focus trap в модальних вікнах (ConfirmModal, ExplanationModal)
  - [x] `role="alert"` для помилок

- [x] **H6. Telegram інтеграція**
  - [x] Синхронізація теми з tg.themeParams
  - [x] Використання Telegram MainButton
  - [x] Розширений haptic фідбек

- [x] **H7. Рефакторинг CSS**
  - [x] Усунути дублювання стилів між модулями
  - [x] Уніфікувати компоненти через CSS-токени
  - [x] `prefers-reduced-motion` повага

### Етап 1: Перебудова UX

- [x] **H8. Розвантаження профілю**
  - [x] Перенести налаштування (чекбокси) під іконку ⚙️ у верхній правий кут Profile.tsx
  - [x] Досягнення: горизонтальна карусель бейджів + модальне вікно "Мої нагороди"

- [x] **H9. Оптимізація головного екрана**
  - [x] Зробити картку біблійного вірша компактнішою (інтегровано в greeting header)
  - [x] CTA "Продовжити дослідження" — анімований, з іконками, візуальний центр
  - [x] Спростити додавання друзів: кнопка "Запросити друга" → Telegram share / clipboard

### Етап 2: Оновлення UI

- [x] **H10. Поглиблення візуальної глибини**
  - [x] Більше негативного простору, border-radius: 16px–20px для карток
  - [x] Glassmorphism / градієнти для карток замість суцільної заливки
  - [x] Чітка типографічна ієрархія (великі заголовки, приглушений опис)
  - [x] Посилити золотий текст (text-shadow + золоте світіння)

- [x] **H11. Ілюстрації для режимів гри**
  - [x] Замінити іконки на PlayHub на великі SVG-ілюстрації (120px висоти) з градієнтами

### Етап 3: Гейміфікація

- [x] **H12. Прогрес-бари та аватари**
  - [x] Кольорові прогрес-бари для щоденних завдань на Home.tsx
  - [x] Відображати активний аватар на головному екрані, лідерборді, мультиплеєрі

### Етап 4: Telegram Mini Apps

- [x] **H13. Нативна Telegram інтеграція**
  - [x] MainButton для головних дій (режим гри, "Продовжити дослідження")
  - [x] Haptic feedback при покупці в магазині, виконанні завдання
  - [x] Свайп вниз для закриття модалок, свайп "назад" для навігації

## I. Phase 8 — Profile Redesign & UX Polish (Completed)

- [x] **I1. Візуальна ієрархія та Header**
  - [x] Сховати «Адмін-панель» в налаштування (під ⚙️)
  - [x] Виводити куплений аватар у header профілю
  - [x] ID показувати по тапу на ім'я

- [x] **I2. Компактність та навігація**
  - [x] Магазин тем → горизонтальна swipeable карусель
  - [x] Об'єднати «Виклики друзів» + «Спільноти» в 50/50 блок

- [x] **I3. Гейміфікація прогресу**
  - [x] Редизайн heatmap — градієнт, світіння при 80%+
  - [x] Круговий прогрес-бар (CircularProgress) для Winrate

- [x] **I4. Стиль та мікроінтеракції**
  - [x] Inner border + тінь для карток (glassmorphism)
  - [x] Haptic на покупки, налаштування, вкладки
  - [x] Scale-down 0.95–0.98 на всі клікабельні картки

- [x] **I5. Мікро-корекції**
  - [x] Виправлено margin підзаголовка магазину тем (Profile)
  - [x] Стиль кнопки «Загальний Рейтинг» — золотий градієнт + світіння

## J. Phase 9 — Home Dashboard Redesign (Completed)

- [x] **J1. Преміальна картка вірша**
  - [x] Glassmorphic overlay + золоте внутрішнє світіння
  - [x] Курсивний елегантний шрифт

- [x] **J2. Блок статистики**
  - [x] Сітка 2×2 квадратних карток (монети, рівні, стрік, теми)

- [x] **J3. Щоденні завдання**
  - [x] При 100% — зелений/золотий бордер + галочка замість цифр

- [x] **J4. Learning KPI**
  - [x] Відсотки точності — кольорові badge (зелений/бірюзовий)
  - [x] Освоєні підтеми — акцентний бейдж

- [x] **J5. Мікро-корекції Home**
  - [x] Зменшено шрифт джерела вірша, додано `.verseRef`
  - [x] Заголовки секцій — звичайний регістр, колір `--gold-light`
  - [x] Іконки статистики збільшено (кружки 56px, іконки 30px)
  - [x] `text-shadow` для цифр + контраст
  - [x] Прогрес-бари: яскравіша підкладка + світло-золоте заповнення
  - [x] CTA градієнт 180° gold-light → gold → gold-dark
  - [x] `box-shadow` на всі картки для відділення від фону
  - [x] Фікс теми Eden Garden: CTA без `--gold`

## K. Phase 10 — PlayHub Redesign (Completed)

- [x] **K1. Великі ілюстрації справа**
  - [x] Горизонтальний flex з градієнтною панеллю справа
  - [x] Іконки 64px (featured: 96px) з `drop-shadow`
  - [x] Індивідуальні кольори градієнтів

- [x] **K2. Ієрархія режимів**
  - [x] Featured card «Дослідження» — `min-height: 200px`
  - [x] Золотий `border-color` + `box-shadow` glow
  - [x] Збільшені `padding` body (+16px)

- [x] **K3. Pill-badges**
  - [x] `NEW` — градієнт фіолет-бірюза + світіння
  - [x] `Мультиплеєр` — градієнт помаранч-жовтий + світіння
  - [x] `border-radius: 20px`, `font-weight: 800`

- [x] **K4. Мікро-корекції PlayHub**
  - [x] Видалено стрілки `→`
  - [x] Іконка «Мільйонер» — `$` → `diamond` (діамант SVG)
  - [x] Текст опису — `rgba(255,255,255,0.7)` (більший контраст)
  - [x] Іконки центровано в `cardArtBg`
  - [x] Ширина `cardArtFeatured` = 110px (як у всіх)

## L. Phase 11 — Shop Redesign (Completed)

- [x] **L1. Редизайн Header**
  - [x] Прибрано підзаголовок
  - [x] `balancePill` — компактна золота пігулка в header

- [x] **L2. Картки аватарів**
  - [x] `--glass-bg` + `backdrop-filter`
  - [x] `avatarVisual` (100px) + `avatarInfo` (flex center)
  - [x] Emoji з `drop-shadow`
  - [x] `border-top` між зонами

- [x] **L3. Кнопки та стани**
  - [x] `btnBuy` — градієнт gold-light → gold-dark (як CTA)
  - [x] `btnApply` — прозора з border
  - [x] `badgeActive («Екіпіровано») ` — outline pill
  - [x] Однакові розміри badgeActive/btnApply (без зсуву)

- [x] **L4. Мікро-корекції Shop**
  - [x] Шрифт монет — `--font-sans`
  - [x] `margin-top` секції 1.5rem
  - [x] Центрування контенту в картці

## F. Phase 5 — Administration (Completed)

- [x] **F1. Управління якістю через адмін-панель**
  - [x] Інтеграція `questionQualityValidator` + `questionQuarantineManager`
  - [x] Звіти з фільтрацією за severity
  - [x] Статистика пулів у реальному часі

## M. Phase 12 — UI Polish & Kahoot Redesign (2026-05-23)

- [x] **M1. Survival екран**
  - [x] ✕ кнопка виходу top-left (замість текстової bottom)
  - [x] Серця: ❤️ neon glow / 🖤 grayscale при втраті
  - [x] Об'єднаний stats widget (Round / Points / Level) в одній картці
  - [x] Лінійний gradient timer з центрованим цифровим countdown
  - [x] Бейджі «💔 Життя втрачено» / «🎉 Правильно» — капсульні з напівпрозорим фоном
  - [x] Кнопка «Пояснення» → чисто контурна (border only)
  - [x] Game-over: 💔, stats card (Round / 🪙 Points / 🏆 Record), «🏆 Новий рекорд!» pulse badge
  - [x] Шрифт цифр статистики → sans-serif (прибрано `--font-serif`)
  - [x] Вирівнювання іконок 🪙🏆 → `align-items: center`

- [x] **M2. Quiz екран**
  - [x] ✕ close button top-left
  - [x] 15s SVG circular countdown (green→yellow→red)
  - [x] Empty states: 📜 + текст; 🎉 для review
  - [x] Кнопка «Пояснення» → контурна

- [x] **M3. Challenges / Communities**
  - [x] ← back button, dark inputs, capsule chips для складності
  - [x] 24h neon-red badge, gold gradient create button
  - [x] Empty state з emoji, inline accept/decline

- [x] **M4. Themes / ThemeDetail**
  - [x] ← back button, split-card sub-themes (left text + right colored panel)
  - [x] Progress bars, status badges (gold «Почати» / green «✅»)

- [x] **M5. ExplanationModal**
  - [x] Правильна відповідь → зелений `--success-text`
  - [x] Відступ пояснення → 1.25rem
  - [x] Кнопка «Зрозуміло» → gold gradient + active scale

- [x] **M6. Kahoot Hub**
  - [x] ← кругла кнопка (rgba(0,0,0,0.3) + border)
  - [x] ⚡ glow ефект (radial-gradient + drop-shadow + pulse)
  - [x] «Приєднатися за кодом» → gold outline; «Плейлисти» → text link
  - [x] 3 colored circle badges замість `<ol>`
  - [x] Сітка: `max-width: 480px; margin: 0 auto; padding: 0 1rem`

- [x] **M7. Kahoot Playlists**
  - [x] ← кругла кнопка + `.pageTitle`
  - [x] Сегментний перемикач (segmentControl з gold glider)
  - [x] «+ Створити» → gold gradient full-width
  - [x] Empty state: 📜 + «Тут порожньо» + опис

- [x] **M8. Kahoot Playlist Editor**
  - [x] 3 sectionCard (border-radius: 16px): загальна / теми / параметри
  - [x] Складність → multi-select capsule chips
  - [x] Слайдер питань X/Y з плаваючим значенням + debounce 400ms
  - [x] Час → 4 фіксовані chips (10/20/30/60с)
  - [x] Зберегти → gold gradient (gradient #b8860b → #f5d76e)
  - [x] `pickQuestionsForPlaylist` → `difficulties?: Difficulty[]`
  - [x] Без ліміту 20 питань
  - [x] 🔄 spin анімація (0.4s)
  - [x] ThemePicker: emoji → colored dots, active → gold border

- [x] **M9. Kahoot Join**
  - [x] 6 code cells (grid, monospace 1.6rem, gold при заповненні)
  - [x] `.joinCenter` flex centering
  - [x] Server error → small red text, button disabled

- [x] **M10. Kahoot Create**
  - [x] 2 sectionCard: налаштування ведучого + параметри кімнати
  - [x] Плейлист → `<select>` (сітка тем ховається)
  - [x] Складність → multi-select chips
  - [x] Час → chips 10/20/30/60с (замість слайдера)
  - [x] Слайдер X/Y без ліміту 20

- [x] **M11. Inputs & field styles**
  - [x] `padding: 0.75rem 1rem` для інпутів
  - [x] `cursor: pointer` на checkboxRow
  - [x] Слайдер: `::-webkit-slider-runnable-track` + `::-moz-range-track` + `--ms-track`
  - [x] Трек: `rgba(255, 255, 255, 0.18)`

- [x] **M12. CSS module expansion (Kahoot.module.css)**
  - [x] `.pageTitle`, `.sectionCard`, `.sectionCardHeader`, `.sectionCount`
  - [x] `.chipGroup`, `.chip`, `.chipActive`
  - [x] `.rangeSlider` (webkit/moz/ms track + thumb)
  - [x] `.sliderTitle`, `.sliderWrap`, `.sliderValue`
  - [x] `.joinCenter`, `.codeGrid`, `.codeCell`, `.codeCellFilled`, `.codeHiddenInput`
  - [x] `.serverError`, `.btnOutline`, `.playlistLink`
  - [x] `.segmentControl`, `.segmentTab`, `.segmentGlider`, `.gliderLeft/Right`
  - [x] `.createButton`, `.emptyState`, `.emptyIcon`, `.emptyTitle`, `.emptyDesc`
  - [x] `.feedbackBadge`, `.feedbackCorrect`, `.feedbackWrong`
  - [x] `@keyframes spin`
