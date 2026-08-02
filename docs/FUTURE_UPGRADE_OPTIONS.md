# Bible Games — каталог майбутніх варіантів розвитку

> **Статус документа:** активний каталог кандидатів, але не затверджений roadmap  
> **Застосування:** лише після окремого вибору власника продукту  
> **Канонічний roadmap:** [`BIBLE_GAMES_MASTER_SPECIFICATION.md`](./BIBLE_GAMES_MASTER_SPECIFICATION.md)  
> **Implementation plans:** [`phases/README.md`](./phases/README.md)

---

## 1. Призначення документа

Цей файл зберігає всі відомі на цей момент варіанти майбутнього розвитку Bible Games. Він потрібен, щоб власник продукту міг у будь-який момент вибрати один або кілька напрямів, не втрачаючи ідей і не змушуючи AI-агента вигадувати новий паралельний roadmap.

Наявність функції в цьому каталозі **не означає**, що вона:

- затверджена до реалізації;
- належить до поточної активної Phase;
- має вищий пріоритет за security, data integrity, accessibility або content quality;
- може бути реалізована без ADR, execution brief і перевірки актуального коду;
- автоматично входить у Phase 8;
- повинна бути реалізована разом з усіма сусідніми пунктами.

Усі опції нижче мають початковий статус `candidate`.

---

## 2. Правила для AI-агента

AI-агент, Codex або Claude Code зобов’язаний:

1. Не реалізовувати жоден пункт лише тому, що він описаний у цьому файлі.
2. Отримати явний вибір власника продукту за кодом, наприклад `A1`, `C4`, `G10`.
3. Перед реалізацією перевірити поточний branch, master specification, ADR, Phase status, domain docs, схеми, API, тести й git history.
4. Для вибраної опції створити decision record або доповнити чинний ADR, якщо рішення має продуктові, фінансові, правові, security, privacy чи богословські наслідки.
5. Визначити, чи це розширення чинної Phase, post-Phase initiative або окремий продуктово-технічний epic.
6. Не переносити весь каталог у backlog автоматично.
7. Не створювати фальшиві UI-демо, локальні покупки, вигадані спільноти, рейтинги чи AI-відповіді замість реальної системи.
8. Не послаблювати server authority, publication workflow, moderation, accessibility або rollback заради швидшого запуску.
9. За конфлікту цього каталогу з master specification, ADR або актуальним кодом — зупинити реалізацію та зафіксувати decision point.
10. Після реалізації змінити статус тільки конкретного пункту, не всієї категорії.

### Статуси

- `candidate` — ідея збережена, рішення не прийняте;
- `selected` — власник продукту обрав для discovery/planning;
- `approved` — пройдено ADR і дозволено реалізацію;
- `in_progress` — є активний execution plan/PR;
- `implemented` — працює, протестовано й розгорнуто;
- `deferred` — відкладено до визначеної залежності;
- `rejected` — свідомо відхилено із зазначеною причиною.

---

## 3. Обов’язковий decision gate для будь-якої опції

Перед implementation потрібно визначити:

- **Product outcome:** яку реальну проблему вирішує функція.
- **Target users:** звичайний користувач, учень, лідер, редактор, церква, гість чи адміністратор.
- **Dependencies:** які Phase, API, ролі, дані, content revisions, media pipeline або payments потрібні.
- **Authority:** що вирішує сервер, що дозволено клієнту, що потребує редактора.
- **Privacy/minors:** які особисті дані, групова видимість і consent потрібні.
- **Theological/content review:** чи є тлумачення, цитати, реконструкції або AI-висновки.
- **Licensing:** права на переклади, карти, ілюстрації, аудіо, відео й імпортований контент.
- **Feature flag:** як функцію вмикати поступово.
- **Rollout/rollback:** як повернутися до попереднього стану без втрати даних.
- **Evidence:** тести, accessibility, performance, analytics і Definition of Done.

### Орієнтовна складність

- `S` — локальне розширення на готовому фундаменті;
- `M` — кілька компонентів/API та новий domain workflow;
- `L` — великий продуктово-технічний epic;
- `XL` — окрема платформа, складна інфраструктура або значний правовий/операційний scope.

---

# A. Візуальне наповнення уроків

## Спільний фундамент категорії A

Перед масштабним створенням візуалів потрібні:

- media asset domain зі stable asset ID, revision, hash, locale, alt text, attribution і license metadata;
- AI media job pipeline з prompt version, provider/model, cost budget, retries та raw artifact retention;
- review queue для історичної, біблійної, візуальної й технічної перевірки;
- asset variants для mobile, tablet, projector і low-end devices;
- CDN/object storage, responsive formats, lazy loading і cache invalidation;
- чітке маркування художніх реконструкцій;
- заборона автоматичної публікації AI-зображень;
- fallback, щоб урок залишався зрозумілим без медіа.

| Код | Варіант | Як реалізувати | Залежності / ризики | Розмір |
|---|---|---|---|---|
| A1 | Головна ілюстрація кожного уроку | Додати `heroAssetId` до revision уроку; AI або дизайнер створює draft, редактор перевіряє відповідність уривку, після publication renderer отримує оптимізований variant. | Phase 4 publication, media storage, licensing, historical review. | L |
| A2 | Ілюстрації окремих частин уроку | Додати typed `image` blocks з caption, alt, placement і purpose; Content Studio показує preview та дозволяє заміну окремого asset без переписування уроку. | Не перевантажувати урок; performance budget на кількість зображень. | M |
| A3 | Біблійні карти | Створити canonical geo dataset, map layers, locations, routes і historical-period versions; урок посилається на map revision, а клієнт показує static fallback або інтерактивний canvas. | Географічна точність, різні реконструкції, offline assets. | XL |
| A4 | Часові лінії | Ввести `Timeline`, `TimelineEvent` і relation to content/objectives; редактор задає порядок, приблизні дати та uncertainty; UI підтримує static і interactive modes. | Не подавати спірну хронологію як абсолютну. | L |
| A5 | Родоводи та сімейні дерева | Побудувати graph model person–relation–source; показувати різні біблійні родоводи як окремі evidence-backed views, а не один примусово злитий graph. | Складні однойменні персонажі й різні генеалогії. | L |
| A6 | Портрети біблійних персонажів | Створити character asset library з art-direction rules, віком/періодом/одягом і позначкою `artistic_reconstruction`; уникати претензії на історичну достовірність. | Теологічна чутливість, сталість образів між уроками. | M |
| A7 | Іконки для кожної теми й уроку | Розробити versioned icon set у SVG, семантичні назви й theme-aware variants; іконки додаються через registry, а не hardcoded imports. | Accessibility labels, consistency, no fragile tiny details. | M |
| A8 | Інфографіка | Додати typed infographic schemas і template library для порівнянь, структур, списків та процесів; складні схеми проходять editorial review і мають текстовий еквівалент. | Responsive layout, screen-reader alternative. | L |
| A9 | Історичні реконструкції | Створювати реконструкції як окремі reviewed media packages з джерелами, рівнем упевненості та поясненням, що є фактом, а що інтерпретацією. | Археологічна точність, авторські права. | XL |
| A10 | Схеми географії | Реалізувати lightweight geo cards без повної інтерактивної карти: маршрут, відстань, рельєф, основні точки та textual summary. | Потребує A3 dataset, але дешевше у UI. | M |
| A11 | Автоматичний AI-підбір візуалу | AI аналізує lesson blocks і повертає recommendation objects: asset type, purpose, placement, evidence need; рішення приймає редактор. | AI не повинен додавати декор заради декору. | M |
| A12 | AI-генерація візуальних промтів | Versioned prompt builder використовує scene facts, period, geography, prohibited elements, art direction і output size; prompt та модель зберігаються в artifact metadata. | Prompt injection з контенту, consistency, cost. | M |
| A13 | Контроль біблійної точності зображень | Поєднати deterministic checklist, vision-model warnings і human review; findings включають анахронізми, одяг, предмети, geography, symbols та anatomy artifacts. | Vision AI лише допоміжний, не фінальний reviewer. | L |
| A14 | Візуальні питання | Розширити question schema asset reference, hotspots або visual options; server фіксує revision і answer key, клієнт має доступний текстовий fallback. | Accessibility, device size, cheating через asset metadata. | L |
| A15 | Інтерактивні зображення | Додати hotspot/region schema, zoom/pan, keyboard navigation і response events; authoring tool дозволяє наносити області на asset revision. | Touch accuracy, screen readers, mobile performance. | XL |

---

# B. Покращення уроків

## Спільний фундамент категорії B

Усі lesson variants повинні використовувати typed blocks, immutable revisions, learning objectives, Scripture evidence, accessibility і server-authoritative session completion. Формат уроку не може змінювати істину контенту, нагороди або unlock rules на клієнті.

| Код | Варіант | Як реалізувати | Залежності / ризики | Розмір |
|---|---|---|---|---|
| B1 | Короткі уроки | Додати duration/profile `micro`; редактор обмежує кількість блоків, objective scope і checkpoints; Today може рекомендувати їх для 3–5 хвилин. | Не перетворити на поверхневі AI-конспекти. | M |
| B2 | Стандартні уроки | Використати базовий lesson template: goal, Scripture, explanation, context, term, checkpoint, summary; renderer працює з будь-якою затвердженою комбінацією блоків. | Основний Phase 3/4 scope. | M |
| B3 | Поглиблені уроки | Додати advanced blocks, multiple references, viewpoints, evidence notes і prerequisite rules; доступ не прив’язувати лише до ігрового rank. | Теологічний review і складні права на джерела. | L |
| B4 | Уроки за віком | Зберігати окремі localized/audience revisions із shared objectives; selector використовує profile preference або group assignment, але не розкриває вік публічно. | Privacy неповнолітніх, дублювання контенту. | L |
| B5 | Уроки за рівнем знань | Створити learning-depth variants `intro/base/intermediate/advanced`; placement test або user choice визначає старт, а objectives мають shared mapping. | Не змішувати з rank і question difficulty. | L |
| B6 | Порівняння перекладів Біблії | Scripture adapter повертає дозволені translations; UI показує side-by-side або tabs із license notice й однаковою normalized reference. | Ліцензії та відмінність нумерації віршів. | L |
| B7 | Перехресні біблійні посилання | Створити reviewed relation graph `reference -> related reference` з relation type; урок показує лише затверджені links, не AI hallucinations. | Контекст, доктринальні інтерпретації. | L |
| B8 | Вбудований біблійний словник | Canonical glossary item/revision, locale, source, references і difficulty; терміни в lesson blocks посилаються на stable IDs. | Авторські права на словники, theological review. | L |
| B9 | Історичний довідник | Додати encyclopedia entries із periods, people, places, units, uncertainty й citations; lesson cards завантажують коротку projection. | Не змішувати історичну гіпотезу з текстом Писання. | L |
| B10 | Запитання для особистого роздуму | Typed reflection block без correct answer і без XP; за замовчуванням відповідь не зберігається або зберігається приватно після explicit consent. | Sensitive data і духовна приватність. | M |
| B11 | Приватні нотатки | Encrypted-at-rest user note domain з scope lesson/verse/topic, export/delete та strict authorization; не використовувати текст нотаток у analytics. | Privacy, backups, search. | L |
| B12 | Підкреслення тексту | Зберігати anchors до Scripture/content revision і selected ranges; при зміні revision виконувати migration або показувати detached highlight. | Fragile text ranges, translation switching. | L |
| B13 | Закладки | Універсальний bookmark entity з content type/ID/revision і collections; offline queue синхронізується idempotently. | Видалені/архівні revisions. | M |
| B14 | Вірші для запам’ятовування | Окремий memory objective, exercises, spaced repetition і translation binding; exact quote залежить від обраного перекладу. | Ліцензії, не змішувати paraphrase з цитатою. | L |
| B15 | Підсумкові уроки модуля | Module checkpoint агрегує approved summaries, objectives і practice blueprint; completion server-authoritative. | Потребує стабільної module/objective моделі. | M |
| B16 | Уроки з розгалуженням | Lesson graph з optional branches і completion policy; сервер фіксує відвіданий шлях, але обов’язкові objectives не можна обійти декоративною гілкою. | Складність authoring/testing. | L |
| B17 | Аудіоуроки | Audio asset revisions, transcript, playback state, speed, background behavior і offline entitlement; completion не базується лише на натисканні Play. | TTS quality, licenses, accessibility. | L |
| B18 | Відеоблоки | Video hosting/CDN, captions, transcript, poster, adaptive bitrate і analytics without sensitive profiling; lesson has textual fallback. | Вартість storage/bandwidth і moderation. | XL |
| B19 | Уроки від запрошених авторів | Author profiles, contracts, permissions, draft/review/publication workflow і attribution; автор не публікує напряму. | Doctrine, rights, revenue share. | XL |
| B20 | Сертифікати завершення | Server generates signed completion record and shareable/PDF presentation; certificate reflects completion criteria, not spiritual authority. | Fraud, privacy, localization. | M |

---

# C. Розвиток великої бази питань

## Спільний фундамент категорії C

Question bank залишається центральним контентним двигуном. Потрібні canonical question revisions, topic/objective mapping, окрема `QuestionDifficulty`, pool eligibility, quality findings, usage analytics і session generator, який не завантажує всю базу на клієнт.

| Код | Варіант | Як реалізувати | Залежності / ризики | Розмір |
|---|---|---|---|---|
| C1 | AI-прив’язування старих питань | Batch classifier повертає topic/objective/difficulty/pool suggestions із confidence; редактор підтверджує або виправляє mapping. | Phase 4 jobs, canonical taxonomy. | L |
| C2 | Автоматична перевірка складності | Rule engine + AI review оцінюють knowledge depth, reasoning steps і distractors; finding не змінює difficulty без approval. | Потрібна difficulty rubric. | M |
| C3 | Динамічне калібрування складності | Збирати anonymized performance statistics, використовувати minimum sample і anomaly controls; створювати recalibration proposal. | Bias через аудиторію й cheating. | L |
| C4 | AI-генерація нових питань | Coverage service формує конкретний gap task; AI створює draft revisions із explanation/reference, далі validation і human review. | Заборона bulk auto-publish. | L |
| C5 | AI-генерація варіантів відповіді | Distractor generator отримує correct answer, objective, prohibited clues і existing options; validator перевіряє дублікати та ambiguity. | Неправильні варіанти не мають бути образливими чи абсурдними. | M |
| C6 | AI-генерація пояснень | Створювати explanation draft із evidence references; старе published explanation не змінюється без new revision. | Hallucinations, translation mismatch. | M |
| C7 | Різні формулювання одного знання | Question families пов’язують variants з одним objective і fact/evidence set; session generator обмежує near-duplicates. | Не створювати memorization of wording. | M |
| C8 | Нові типи питань | Versioned discriminated union schemas, окремі validators/renderers/answer evaluators і accessible fallbacks. | Великий testing matrix. | XL |
| C9 | Аудіопитання | Question revision посилається на reviewed audio/transcript; сервер оцінює відповідь, а клієнт має transcript accommodation. | Audio licensing і accessibility. | L |
| C10 | Питання з картою | Geo question type посилається на map revision і answer regions/locations; підтримати text alternative. | Залежність A3, touch accuracy. | L |
| C11 | Питання з часовою лінією | Ordering question із event IDs і accepted order/uncertainty rules; drag-and-drop має keyboard fallback. | Спірні дати. | L |
| C12 | Порівняння уривків | Multi-reference question з translation binding і explicit relation; explanations показують контекст обох уривків. | Високий editorial burden. | L |
| C13 | Виявлення дублікатів | Exact normalization, embeddings/near-duplicate index і reviewer merge workflow; historical attempts лишаються на старих revisions. | False positives. | M |
| C14 | Виявлення неоднозначних питань | Heuristics + AI critic + user reports створюють blocker finding; питання quarantined до рішення редактора. | Не auto-fix correct answer. | M |
| C15 | Аналіз якості варіантів | Перевіряти length bias, lexical leakage, position bias, overlap і implausibility; findings показуються в Studio. | Мовна специфіка української. | M |
| C16 | Статистика кожного питання | Aggregated projection: exposures, correctness, response time, skips, reports, modes, cohorts with privacy thresholds. | Не показувати answer key через public analytics. | L |
| C17 | Автоматичний карантин | Policy engine quarantine при critical report, invalid reference або anomaly threshold; потрібні audit, manual override і rollback. | Не дозволити coordinated abuse reports. | M |
| C18 | Публічне повідомлення про помилку | In-session report action передає question revision, category і optional comment; deduplication та reviewer queue. | Privacy і spam. | M |
| C19 | Імпорт зовнішніх наборів | Import adapters, mapping UI, dry-run, license/provenance, validation і quarantine; жодного direct publish. | Права на контент, incompatible schemas. | L |
| C20 | Експорт наборів питань | Permissioned export jobs у JSON/CSV/Excel/Kahoot-compatible format із version, attribution і answer-key protection. | Data leakage та licensing. | M |

---

# D. AI Content Studio

## Спільний фундамент категорії D

Використовувати Phase 4: provider abstraction, versioned prompts, bounded jobs, deterministic mock, review roles, immutable revisions, atomic publication, audit і budgets. AI ніколи не отримує permission публікувати.

| Код | Варіант | Як реалізувати | Залежності / ризики | Розмір |
|---|---|---|---|---|
| D1 | AI-конструктор біблійної теми | Wizard збирає scope, sources, audience і depth; job створює taxonomy/objective proposal та coverage report для review. | Не створювати нову taxonomy без approval. | L |
| D2 | AI-конструктор навчального плану | На вході duration, goal, audience і approved content; вихід — draft plan graph з prerequisites, lessons і reviews. | План не може посилатися на unpublished content. | L |
| D3 | AI-конструктор уроку | Block-aware generation із objective/evidence constraints; output проходить schema, Scripture і language validation. | Теологічний human review. | L |
| D4 | AI-конструктор Kahoot | Blueprint задає topic, difficulty curve, count і mode; AI/selector формує draft playlist лише з approved questions або створює reviewed drafts. | Phase 5 content binding. | M |
| D5 | AI-конструктор виклику | Генерує bounded challenge rules і content blueprint, але server policy перевіряє rewards, count, timer і eligibility. | Не дозволяти AI визначати економіку. | M |
| D6 | AI-редактор української мови | Suggestion diff із reason/category; редактор приймає окремі зміни, source meaning і references не змінюються автоматично. | Русизми, конфесійна термінологія. | M |
| D7 | AI-перевірка біблійних посилань | Adapter retrieves trusted text, model порівнює semantic fit, deterministic validator перевіряє existence/translation. | AI confidence не дорівнює evidence. | M |
| D8 | AI-порівняння з наявною базою | Retrieval service знаходить semantic duplicates і coverage before generation; Studio показує matches і reuse option. | Embedding index/version. | M |
| D9 | AI-пошук прогалин | Coverage matrix по topic/objective/difficulty/type/pool; alerts створюють generation tasks, але не контент. | Якість taxonomy. | M |
| D10 | AI-ремонт пояснень | На основі finding створюється нова draft revision explanation only; reviewer порівнює old/new/evidence. | Не маскувати неправильне питання красивим текстом. | M |
| D11 | AI-класифікація чутливих тем | Multi-label sensitivity classifier з confidence і manual override; sensitive queues вимагають відповідну роль. | False negatives мають blocking policy. | M |
| D12 | Пакетна генерація з бюджетом | Batch jobs, checkpointing, concurrency, per-provider budget, pause/cancel/resume й artifact reports. | Cost runaway, rate limits. | L |
| D13 | Порівняння моделей AI | Evaluation run на golden dataset, blinded reviewer scoring, cost/latency/error metrics; model change через recorded decision. | Не передавати production secrets. | L |
| D14 | AI-assistant редактора | Retrieval-only assistant над metadata, findings і docs; інструментальні дії потребують explicit confirmation та permission. | Prompt injection, data leakage. | L |
| D15 | Спільна робота редакторів | Assignments, comments, mentions, review locks, conflict handling і activity timeline. | Notification spam, role boundaries. | L |

---

# E. Нові навчальні механіки

## Спільний фундамент категорії E

Потрібні canonical objectives, mastery evidence, review scheduler, recommendation service, explainable decisions, privacy-safe analytics і чітке розділення completion, mastery, XP та rank.

| Код | Варіант | Як реалізувати | Залежності / ризики | Розмір |
|---|---|---|---|---|
| E1 | Адаптивна складність | Server selector використовує mastery, recent attempts і bounded neighboring difficulties; зберігати selection reason/version. | Не маніпулювати складністю непрозоро. | L |
| E2 | Вхідний тест | Placement blueprint покриває репрезентативні objectives; результат рекомендує старт, але користувач може обрати інший рівень. | Не називати результат духовною оцінкою. | L |
| E3 | Персональний навчальний маршрут | Recommendation service будує path із approved plans/objectives, time budget і weak areas; показувати причину рекомендації. | Privacy, cold start. | XL |
| E4 | Інтервальне повторення | Versioned scheduler policy, due items, confidence й rescheduling after outcomes; UI не обіцяє фальшиву наукову точність. | Migration старого mastery. | L |
| E5 | Черга помилок | Attempts створюють mistake evidence; review session використовує current approved revision і deduplication. | Виправлені questions/revisions. | M |
| E6 | Mastery за цілями | Evidence aggregator рахує objective mastery окремо від lesson completion; policy version зберігається. | Потрібні якісні mappings. | L |
| E7 | Карта знань | Graph projection books/topics/objectives/mastery з zoom і accessible list fallback. | Велика візуальна та data complexity. | XL |
| E8 | Щоденна навчальна мета | User/server preference визначає qualifying activities; progress лише з authoritative events. | Не створювати unhealthy pressure. | M |
| E9 | Тижневий план | Planner розподіляє lesson/review tasks з timezone, availability і reschedule; пропущений день не карає. | Calendar complexity. | L |
| E10 | Режим «Лише 5 хвилин» | Session builder створює bounded mix review/lesson/question за time estimate й дозволяє завершити без втрати прогресу. | Реалістичні duration estimates. | M |
| E11 | «Підготуватися до теми» | Goal wizard обирає event/topic/deadline; система складає compact approved plan і practice. | Не генерувати doctrine on demand без review. | L |
| E12 | «Повторити всю книгу» | Book coverage blueprint і progress projection; sessions ротаційно покривають objectives/difficulties. | Великий question coverage. | L |
| E13 | «Хронологія Біблії» | Approved chronology tracks із uncertainty notes; lesson/order/map integrations. | Різні хронологічні моделі. | XL |
| E14 | «Біблія за рік» | Reading schedule + optional lessons/reviews, timezone/resume, translation rights і honest completion. | Notifications, licensing, long-term retention. | XL |
| E15 | Підготовка вчителів | Advanced plans, handouts, references, teaching objectives і classroom exports; окремі permissions/entitlements. | Не прирівнювати завершення до служительської кваліфікації. | XL |
| E16 | Режим недільної школи | Age-safe content profiles, teacher-led sessions, visual tasks і guest policy. | Minors, parental/church controls. | XL |

---

# F. Нові ігрові режими

## Спільний фундамент категорії F

Кожна гра повинна використовувати server-authoritative session, published content revision, versioned scoring, anti-replay/idempotency, clear mastery/reward policy, reduced motion і respectful non-winner UX.

| Код | Варіант | Як реалізувати | Залежності / ризики | Розмір |
|---|---|---|---|---|
| F1 | Розширений «Мільйонер» | Server run state, difficulty ladder, lifelines, milestones, seasons і verified outcome; UI використовує shared game shell. | Economy/leaderboards лише після policies. | L |
| F2 | Розширений Survival | Versioned lives/combo/difficulty escalation і run event log; no client final score. | Anti-cheat, replay recovery. | L |
| F3 | Live-дуель 1 на 1 | Realtime matchmaker/room, synchronized question windows, stable participants і reconnect. | Phase 5 realtime, latency fairness. | XL |
| F4 | Асинхронний виклик | Challenge revision фіксує blueprint/deadline; обидва проходять server sessions, результат обчислюється після завершення. | Anti-farming, privacy. | L |
| F5 | Командна битва | Team assignments, aggregate scoring, role/guest rules і team result UI. | Collusion і participant balance. | XL |
| F6 | Кооперативна гра | Shared objective/health/progress, де команда виграє разом; rewards не залежать від приниження інших. | Realtime state and reconnect. | XL |
| F7 | Біблійна хронологія | Ordering engine з approved event sets, partial scoring і explanations. | Chronology uncertainty. | L |
| F8 | Гра на біблійній карті | Geo interactions, route tasks, map assets і server evaluation. | A3/C10 foundation. | XL |
| F9 | «Хто я?» | Clue sequence з character entity, reveal policy, score by clue count і reviewed ambiguity. | Не використовувати speculative portraits як відповідь. | M |
| F10 | «Заверши вірш» | Translation-bound memory questions, accepted text normalization і copyright-aware display. | Translation licensing. | L |
| F11 | «Хто це сказав?» | Quote/source entity із context/reference; distractors reviewed for ambiguity. | Однакові фрази різних персонажів. | M |
| F12 | «Правда чи переказ» | Editorially reviewed claims із evidence and explanation; avoid mocking traditions/denominations. | Sensitive content review. | L |
| F13 | «Знайди помилку» | Altered statement revision з explicit changed fact і explanation; server знає target. | Не плутати з точним Scripture quotation. | M |
| F14 | «Збери історію» | Ordered fragments/events, drag/keyboard UI і partial feedback. | Mobile usability. | L |
| F15 | «З’єднай пари» | Generic matching schema, randomized presentation, accessible interaction і server evaluation. | Large option sets. | M |
| F16 | Щоденна загадка | Daily published challenge per timezone/day, one authoritative attempt policy й archive. | Content operations cadence. | M |
| F17 | Щотижневий турнір | Season window, eligibility, capped attempts, leaderboard privacy, fraud review і finalization job. | High abuse/operations risk. | XL |
| F18 | Сезонні події | Versioned event package: content, visuals, rewards, dates, feature flag і expiry. | Avoid theological commercialization. | L |
| F19 | Конструктор власної гри | Bounded rule builder над approved content; server validates combinations і saves private blueprint. | Не дозволяти arbitrary scripts/answers. | XL |
| F20 | Кампанія | Campaign graph із stages, unlocks, narrative copy і final assessment; progress server-side. | Значний content production. | XL |

---

# G. Kahoot і групові ігри

## Спільний фундамент категорії G

Спирається на Phase 5: authenticated Socket.IO, stable participant IDs, server clock, persistent room snapshots, fixed content set, typed events, reconnect, moderation, guest isolation і export permissions.

| Код | Варіант | Як реалізувати | Залежності / ризики | Розмір |
|---|---|---|---|---|
| G1 | Покращений Kahoot-host | Окремий host dashboard з room controls, moderation, pacing, preview і recovery actions. | Authorization на кожну команду. | L |
| G2 | Великий екран для проєктора | Signed display token/read-only route, adaptive typography, no secrets/answer controls і remote host sync. | Token leakage, projector resolutions. | L |
| G3 | Telegram-акаунти гравців | Socket auth binds internal user; outcomes можуть впливати на stats лише за policy. | Privacy і account switching. | M |
| G4 | Контрольовані гості | Room-scoped guest token, host approval, safe names, expiry і no global rewards. | Minors/impersonation. | L |
| G5 | Власні Kahoot-набори | Playlist builder з approved question search, private revision, permissions і fixed publication at game start. | Custom content policy. | L |
| G6 | AI-генерація Kahoot-набору | D4 workflow створює draft playlist/coverage; host використовує лише reviewed result. | Не робити synchronous unreviewed generation перед грою. | M |
| G7 | Командний Kahoot | Team entity, join/assignment, aggregate score і team podium. | Fairness і guest identity. | L |
| G8 | Kahoot із раундами | Room phase graph підтримує rounds, break screens, difficulty blueprint і cumulative score. | State migration/reconnect. | L |
| G9 | Карти й зображення | Question media preloading, projector-safe variants і accessible player prompts. | Bandwidth, content licenses. | L |
| G10 | Детальний звіт після гри | Persistent session analytics, hardest objectives, participant visibility policy, export jobs. | Не відкривати приватні відповіді без permission. | L |
| G11 | Повторення помилок після Kahoot | Authenticated participant отримує personal review session із власних errors; guests — optional local summary без account progression. | Content revision consistency. | M |
| G12 | Шаблони для служіння | Curated template library з audience, duration, mode і reviewed playlists; versioned updates. | Editorial maintenance. | M |

---

# H. Спільноти

## Спільний фундамент категорії H

Потрібні community/membership/invitation domains, roles, privacy defaults, moderation, audit, notification preferences, minor-safe policy й server-authoritative aggregate statistics. Direct messaging не додається автоматично.

| Код | Варіант | Як реалізувати | Залежності / ризики | Розмір |
|---|---|---|---|---|
| H1 | Приватні церковні спільноти | `visibility=invite_only`, transactional owner membership, invite tokens і membership permissions. | Базовий рекомендований launch. | L |
| H2 | Молодіжні групи | Community subtype з conservative profile visibility, leader accountability і age-safe defaults. | Minors/legal review. | L |
| H3 | Навчальні групи | Group scope навколо active plan, progress aggregates і scheduled activities. | Privacy of learning data. | L |
| H4 | Груповий навчальний план | Assignment entity plan/version/start/end/eligibility; member progress залишається individual authoritative. | Phase 3 learning + leader permission. | L |
| H5 | Групова спільна мета | Aggregate goal from eligible events; не показувати фальшиві increments і не дозволяти client contribution. | Anti-farming. | M |
| H6 | Груповий рейтинг | Scoped seasonal leaderboard, opt-out/display policy, tie-breakers і moderation exclusions. | Unhealthy competition. | L |
| H7 | Оголошення | Permissioned announcement revisions, publish/unpublish, limited notifications і audit. | Moderation, links. | M |
| H8 | Події спільноти | Event entity з date/timezone/location/privacy, RSVP і deep links. | Calendar/notification integration. | L |
| H9 | Завдання від керівника | Assignment points to approved lesson/practice/memory task; status server-derived. | Не давати leader доступ до private answers. | L |
| H10 | Статистика для керівника | Role-based aggregates and completion status; minimum cohort/privacy thresholds. | Особливо чутливо для неповнолітніх. | L |
| H11 | Ролі | Owner/leader/moderator/member permission matrix, audited role changes і no global admin inheritance. | Phase 1 RBAC. | M |
| H12 | Запрошення через посилання/QR | Expiring/revocable invite tokens, usage limits, intended-user option і safe deep link. | Token forwarding. | M |
| H13 | Модерація і скарги | Reports, blocks, remove/ban, community suspension, reasons, audit і review queue. | Operations burden. | XL |
| H14 | Приватні обговорення уроку | Thread/comment domain tied to lesson revision, moderation, rate limits, no unrestricted DMs. | High safety/moderation scope. | XL |
| H15 | Молитовні потреби | Explicitly private encrypted content, granular audience, expiry/delete, crisis policy і no AI analysis. | Дуже високий privacy/safety risk. | XL |
| H16 | Спільний список віршів | Community memory assignment using approved verse refs/translations; individual results private by default. | Licensing. | M |
| H17 | Досягнення спільноти | Server grants collective badges for aggregate milestones; no spiritual ranking claims. | Economy/achievement policy. | M |
| H18 | Архів навчальних сезонів | Immutable season summaries, retention, leader/member visibility і export. | Data retention/privacy. | M |

---

# I. Друзі та виклики

## Спільний фундамент категорії I

Потрібні mutual relationship/invitation model, blocking, privacy, challenge state machine, fixed content blueprint, authoritative outcomes, idempotent rewards і anti-spam/farming.

| Код | Варіант | Як реалізувати | Залежності / ризики | Розмір |
|---|---|---|---|---|
| I1 | Список друзів | Mutual request/accept model або contact-safe invite; не дозволяти arbitrary Telegram ID lookup. | Privacy/contact permissions. | L |
| I2 | Виклик на тему | Challenge rule stores topic/objective set і content version. | Phase 5 challenge service. | M |
| I3 | Виклик на рівень | Bounded difficulty/range, equal blueprint і server validation. | Difficulty calibration. | M |
| I4 | Реванш | New challenge derived from previous rules but new ID/question selection; old result immutable. | Anti-farming cooldown. | S |
| I5 | Серія викликів | Series entity best-of-N, deadlines, aggregate result і cancellation rules. | State complexity. | L |
| I6 | Командний виклик | Team rosters, eligibility, aggregate scoring and privacy. | Realtime/asynchronous coordination. | XL |
| I7 | Виклик без нагороди | Reward policy `none`; learning outcome може зберігатися за окремою policy. | Найбезпечніший launch mode. | S |
| I8 | Server-defined нагорода | Reward policy ID, caps, eligibility і one-time event. | Phase 6 economy, fraud. | L |
| I9 | Виклик за уроком | Lesson completion screen creates prefilled challenge with objective set, not raw question IDs. | Content revisions. | M |
| I10 | Виклик спільноти | Community role creates group challenge, membership eligibility й scoped leaderboard. | H domains. | L |
| I11 | Запланований виклик | `startsAt/endsAt`, timezone, reminder preference і expiry worker. | Notifications. | M |
| I12 | Захист від фармінгу | Same-pair cooldown, daily caps, device/account anomalies, invalidation і audit. | Privacy-safe fraud telemetry. | L |

---

# J. AI-помічники користувача

## Спільний фундамент категорії J

Будь-який user-facing AI має бути retrieval-grounded, bounded approved corpus only, із citations, refusal rules, no spiritual authority, no crisis counseling, privacy controls, cost/rate limits, feedback і human escalation. Raw private notes/reflections не використовуються без explicit opt-in.

| Код | Варіант | Як реалізувати | Залежності / ризики | Розмір |
|---|---|---|---|---|
| J1 | «Запитай про урок» | RAG лише над current lesson, Scripture evidence і approved glossary; відповідь містить джерела й uncertainty. | Hallucinations, doctrine. | XL |
| J2 | «Поясни простіше» | Transform approved paragraph without changing claims; show original and generated explanation, feedback. | Semantic drift. | L |
| J3 | «Поясни глибше» | Retrieve advanced approved materials; do not improvise unsupported theology. | Content coverage. | XL |
| J4 | «Чому відповідь неправильна?» | Ground on question revision, explanation, selected option і objective; no new answer key for future questions. | Prompt/data leakage. | L |
| J5 | Семантичний пошук | Embedding/search index over published lessons/questions/glossary/Scripture metadata with filters and citations. | Index versioning, licenses. | XL |
| J6 | AI-план навчання | AI proposes plan from approved content; deterministic policy validates availability, prerequisites and workload. | Sensitive profiling. | XL |
| J7 | AI-підбір наступного уроку | Recommendation explanation generated from deterministic signals; user can dismiss/reset. | Avoid engagement manipulation. | L |
| J8 | AI-підготовка до служіння | Internal/user tool assembles approved lessons, maps, questions and Kahoot drafts; no auto-sermon authority. | Copyright and theological review. | XL |
| J9 | Голосовий AI | Speech-to-text, RAG, text-to-speech, consent, deletion and language accuracy. | Cost, minors, sensitive audio. | XL |
| J10 | AI не як духовний авторитет | Product-wide guardrails, UI disclaimer, refusal taxonomy, safety tests and escalation links. | Обов’язкове для J1–J9. | L |

---

# K. Аудіо та відео

## Спільний фундамент категорії K

Media pipeline: rights, source, transcript/captions, variants, CDN, offline policy, playback analytics, accessibility, moderation й asset versioning.

| Код | Варіант | Як реалізувати | Залежності / ризики | Розмір |
|---|---|---|---|---|
| K1 | Озвучення уроків | TTS/pro voice job produces audio linked to lesson revision; regenerate only new revision, store transcript. | Voice rights/quality. | L |
| K2 | Озвучення уривків | Translation-specific licensed audio або permitted TTS; precise reference alignment. | Високий licensing risk. | XL |
| K3 | Аудіорежим у дорозі | Queue lesson audio, background controls, resume, lock-screen metadata і safe hands-free navigation. | Telegram WebView limitations. | XL |
| K4 | Аудіоквіз | Audio prompts/options with accessible text fallback and server answer handling. | Bandwidth, hearing accessibility. | L |
| K5 | Короткі відеопояснення | Reviewed 1–3 minute assets with captions/transcripts and lesson binding. | Production cost. | XL |
| K6 | Анімовані карти | Pre-rendered animation або interactive timeline over A3 geo dataset; pause/scrub and textual alternative. | Heavy assets. | XL |
| K7 | Анімовані timelines | Versioned timeline animation with reduced-motion static view. | Chronology accuracy. | L |
| K8 | Міні-документальні блоки | Curated external/original video with sources, rights and editorial review. | Ongoing production. | XL |
| K9 | Відео від учителів | Author onboarding, moderation, rights, revision and removal workflow. | Reputation/doctrine. | XL |
| K10 | Offline-аудіо | Download manager, encrypted/entitled cache, storage limits, version invalidation. | Platform/browser limits. | L |

---

# L. Персоналізація та теми

## Спільний фундамент категорії L

Спирається на semantic theme system і Phase 6 entitlements. Теми не змінюють correctness, rewards, touch targets, accessibility semantics або motion safety.

| Код | Варіант | Як реалізувати | Залежності / ризики | Розмір |
|---|---|---|---|---|
| L1 | Великий магазин тем | Catalog, previews, entitlements, purchase/restore і compatibility version. | Phase 6. | L |
| L2 | Темні теми | Semantic dark palettes, Telegram chrome sync, contrast/imagery audit. | Visual regression. | M |
| L3 | Сезонні теми | Availability windows, asset packs, expiry without removing entitlement. | Operations/calendar. | M |
| L4 | Біблійні мотиви | Curated theme packs with respectful symbols and no misleading doctrine. | Art direction. | M |
| L5 | Аватари | Asset catalog, profile entitlement, safe defaults and moderation. | Не використовувати AI-real-person impersonation. | M |
| L6 | Рамки профілю | Cosmetic entitlement rendered through shared component. | Visual clutter. | S |
| L7 | Значки й титули | Server-granted achievements/entitlements; titles avoid spiritual hierarchy claims. | Progression policy. | M |
| L8 | Вибір hero-візуалу | Theme-owned hero variants, preference and fallback, no content changes. | Asset performance. | M |
| L9 | Щільність інтерфейсу | Density tokens `comfortable/compact`; preserve 44px targets and text scaling. | Mobile usability. | M |
| L10 | Анімації | Full/reduced/minimal preference with OS reduced-motion priority. | MOTION_SYSTEM. | M |
| L11 | Звук і haptic | Independent preferences, Telegram API fallback, no mandatory sound. | Platform support. | S |
| L12 | Режими доступності | High contrast, large text, color-safe and minimal motion presets. | Extensive QA. | L |

---

# M. Прогрес, ранги та досягнення

## Спільний фундамент категорії M

Server-authoritative progression events, separate learning mastery vs gamification, versioned policies, no spiritual worth scoring, idempotent celebrations і privacy-safe sharing.

| Код | Варіант | Як реалізувати | Залежності / ризики | Розмір |
|---|---|---|---|---|
| M1 | Детальна карта mastery | Aggregate objectives/topics/books and expose explainable evidence/progress. | E6, mappings. | L |
| M2 | Окремий ігровий рівень | New progression model independent from difficulty/mastery; migration old rank data. | Phase 1–2 authority. | L |
| M3 | Ранги | Versioned thresholds/titles with server events and non-spiritual naming review. | Economy/reward balance. | M |
| M4 | Навчальні досягнення | Achievement definitions consume lesson/review/memory events. | Idempotency. | M |
| M5 | Ігрові досягнення | Consume verified game outcomes only. | Phase 5 game authority. | M |
| M6 | Колекції досягнень | Group badges by theme/season; catalog and completion projection. | Content operations. | M |
| M7 | Статистика за період | Timezone-aware aggregated metrics, privacy retention and honest gaps. | Analytics platform. | L |
| M8 | Особисті рекорди | Verified best runs by mode/policy version; invalidated outcomes excluded. | Anti-cheat. | M |
| M9 | Порівняння із собою | Trend service compares compatible periods and avoids misleading small samples. | Analytics explanation. | M |
| M10 | Підсумок року | Server-generated recap from eligible data with opt-out/share privacy. | Seasonal job, minors. | L |
| M11 | Share-картки | Render service generates signed visual cards without exposing private stats by default. | Asset moderation. | M |
| M12 | Ненав’язливий streak | Qualifying activity policy, grace/recovery decision, calm loss UX and no punitive mechanics. | Product ethics. | M |

---

# N. Church/Classroom

## Спільний фундамент категорії N

Потребує organization tenant model, roles, billing/entitlements, data isolation, minors/privacy, audit, content namespaces, leader tools, exports and support operations.

| Код | Варіант | Як реалізувати | Залежності / ризики | Розмір |
|---|---|---|---|---|
| N1 | Кабінет церкви | Organization, admins, communities, subscription і tenant dashboard. | Multi-tenancy/security. | XL |
| N2 | Кабінет вчителя | Teacher role, class roster, assignments, reports and presenter links. | Minor safety. | XL |
| N3 | Приватні курси церкви | Organization-scoped content revisions and publication, inaccessible globally. | Content moderation/legal responsibility. | XL |
| N4 | Приватна база питань | Tenant namespace, import/review, private session pools and isolation tests. | Data leaks. | XL |
| N5 | Конструктор уроків без коду | Block editor using same schemas/preview/validation as Studio with limited permissions. | Complex authoring UX. | XL |
| N6 | Конструктор планів | Drag/drop plan graph, prerequisites, assignments, versioning. | Consistency/migrations. | L |
| N7 | Домашні завдання | Assignment/deadline/status/reminders and allowed submission types. | Privacy and teacher visibility. | L |
| N8 | Presenter Mode | Read-only projector route, remote controls, QR join and safe display. | Real-time sync. | L |
| N9 | QR-вхід у заняття | Signed short-lived links to lesson/room/class, membership checks. | Token sharing. | M |
| N10 | Звіт для вчителя | Role-scoped completion/aggregate weaknesses, no unrestricted private answers. | Privacy thresholds. | L |
| N11 | Відвідування | Optional event attendance with explicit policy and corrections/audit. | Sensitive behavioral data. | L |
| N12 | Експорт звітів | Async PDF/CSV/Excel jobs, permission watermark, expiry and audit. | Data leakage. | L |
| N13 | Сертифікати курсу | Organization-branded signed certificate from completion criteria. | Fraud, branding rights. | M |
| N14 | White-label | Tenant branding/config/custom domain while retaining platform security and disclosures. | Operational fragmentation. | XL |
| N15 | Ієрархія організації | Parent-child tenant graph, delegated admin and scoped data access. | Very complex authorization. | XL |

---

# O. Монетизація

## Спільний фундамент категорії O

Усі real-money моделі потребують окремого ADR. Internal coins і Telegram Stars залишаються різними ledger systems. Pay-to-win, продаж correctness/mastery/rank або прихована реклама заборонені.

| Код | Варіант | Як реалізувати | Залежності / ризики | Розмір |
|---|---|---|---|---|
| O1 | Магазин косметичних тем | Phase 6 catalog, wallet transaction, entitlement and restore. | Найбезпечніша monetization base. | L |
| O2 | Аватари й рамки | Cosmetic SKUs, preview, ownership and moderation. | No pay-to-win. | M |
| O3 | Premium-підписка | Entitlement period, renewal/reconciliation, feature matrix, grace/cancel/refund. | Telegram policies, support. | XL |
| O4 | Church/Classroom-підписка | Organization billing, seat/usage limits, admin and invoices where applicable. | Legal/tax/support. | XL |
| O5 | Telegram Stars | Official payment flow, invoice payload, webhook/reconciliation, refunds and ledger separation. | Current Telegram rules. | XL |
| O6 | Добровільна підтримка | Supporter product with clear non-purchase donation/support wording and cosmetic acknowledgment. | Platform policy/tax. | L |
| O7 | Спонсоровані серії | Sponsor contract, clear label, editorial independence and no hidden targeting. | Reputation/content conflicts. | XL |
| O8 | Партнерські програми | Curated outbound offers, disclosure, tracking minimization and approved partners. | Privacy and theological fit. | L |
| O9 | Telegram ad revenue | Platform-controlled eligibility/analytics; no custom ad injection into lessons. | Telegram availability/terms. | M |
| O10 | Marketplace курсів | Seller onboarding, review, payments/revenue share, refunds, moderation, licenses. | Separate platform-level undertaking. | XL |
| O11 | Організаційні пакети | Versioned plans, quotas, entitlements, upgrades/downgrades and support tooling. | Billing complexity. | XL |
| O12 | Заборона pay-to-win | Automated policy tests, catalog review and ADR invariant across all monetization. | Обов’язкове правило. | M |

---

# P. Telegram-функції

## Спільний фундамент категорії P

Використовувати official Mini App/Bot APIs, verified Telegram identity, deep-link validation, notification consent/rate limits, graceful browser fallback і current platform documentation.

| Код | Варіант | Як реалізувати | Залежності / ризики | Розмір |
|---|---|---|---|---|
| P1 | Розумні повідомлення | Notification preferences, scheduler, quiet hours, deduplication and meaningful triggers only. | Spam/retention. | L |
| P2 | Deep links | Signed/versioned routes with auth/membership/expiry handling and fallback. | Open redirect/token leaks. | M |
| P3 | QR-коди | Encode safe deep links, short expiry for sensitive rooms/invites. | Sharing/screenshot. | S |
| P4 | Telegram sharing | Native share actions with privacy preview and no hidden referral. | Platform support. | M |
| P5 | Бот-команди | Command router uses same backend services and permissions as Mini App. | No duplicate business logic. | M |
| P6 | MainButton/BackButton | Centralized Telegram adapter tied to route metadata and accessibility. | Conflicting in-app CTA. | M |
| P7 | Haptic | Shared wrapper, preference, event map and unsupported fallback. | Overuse. | S |
| P8 | Публічний канал | Editorial publishing workflow and cross-links, separate from private app data. | Operations/moderation. | M |
| P9 | Affiliate links | Official program integration, disclosure and attribution reconciliation. | Current Telegram terms. | L |
| P10 | Запуск із групового чату | Bot command/deep link creates authorized room/template, with host binding. | Group privacy and spam. | L |

---

# Q. Інші платформи

## Спільний фундамент категорії Q

Потрібні API-first architecture, shared domain contracts, platform adapters, responsive design, auth alternatives, sync and release-specific security. Не переносити client-trusted logic у нові оболонки.

| Код | Варіант | Як реалізувати | Залежності / ризики | Розмір |
|---|---|---|---|---|
| Q1 | Повноцінний вебсайт | Browser auth/session, responsive shell, same APIs and account linking. | Identity outside Telegram. | XL |
| Q2 | PWA | Manifest, service worker, install/offline policies and update lifecycle. | iOS limitations. | L |
| Q3 | Android-застосунок | Native wrapper or app with secure deep links, payments policy and push. | Store compliance. | XL |
| Q4 | iOS-застосунок | Native/wrapper implementation, Apple policies, purchases and account deletion. | Significant operations. | XL |
| Q5 | Desktop-host Kahoot | Desktop-focused host web/app, projector/window controls and realtime backend. | Separate QA matrix. | L |
| Q6 | Телевізійний режим | Remote-friendly focus navigation and read-only display. | Device fragmentation. | XL |
| Q7 | Планшетний режим | Responsive teacher/content layouts and split panes. | Design scope. | L |
| Q8 | Синхронізація пристроїв | Server-authoritative data, conflict rules, sessions and preferences. | Already foundational for accounts. | L |
| Q9 | Публічний API | OAuth/API keys, scopes, quotas, versioning, audit and developer docs. | High security/support risk. | XL |
| Q10 | Plugin system | Sandboxed extension contracts, signed packages, permissions and compatibility. | Very high security complexity. | XL |

---

# R. Мови та локалізація

## Спільний фундамент категорії R

Locale-aware schemas, immutable localized revisions, fallback rules, translation workflow, reviewer roles, search/tokenization, RTL readiness where relevant and translation licensing.

| Код | Варіант | Як реалізувати | Залежності / ризики | Розмір |
|---|---|---|---|---|
| R1 | Англійська | UI strings, content locale revisions, reviewers, search and Bible adapters. | Large content operations. | XL |
| R2 | Польська | Same localization pipeline with Polish language/editorial review. | Diаспора use case validation. | XL |
| R3 | Російська | Реалізовувати лише після explicit product decision; separate locale, no automatic fallback from Ukrainian. | Product/ethical decision. | XL |
| R4 | Інші мови | Add locale through repeatable onboarding checklist and minimum coverage. | Avoid unsupported partial product. | XL |
| R5 | AI-чернетка перекладу | AI creates draft locale revision, terminology/glossary checks and human approval. | Semantic/theological drift. | L |
| R6 | Локалізація питань | Adapt wording/options/difficulty, preserve objective/evidence and create new revision. | Not literal machine translation. | L |
| R7 | Різні біблійні переклади | Translation adapter, rights, reference mapping and user preference. | Licensing. | XL |
| R8 | Мультимовні спільноти | Community primary locale, content availability and per-user UI locale. | Mixed-language moderation. | L |

---

# S. Offline і продуктивність

## Спільний фундамент категорії S

Offline capability classification, immutable content versions, IndexedDB/cache, honest sync state, idempotent reconciliation, storage budgets, CDN, low-end mode and Phase 7 release testing.

| Код | Варіант | Як реалізувати | Залежності / ризики | Розмір |
|---|---|---|---|---|
| S1 | Offline-читання уроків | Download published lesson package/assets by version; invalidate safely on update. | Rights/storage. | L |
| S2 | Offline-практика | Pre-issued session/answer verification strategy or no-reward mode; sync with replay protection. | High cheating/conflict risk. | XL |
| S3 | Offline-аудіо | Download manager, entitlement and storage cleanup. | Platform limits. | L |
| S4 | Розумне кешування картинок | Responsive variants, cache headers, version hashes and device/network policy. | CDN. | M |
| S5 | Low-end режим | Capability detection/user preference disables blur, particles and heavy imagery. | Must remain visually coherent. | M |
| S6 | Оптимізація question bank | Server indexes/query pagination/session selection, no full JSON bundle. | Phase 2 data platform. | L |
| S7 | Progressive image loading | Placeholder/preview/full asset pipeline with reserved dimensions. | Avoid content flash. | M |
| S8 | Відновлення сесії | Persist server session/checkpoint and client route resume token. | Expiry/content revisions. | L |
| S9 | Background/reconnect | Recalculate from authoritative server time/state, deduplicate events. | Critical for Phase 5. | L |
| S10 | CDN | Versioned media delivery, signed URLs where needed, regional caching and purge. | Cost/security. | L |

---

# T. Доступність і безпека

## Спільний фундамент категорії T

Ці варіанти є переважно quality requirements, а не косметичними extras. Реалізація повинна входити до Definition of Done відповідних функцій.

| Код | Варіант | Як реалізувати | Залежності / ризики | Розмір |
|---|---|---|---|---|
| T1 | Screen reader | Semantic structure, labels, live announcements, focus management and tests. | Усі UI surfaces. | L |
| T2 | Текст до 200% | Responsive typography/layout, no clipped controls and device tests. | Design system. | M |
| T3 | Keyboard navigation | Logical tab order, visible focus, dialogs/traps and drag alternatives. | Web/desktop. | M |
| T4 | Reduced motion | OS/user setting, static final states and no required motion. | MOTION_SYSTEM. | M |
| T5 | Color-blind safe | Icon/text/shape redundancy, contrast and palette tests. | Answer/game states. | M |
| T6 | Приватність неповнолітніх | Private defaults, minimal profiles, guardian/org policy, retention and legal review. | Social/Classroom. | XL |
| T7 | Блокування й скарги | User block graph, report workflow, moderation action and audit. | Phase 5. | L |
| T8 | Anti-cheat | Verified auth, server timers/scoring/rewards, replay protection and anomaly review. | Phase 1–6. | XL |
| T9 | Audit log | Append-only security/content/economy/moderation actions with retention. | Phase 1. | L |
| T10 | Data export/delete | Authenticated jobs, dependency-aware deletion/anonymization and audit. | Privacy/legal. | XL |
| T11 | Backup/disaster recovery | Automated backups, restore drills, RPO/RTO and incident runbooks. | Phase 7. | XL |
| T12 | Licensing control | Rights metadata, expiry/removal, usage scopes and publication blockers. | Content/media. | L |

---

# U. Аналітика та керування продуктом

## Спільний фундамент категорії U

Privacy-first event taxonomy, consent, data minimization, stable IDs, server truth, retention, dashboards, experiment governance and no raw spiritual reflections/notes.

| Код | Варіант | Як реалізувати | Залежності / ризики | Розмір |
|---|---|---|---|---|
| U1 | Learning analytics | Aggregate lesson/review/mastery outcomes, cohorts only with safe thresholds. | Correct event model. | L |
| U2 | Question analytics | C16 projections, quality alerts and revision comparison. | Privacy/sample bias. | L |
| U3 | Game analytics | Mode completion, difficulty, latency, errors and verified outcomes. | Avoid addictive optimization. | L |
| U4 | Community analytics | Membership/activity aggregates respecting visibility and minors. | High privacy risk. | L |
| U5 | Funnel analytics | Defined flows, drop-off and errors without unnecessary personal content. | Consent/retention. | M |
| U6 | A/B testing | Feature flags, assignment, metrics and ethics review; never test biblical truth. | Statistical rigor. | L |
| U7 | Feature flags | Server/client flag service, targeting rules, audit, kill switches. | Foundational. | L |
| U8 | Admin dashboard | Role-protected operational views for users/content/jobs/reports/payments. | Sensitive data/security. | XL |
| U9 | Support tools | Search by safe identifiers, ledger/session/event history and audited actions. | Staff permissions. | L |
| U10 | Incident dashboard | Health, API, Socket.IO, jobs, payments, publications, alerts and runbooks. | Observability platform. | L |

---

# V. Експериментальні далекі напрями

## Спільний фундамент категорії V

Ці можливості не повинні блокувати core product. Перед discovery потрібні окремі proof-of-concept, device/performance research, theological/editorial review, licensing і чітка відповідь, яку проблему користувача вони вирішують.

| Код | Варіант | Як реалізувати | Залежності / ризики | Розмір |
|---|---|---|---|---|
| V1 | Інтерактивні 3D-карти | WebGL/3D tiles, canonical geo data, low-end fallback and asset streaming. | Very high performance/content cost. | XL |
| V2 | 3D храм/скинія | Reviewed 3D model, evidence annotations, guided tour and static alternative. | Archaeological uncertainty. | XL |
| V3 | AR-карти | Native/WebXR prototype, placement controls and privacy-safe camera handling. | Platform fragmentation. | XL |
| V4 | Інтерактивні історії | Branching exploration that never changes canonical biblical events; choices reveal context, not alternate Scripture. | Narrative/theological risk. | XL |
| V5 | AI-анімація сцен | Generated video drafts with frame consistency, historical review, disclosure and no auto-publish. | Cost, artifacts, misrepresentation. | XL |
| V6 | Віртуальний музей | Curated artifact/period exhibits with sources, 3D/media and accessibility. | Licensing and scholarly review. | XL |
| V7 | Археологічний режим | Reviewed articles, maps, finds, uncertainty and external citations. | Source quality. | XL |
| V8 | Research mode | Licensed commentaries, original-language tools, cross references and advanced search. | Rights and doctrinal plurality. | XL |
| V9 | Відкрита авторська платформа | Creator onboarding, sandboxed authoring, review, rights, moderation and revenue policy. | Platform-scale risk. | XL |
| V10 | Екосистема інтеграцій | Public APIs/webhooks/plugins with scopes, contracts, certification and support. | Security and long-term compatibility. | XL |

---

## 4. Рекомендована послідовність discovery, якщо власник продукту почне вибирати

Це не roadmap, а безпечний порядок оцінювання залежностей:

1. **Контент і питання:** C, D, B.
2. **Навчальна ефективність:** E і M.
3. **Візуальні матеріали:** A та частково K.
4. **Групові функції:** G, H, I.
5. **Персоналізація й economy:** L, O.
6. **Church/Classroom:** N.
7. **Платформи, offline і масштабування:** P, Q, R, S.
8. **Обов’язкове quality hardening:** T, U.
9. **Експериментальні напрями:** V.

---

## 5. Шаблон вибору опції власником продукту

```text
Selected option: <CODE — NAME>
Decision: selected | approved | deferred | rejected
Reason:
Target user:
Desired outcome:
Must-have scope:
Explicitly out of scope:
Target horizon / Phase:
Monetization impact:
Privacy/minors impact:
Content/theological review:
Budget/time constraint:
```

Після цього AI-агент готує окремий execution brief, але не переписує весь каталог і не створює новий master roadmap.

---

## 6. Загальний Definition of Done для майбутньої опції

Опція може отримати статус `implemented` лише коли:

- є явне рішення власника й за потреби ADR;
- scope зіставлено з актуальним кодом і Phase dependencies;
- дані, API, permissions і server authority визначені;
- migrations, feature flag, rollout і rollback реалізовані;
- контент/media/AI проходять review і publication rules;
- security, privacy, minors, licensing і moderation перевірені;
- normal/reduced motion, accessibility і low-end states працюють;
- unit/integration/security/E2E/manual tests зелені;
- observability і support path існують;
- документація синхронізована;
- немає fake/demo behavior у production;
- у PR наведено evidence, а не лише позначку `completed`.
