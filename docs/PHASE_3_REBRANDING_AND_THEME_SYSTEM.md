# Phase 3 — Rebranding and Theme System

> **Статус:** обов’язкова domain-специфікація Phase 3 — Learning-First Product Rebuild  
> **Візуальне рішення:** затверджено власником продукту 2026-08-02  
> **Основна тема:** `Світло`  
> **Цільова платформа:** Telegram Mini App і сучасний мобільний веб  
> **Пов’язані документи:** [`DESIGN_RULES.md`](./DESIGN_RULES.md), [`MOTION_SYSTEM.md`](./MOTION_SYSTEM.md)  
> **Межа відповідальності:** Phase 3 створює дизайн-систему і безкоштовну базову тему; Phase 6 реалізує каталог, придбання та entitlements для додаткових тем.

---

# 1. Призначення

Цей документ фіксує канонічний напрям ребрендингу Bible Games як частину **Phase 3 — Learning-First Product Rebuild**.

Ребрендинг не є набором окремих макетів, кнопок або декоративних ідей. Він повинен створити одну цілісну систему, через яку будуються всі екрани:

- головна;
- навчання;
- уроки;
- практика;
- результати правильної та неправильної відповіді;
- прогрес;
- профіль;
- налаштування;
- крамниця;
- спільноти;
- виклики;
- Kahoot-подібні кімнати;
- «Мільйонер»;
- інші поточні та майбутні режими.

Візуальні референси, затверджені власником продукту, визначають:

- кольорове відчуття;
- мінімалізм;
- преміальність;
- теплий фон;
- характер типографіки;
- м’яку глибину поверхонь;
- стриману духовну атмосферу;
- спосіб поєднання навчання і легкої гейміфікації.

Вони **не визначають автоматично**:

- точну кількість вкладок нижньої навігації;
- назви маршрутів;
- склад даних на конкретному екрані;
- бізнес-логіку;
- нагороди;
- доступність функцій;
- остаточний порядок розділів.

Інформаційна архітектура береться з канонічної специфікації, фактичного коду та продуктового рішення Phase 3. Заборонено механічно копіювати кнопки або структуру референсного зображення, якщо вони суперечать продукту.

---

# 2. Поточний baseline і причина міграції

## 2.1. Поточний app shell

На перевіреному baseline `Layout.tsx` використовує чотири нижні вкладки:

- `Головна`;
- `Гра`;
- `Крамниця`;
- `Профіль`.

Phase 3 може змінити app shell відповідно до learning-first архітектури, але це має бути окрема контрольована міграція з redirects, analytics, feature flag і rollback. Ребрендинг не повинен непомітно змінювати навігацію лише через те, що інша структура присутня у макеті.

## 2.2. Поточна тема

У коді:

- `DEFAULT_COSMETIC_THEME_ID = 'classic'`;
- `classic` є темною темою;
- тема застосовується через `applyCosmeticThemeById()`;
- runtime шар уже задає CSS variables;
- поточна модель теми містить `background`, `surface`, `primary`, `accent`, `text`;
- похідні значення формуються в `cosmeticTheme.ts`.

Цю основу треба **еволюційно розширити**, а не викинути. Проте поточна модель занадто вузька для великої кількості якісних тем і не відокремлює достатньо семантичних ролей.

## 2.3. Проблеми поточного візуального напряму

- темна `classic` не відповідає затвердженій основній світлій ідентичності;
- історична назва `--gold` використовується як універсальний primary token;
- частина похідних CTA створює надмірно активні градієнти;
- glassmorphism може використовуватися ширше, ніж потрібно мінімалістичному продукту;
- окремі екрани мають різні card, CTA і spacing patterns;
- theme contract недостатній для imagery, elevation, typography mood і component variants;
- без чітких обмежень майбутні платні теми можуть перетворитися на різні несумісні UI.

## 2.4. Міграційний принцип

Phase 3 не робить різкий rewrite усіх стилів в одному коміті. Потрібен порядок:

1. зафіксувати semantic token contract;
2. додати compatibility aliases для старих CSS variables;
3. створити тему `Світло`;
4. перевести shared primitives;
5. перевести app shell;
6. мігрувати core learning flow;
7. мігрувати secondary screens;
8. перевірити legacy themes;
9. прибрати deprecated aliases лише після coverage і visual regression tests.

---

# 3. Канонічна візуальна ідентичність

## 3.1. Формула бренду

> **Bible Games = premium spiritual minimalism + learning-first clarity + restrained game motivation.**

Продукт повинен відчуватися як:

- дорогий і добре спроєктований мобільний застосунок;
- спокійний простір для вивчення Біблії;
- сучасний Telegram Mini App;
- продукт із духовною теплотою без візуального пафосу;
- навчальна система з легкою, зрілою гейміфікацією.

Продукт не повинен виглядати як:

- гучна casual-гра;
- дитячий arcade UI;
- шаблонний фінансовий dashboard;
- застарілий церковний сайт;
- маркетинговий landing page всередині застосунку;
- набір випадкових карток без ієрархії;
- демонстрація AI-ілюстрацій замість зрозумілого UX;
- копія Apple, Kahoot або іншого бренду.

## 3.2. Основні відчуття

Кожен екран повинен передавати щонайменше три з п’яти характеристик:

1. **Світло** — теплий простір, чистота, повітря.
2. **Спокій** — мінімум шуму, передбачувана ієрархія.
3. **Гідність** — стримана духовність, відсутність дешевої декоративності.
4. **Ясність** — користувач одразу розуміє наступну дію.
5. **Зростання** — прогрес відчутний, але не агресивний.

## 3.3. Apple-inspired, але не Apple-copy

Дозволено наслідувати загальні принципи якісного iOS UX:

- повітря;
- сильну інформаційну ієрархію;
- м’які поверхні;
- передбачувані компоненти;
- короткі анімації;
- чіткі стани;
- великі touch targets;
- спокійні системні патерни.

Заборонено:

- копіювати Apple assets, logos або proprietary screens;
- імітувати системні діалоги так, що користувач не відрізняє їх від Telegram/iOS;
- переносити чужу структуру продукту без потреби;
- використовувати декоративний blur усюди лише для схожості.

---

# 4. Theme 01 — «Світло»

## 4.1. Роль

`Світло` — канонічна основна тема Bible Games.

Вона:

- безкоштовна;
- доступна кожному користувачеві;
- застосовується за замовчуванням для нових користувачів;
- використовується як baseline для visual regression;
- є головним прикладом для всіх компонентів;
- не може бути видалена з каталогу;
- не може стати платною в майбутньому;
- повинна працювати без завантаження важких theme assets.

## 4.2. Stable identifier

Цільовий stable ID:

```text
light
```

Display name:

```text
Світло
```

Під час міграції:

- існуюча `classic` не видаляється;
- користувачі не втрачають уже вибрану тему;
- нові користувачі та профілі без валідної теми отримують `light`;
- `classic` може лишитися безкоштовною legacy alternative;
- зміна default ID має schema/migration version;
- до завантаження профілю fallback також повинен бути `light`, щоб не було FOUC із темної на світлу тему.

## 4.3. Базова палітра

Наведені значення — канонічний стартовий набір Phase 3. Допускається невелике коригування після contrast testing, але не зміна загального напряму без ADR.

| Семантична роль | Target value | Призначення |
|---|---:|---|
| `bg.app` | `#F7F4EE` | теплий ivory canvas |
| `bg.surface` | `#FFFEFC` | основні картки |
| `bg.surfaceSubtle` | `#F1EDE6` | вкладені й неактивні блоки |
| `bg.elevated` | `#FFFFFF` | modal, sheet, floating surface |
| `text.primary` | `#13294B` | основний deep navy текст |
| `text.secondary` | `#667085` | описи й meta |
| `text.muted` | `#8A8F98` | disabled / допоміжний текст |
| `brand.primary` | `#132F57` | CTA, active nav, strong emphasis |
| `accent.spiritual` | `#C59A3D` | тепле золото, progress, spiritual accents |
| `accent.spiritualSoft` | `#D8B96B` | м’які іконки й лінії |
| `border.soft` | `#E7E1D8` | card borders і dividers |
| `border.strong` | `#D8D0C4` | interactive outline |
| `shadow.color` | `rgba(35, 43, 57, 0.08)` | спокійна глибина |
| `overlay.hero` | ivory-to-transparent | читабельність hero content |

## 4.4. Контраст navy і gold

- Navy є основним функціональним кольором.
- Gold є акцентом, а не основним текстовим кольором.
- Gold не використовується для довгого body text.
- Gold не повинен бути єдиним способом показати selected, warning або progress.
- Primary CTA у темі `Світло` переважно navy, а не gold gradient.
- Gold використовується для progress fill, kicker, achievement accents, spiritual iconography та невеликих highlights.

## 4.5. Фон

Фон не повинен бути чистим холодним `#FFFFFF` на всьому екрані.

Він має створювати відчуття теплого premium canvas через:

- ivory base;
- дуже слабкий tonal gradient;
- локальні м’які світлові переходи;
- відсутність видимого noise texture;
- відсутність контрастних pattern;
- стабільну читабельність у Telegram WebView.

Декоративний фон не може:

- знижувати contrast;
- створювати banding;
- збільшувати initial bundle значними растровими файлами;
- рухатися без поваги до reduced motion;
- конкурувати з біблійним текстом.

---

# 5. Семантична token architecture

## 5.1. Принцип

Компоненти не повинні знати назви конкретних кольорів. Вони використовують лише семантичні ролі.

Заборонено:

```css
color: #13294b;
background: #f7f4ee;
box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
```

Потрібно:

```css
color: var(--text-primary);
background: var(--bg-app);
box-shadow: var(--shadow-card);
```

## 5.2. Обов’язкові групи токенів

### Background

```text
--bg-app
--bg-surface
--bg-surface-subtle
--bg-elevated
--bg-inverse
--bg-scrim
```

### Text

```text
--text-primary
--text-secondary
--text-muted
--text-inverse
--text-link
```

### Brand і accent

```text
--brand-primary
--brand-primary-hover
--brand-primary-pressed
--on-brand-primary
--accent-spiritual
--accent-spiritual-soft
--accent-spiritual-bg
```

### Border

```text
--border-soft
--border-default
--border-strong
--border-focus
```

### State

```text
--state-success
--state-success-bg
--state-danger
--state-danger-bg
--state-warning
--state-warning-bg
--state-info
--state-info-bg
```

### Component roles

```text
--button-primary-bg
--button-primary-text
--button-secondary-bg
--button-secondary-text
--button-secondary-border
--card-bg
--card-border
--card-shadow
--nav-bg
--nav-active
--nav-inactive
--progress-track
--progress-fill
--input-bg
--input-border
--focus-ring
```

### Hero і imagery

```text
--hero-overlay-start
--hero-overlay-end
--hero-image-opacity
--illustration-tint
```

## 5.3. Compatibility aliases

Під час Phase 3 старі токени не прибираються одразу. Вони мапляться на нові:

```css
--bg: var(--bg-app);
--surface: var(--bg-surface);
--text: var(--text-primary);
--text-muted: var(--text-secondary);
--text-dim: var(--text-muted);
--gold: var(--accent-spiritual);
--gold-light: var(--accent-spiritual-soft);
--heading: var(--text-primary);
--cta-bg: var(--button-primary-bg);
--on-primary: var(--button-primary-text);
```

Новий код не повинен додавати залежність від deprecated aliases.

## 5.4. Theme contract evolution

Поточний `CosmeticTheme.preview` недостатній як повний runtime contract. Phase 3 повинен визначити versioned theme schema, наприклад:

```ts
interface ThemeDefinitionV2 {
  schemaVersion: 2;
  id: string;
  title: string;
  description: string;
  mode: 'light' | 'dark';
  palette: {
    bgApp: string;
    bgSurface: string;
    bgSurfaceSubtle: string;
    textPrimary: string;
    textSecondary: string;
    brandPrimary: string;
    accentSpiritual: string;
    borderSoft: string;
  };
  elevation: {
    cardShadow: string;
    modalShadow: string;
  };
  imagery?: {
    heroTone: string;
    tint: string;
    assetSetId?: string;
  };
  typography?: {
    displayTone?: 'classic' | 'quiet' | 'modern';
  };
  minAppVersion?: string;
}
```

Це концептуальна модель. Остаточна схема формується у Phase 3 після audit усіх споживачів.

---

# 6. Типографіка

## 6.1. Шрифтове поєднання

Зберігається сильна частина поточної системи:

- `Cormorant Garamond` — display/serif;
- `Source Sans 3` — UI/sans-serif;
- system fallback — для стабільності до завантаження font.

## 6.2. Serif використовується лише для змістовної ієрархії

Дозволено:

- назва продукту;
- назва сторінки;
- назва навчального плану;
- головне питання;
- назва hero-card;
- великий milestone.

Не використовувати serif для:

- довгих пояснень;
- кнопок;
- input labels;
- tab labels;
- timer;
- технічних metadata;
- дрібного тексту;
- dense tables.

## 6.3. Візуальний принцип

- великий serif headline створює духовну гідність;
- sans-serif UI забезпечує читабельність;
- uppercase застосовується лише для коротких kicker;
- letter spacing не повинен робити український текст неприродним;
- довгі біблійні цитати не подаються надмірно декоративним шрифтом.

## 6.4. Responsive type

- використовувати `clamp()` для великих заголовків;
- перевіряти ширини 320, 360, 390, 430 і 480 CSS px;
- заголовок не повинен створювати горизонтальний scroll;
- UI має витримувати збільшення тексту щонайменше до 200%;
- довгі українські слова не обрізаються без доступного способу прочитати повний текст.

---

# 7. Простір, сітка і композиція

## 7.1. Загальний принцип

Мінімалізм створюється не відсутністю контенту, а правильною ієрархією та достатніми відступами.

## 7.2. Layout

- одна основна вертикальна колонка;
- max-width відповідає Telegram mobile use case;
- основні CTA в зоні одного великого пальця;
- sticky actions не перекривають content;
- safe-area підтримується зверху і знизу;
- card grid використовується лише коли елементи справді рівнозначні;
- не більше одного dominant hero-block на першому viewport;
- secondary actions не конкурують із primary CTA.

## 7.3. Spacing

Базова шкала може лишитися кратною 4, але Phase 3 повинен стандартизувати реальне застосування:

```text
4, 8, 12, 16, 20, 24, 32, 40, 48
```

Рекомендовані ролі:

- 4–8 px: icon/text internal gap;
- 12 px: compact row gap;
- 16 px: regular component padding;
- 20–24 px: card padding;
- 24–32 px: section spacing;
- 40–48 px: major screen separation.

Заборонено зменшувати відступи лише для того, щоб умістити більше карток на одному екрані.

---

# 8. Поверхні, картки й elevation

## 8.1. Картки

Основна картка:

- тепла біла surface;
- тонкий border;
- м’яка коротка shadow;
- radius переважно 18–24 px;
- достатній внутрішній padding;
- чітка content hierarchy;
- без декоративного glow за замовчуванням.

## 8.2. Card variants

Потрібні спільні primitives:

- `HeroCard`;
- `StandardCard`;
- `CompactCard`;
- `ListCard`;
- `MetricCard`;
- `FeedbackCard`;
- `StoreItemCard`;
- `CommunityCard`;
- `ModalSurface`.

Кожен variant має визначені:

- radius;
- padding;
- border;
- shadow;
- typography slots;
- interactive states;
- loading skeleton;
- disabled state.

## 8.3. Glassmorphism

Glass не є default surface.

Дозволений лише:

- у невеликому overlay поверх hero imagery;
- у transient floating control;
- якщо contrast і performance перевірені.

Заборонений:

- на кожній картці;
- під довгим текстом;
- як заміна нормального hierarchy;
- на слабких пристроях без fallback;
- якщо blur створює візуальну каламутність.

## 8.4. Тіні

Тіні мають показувати elevation, а не декоративність.

- card shadow — дуже слабка;
- modal shadow — сильніша, але без чорного halo;
- primary button може мати мінімальну shadow;
- gold glow не використовується як universal effect;
- dark themes отримують окремо перевірену elevation model.

---

# 9. Кнопки, inputs і controls

## 9.1. Primary CTA

У `Світло`:

- deep navy fill;
- світлий текст;
- без aggressive gradient;
- radius узгоджений із системою;
- min-height 48 px;
- чіткий pressed state;
- visible focus ring;
- disabled state не визначається лише opacity.

## 9.2. Secondary CTA

- surface або transparent background;
- navy text;
- soft border;
- не конкурує з primary;
- може містити іконку, якщо вона додає зміст.

## 9.3. Gold action

Gold button не є типовим primary action. Він може використовуватися для:

- premium preview;
- spiritual accent action;
- selected theme preview;
- achievement claim.

Перед використанням перевіряється contrast.

## 9.4. Inputs

- великі touch targets;
- surface або subtle surface;
- placeholder має достатній contrast;
- focus ring помітний;
- error має текст та icon, а не лише червону рамку;
- Telegram keyboard не перекриває active field або CTA.

## 9.5. Segmented controls

- використовуються лише для 2–4 взаємовиключних опцій;
- active state navy;
- неактивні опції залишаються читабельними;
- довгі labels не стискаються до непридатного стану;
- на вузькому екрані допускається інший control.

---

# 10. Навігація

## 10.1. Візуальний стиль

Нижня навігація:

- одна суцільна surface;
- без випадкових вертикальних divider між останніми пунктами;
- active icon і label — navy або theme primary;
- inactive — muted neutral;
- safe-area inset;
- однакові icon box і baseline;
- label не стрибає при active state;
- не використовує золото як єдиний selected signal.

## 10.2. Структура навігації

Структура не копіюється з референсів. Вона визначається canonical Phase 3 product architecture.

Цільова learning-first навігація в master specification:

- `Сьогодні`;
- `Навчання`;
- `Гра`;
- `Прогрес`;
- `Профіль`.

Поточний code baseline має інший набір. Перехід є product migration і потребує:

- route map;
- legacy redirects;
- analytics mapping;
- deep-link verification;
- Telegram BackButton behavior;
- accessibility labels;
- feature flag;
- rollback.

Крамниця не повинна витісняти core learning tab лише для збільшення продажів. Вона доступна через Profile, Home secondary action або іншу затверджену точку входу.

---

# 11. Іконографіка

## 11.1. Стиль

- один icon family;
- outline-first;
- stroke приблизно 1.5–2 px при стандартному розмірі;
- rounded або оптично м’які кути;
- однаковий optical weight;
- filled version лише для active або статусу;
- духовні символи використовуються стримано.

## 11.2. Колір

- active navigation — navy;
- default UI — text secondary;
- spiritual/decorative — gold;
- success/danger — semantic state colors;
- не змішувати три акцентні кольори в одному control.

## 11.3. Символи

Дозволені як змістовні мотиви:

- відкрита Біблія;
- хрест;
- голуб;
- оливкова гілка;
- світильник;
- шлях;
- щит;
- корона;
- ліра;
- руки в молитві.

Символ не повинен бути випадковою прикрасою або створювати богословсько недоречне твердження.

---

# 12. Ілюстрації та hero imagery

## 12.1. Роль

Ілюстрація підтримує зміст, але не замінює його.

Рекомендовані мотиви:

- хрест на пагорбі;
- світанок;
- стежка;
- відкрита Біблія;
- голуб;
- ковчег;
- ліхтар;
- море;
- гори;
- оливкові гілки;
- м’які біблійні ландшафти.

## 12.2. Стиль

- muted;
- soft light;
- тепла нейтральна палітра;
- atmospheric depth;
- без cartoon look;
- без надмірного photorealism, що конкурує з UI;
- без видимих AI artifacts;
- без псевдоісторичної впевненості там, де образ є художньою інтерпретацією.

## 12.3. Обмеження

- переважно одна значуща hero image на screen;
- текст завжди має overlay/контрастний простір;
- важливий об’єкт не ховається під текстом;
- ілюстрація має responsive crop;
- asset має визначені width/height;
- lazy loading поза first viewport;
- compressed modern format;
- fallback без imagery;
- screen не втрачає функціональність при помилці завантаження.

## 12.4. Контентна чутливість

Зображення Ісуса, біблійних персонажів і подій потребують редакторської політики. Заборонено використовувати випадкові AI-зображення як фактичну реконструкцію без маркування художнього характеру.

---

# 13. Гейміфікація

## 13.1. Роль

Гейміфікація мотивує до навчання, але не домінує над Писанням.

Дозволені елементи:

- progress bar;
- рівень;
- XP;
- streak;
- achievements;
- milestones;
- group challenge;
- restrained celebration.

## 13.2. Візуальні правила

- один головний progress signal на section;
- gold accent для прогресу;
- confetti лише для справді важливої події;
- без постійного pulsation;
- без flashing;
- без fake urgency;
- без shame messaging;
- rank не повинен перекривати learning outcome.

## 13.3. Game modes

Kahoot-подібний режим може використовувати функціональні кольорові answer tiles, оскільки це частина game semantics. Проте:

- app shell лишається впізнаваним;
- кольори мають accessible labels/shapes;
- відповідь не визначається лише кольором;
- timer не створює шкідливе flashing;
- результати й explanation повертаються до загальної theme system.

«Мільйонер» може мати особливу атмосферу, але не створює окрему несумісну дизайн-систему.

---

# 14. Стани відповіді та feedback

## 14.1. Правильна відповідь

- selected option має success background, border, icon і label;
- коротке `Правильно!`;
- explanation або biblical reference;
- reward показується secondary;
- наступна дія чітка;
- success animation поважає reduced motion.

## 14.2. Неправильна відповідь

- selected wrong option позначається danger state;
- correct option також явно показується;
- feedback не соромить користувача;
- пояснюється причина;
- biblical reference доступний;
- дозволено перейти до докладного пояснення;
- колір дублюється icon і text.

## 14.3. Нейтральні стани

Для кожного екрану:

- loading;
- empty;
- offline;
- retryable error;
- disabled;
- locked;
- unavailable;
- completed;
- archived.

Усі стани входять у component contract і theme testing.

---

# 15. Motion

## 15.1. Принцип

Motion пояснює зміну стану, а не прикрашає кожну дію.

- micro interaction: 100–180 ms;
- card/sheet transition: 180–280 ms;
- progress: smooth, але не повільний;
- page transition: subtle fade/translate;
- no spring overshoot для spiritual reading surfaces;
- no autoplay parallax у hero imagery.

## 15.2. Reduced motion

При `prefers-reduced-motion`:

- page transitions мінімізуються;
- progress змінюється без довгої анімації;
- confetti вимикається;
- pulsing status вимикається;
- content залишається повністю зрозумілим.

---

## 15.3. Канонічна motion-специфікація

Повні transitions, timings, correct/wrong sequences, level/rank/achievement celebrations, Kahoot/«Мільйонер», authoritative triggers, reduced motion, low-end rules і phase allocation визначені в [`MOTION_SYSTEM.md`](./MOTION_SYSTEM.md).

Phase 3 повинна реалізувати motion foundation і core learning/account sequences. Multiplayer-specific sequences завершуються в Phase 5, purchase/payment sequences — у Phase 6, production hardening — у Phase 7. Заборонено локально змінювати цей розподіл без оновлення canonical docs.

# 16. Accessibility

Theme `Світло` є accessibility baseline.

Обов’язково:

- WCAG-oriented contrast review;
- 4.5:1 для regular text;
- 3:1 для large text та значущих UI boundaries, де застосовно;
- touch target мінімум 44×44 CSS px;
- focus visible;
- semantic headings;
- aria-label для icon-only controls;
- screen reader order відповідає visual order;
- selected/error/success не передаються лише кольором;
- text scaling до 200%;
- reduced motion;
- dark paid themes проходять ту саму перевірку;
- theme не може продаватися або публікуватися без accessibility audit.

Gold-on-ivory комбінація часто має недостатній contrast, тому gold не використовується для важливого дрібного тексту без перевірки.

---

# 17. Telegram Mini App requirements

- safe-area insets;
- `100dvh` і keyboard-safe layout;
- Telegram BackButton узгоджений із route stack;
- theme background синхронізує Telegram header/background colors;
- main CTA не конфліктує з Telegram MainButton, якщо він використовується;
- UI перевіряється в Android Telegram, iOS Telegram і browser fallback;
- не покладатися на hover;
- врахувати різні font rendering;
- app не копіює Telegram system controls так, що вони стають оманливими.

---

# 18. Shared component foundation

Phase 3 повинен створити або стандартизувати reusable primitives:

- `AppPage`;
- `PageHeader`;
- `SectionHeader`;
- `BottomNavigation`;
- `HeroCard`;
- `ContentCard`;
- `ListRow`;
- `PrimaryButton`;
- `SecondaryButton`;
- `IconButton`;
- `SearchField`;
- `SegmentedControl`;
- `ProgressBar`;
- `MetricTile`;
- `AchievementBadge`;
- `AnswerOption`;
- `AnswerFeedback`;
- `EmptyState`;
- `ErrorState`;
- `Skeleton`;
- `BottomSheet`;
- `ThemePreview`.

Не обов’язково створювати окремий файл для кожного primitive. Важливі stable API, accessibility і відсутність дублювання.

---

# 19. Порядок міграції екранів у межах Phase 3

Це workstreams однієї великої фази, а не окремі мікрофази.

## Foundation

- token contract;
- тема `Світло`;
- font loading;
- elevation;
- primitives;
- app shell;
- theme persistence;
- FOUC prevention;
- Telegram chrome sync.

## Core learning flow

- Today/Home;
- Learning hub;
- plan/module/lesson;
- practice;
- answer feedback;
- review mistakes;
- completion summary;
- progress.

## Account surfaces

- profile;
- settings;
- accessibility;
- theme selection;
- notifications/privacy.

## Existing game modes

- Play hub;
- «Мільйонер»;
- «Виживання»;
- Kahoot hub/room/display;
- result screens.

## Secondary product surfaces

- communities;
- challenges;
- playlists;
- shop preview;
- admin/content tools лише в рамках protected surface і без decorative consumer styling, що шкодить ефективності.

---

# 20. Quality gates і visual regression

## 20.1. Device matrix

Перевіряти щонайменше:

- 320×568;
- 360×800;
- 390×844;
- 412×915;
- 430×932;
- 480 px content width;
- Android Telegram WebView;
- iOS Telegram WebView;
- standalone browser.

## 20.2. Theme matrix

До завершення Phase 3:

- `Світло` — повна перевірка всіх core screens;
- `classic` — compatibility regression;
- щонайменше одна dark paid-theme candidate — contract validation;
- success/danger/warning/info;
- long Ukrainian text;
- missing imagery;
- offline/error/loading;
- large text;
- reduced motion.

## 20.3. Automated checks

- token lint або equivalent check на hardcoded colors;
- story/fixture coverage shared components;
- screenshot regression для critical flows;
- axe або equivalent accessibility checks;
- no horizontal overflow test;
- route smoke;
- theme switching test;
- persisted theme restore;
- invalid theme fallback;
- no FOUC smoke.

## 20.4. Manual review

Потрібен human review:

- чи справді UI мінімалістичний;
- чи gold не використаний надмірно;
- чи ілюстрація не перебиває текст;
- чи CTA очевидний;
- чи немає card overload;
- чи духовний тон поважний;
- чи gamification не стала головним змістом;
- чи всі екрани відчуваються одним продуктом.

---

# 21. Rollout і rollback

## 21.1. Feature flags

Рекомендовані flags:

- `rebrandThemeV2`;
- `learningShellV2`;
- `lightThemeDefault`.

Назви уточнюються в реалізації, але flags повинні мати owner, telemetry і removal date.

## 21.2. Rollout

- internal preview;
- screenshot/UX review;
- closed alpha;
- percentage rollout;
- new users first, якщо migration ризик високий;
- monitor errors, exits, session completion і theme restore;
- full rollout після evidence.

## 21.3. Rollback

Rollback повертає попередній shell/theme rendering без:

- втрати profile settings;
- втрати purchased themes;
- скидання progress;
- зміни economy;
- invalid route state.

Theme schema migration повинна бути backward-readable протягом rollout window.

---

# 21.4. Motion rollout

Motion rollout використовує ті самі feature flags, internal preview, closed alpha і rollback principles, що й visual rebrand. Rollback не може повторно запускати consumed celebrations, втрачати motion preference або змінювати authoritative progress/economy state.

# 22. Acceptance criteria Phase 3: rebranding

Ребрендинг вважається виконаним лише коли:

1. `Світло` є новою безкоштовною default theme.
2. Користувачі з existing theme не втрачають вибір або entitlement.
3. Fallback до завантаження профілю не створює dark-to-light flash.
4. Core screens використовують shared semantic tokens.
5. Нові компоненти не містять випадкових hardcoded brand colors.
6. Старі CSS aliases мають migration/deprecation plan.
7. Навігація відповідає canonical product architecture, а не копіює референсні макети.
8. Bottom navigation має стабільний layout і safe-area.
9. Hero imagery не блокує content і має fallback.
10. Correct/incorrect answer states доступні не лише за кольором.
11. Theme switching працює без перезавантаження та відновлюється після входу на іншому пристрої після server-authoritative profile migration.
12. `Світло`, `classic` і dark-theme candidate проходять component matrix.
13. Accessibility audit не має critical issues.
14. Critical screen visual regression стабільний.
15. UI перевірений у Telegram Android та iOS.
16. Bundle/image budgets не порушені.
17. Ребрендинг не змінює rewards, auth, scoring або payment logic.
18. Rollback перевірений.
19. `DESIGN_RULES.md` і canonical docs оновлені.
20. Власник продукту прийняв фінальний visual review.

---

# 23. Межа з Phase 6: платні теми

Phase 3 створює:

- theme schema;
- runtime renderer;
- default `Світло`;
- compatibility з legacy themes;
- theme preview component;
- accessibility і performance contract;
- local/dev fixtures;
- UI вибору вже доступних entitlement.

Phase 6 створює:

- server-authoritative catalog;
- ціни у внутрішніх монетах;
- wallet transaction;
- purchase command;
- entitlement grant;
- restore;
- availability windows;
- refund/reversal policy, якщо застосовно;
- purchase history;
- admin publication flow theme assets;
- anti-abuse;
- monetization analytics.

Phase 3 не повинна реалізовувати фальшиву клієнтську покупку лише для демонстрації магазину.

---

# 24. Майбутні theme directions

Назви нижче є design directions, а не затвердженим catalog/pricing:

- `Нічна молитва` — deep navy, moonlight, subdued gold;
- `Пустельний шлях` — sand, clay, copper;
- `Оливкова гілка` — ivory, olive, muted gold;
- `Царські псалми` — royal navy, restrained gold;
- `Ранкова благодать` — dawn ivory, blush, warm amber;
- `Ліхтар віри` — evening blue, amber light;
- `Ковчег` — wood, sand, misty blue;
- `Небесний спокій` — soft blue, pearl, silver-gold;
- існуючі `Генісаретське море`, `Едемський сад`, `Синайське одкровення`, `Небесний Єрусалим` — candidates for migration/audit, а не автоматично approved production products.

Усі теми повинні зберігати:

- layout;
- spacing;
- hierarchy;
- component behavior;
- accessibility;
- routes;
- UX logic;
- meaning of states.

Тема може змінювати:

- palette;
- surface mood;
- accent;
- elevation within limits;
- imagery asset set;
- decorative tint;
- preview visuals.

Тема не може змінювати:

- правильну відповідь;
- difficulty;
- reward;
- leaderboard advantage;
- touch target;
- information priority;
- availability основного навчання.

---

# 25. Out of scope Phase 3

- реальні покупки themes;
- prices і promotions;
- Telegram Stars;
- paid subscriptions;
- affiliate program;
- десятки готових themes;
- theme marketplace;
- user-generated CSS;
- remote arbitrary scripts/assets;
- зміна scoring через theme;
- pay-to-win;
- redesign protected admin tools лише заради декоративної відповідності consumer UI.

---

# 26. Definition of success

Phase 3 досягає мети, коли користувач відкриває Bible Games і відчуває один цілісний продукт:

- світлий;
- спокійний;
- дорогий;
- мінімалістичний;
- духовно теплий;
- зрозумілий;
- мотивуючий без тиску;
- стабільний у Telegram;
- готовий до великої кількості майбутніх тем без розвалу UX.

Саме тема `Світло` є першим і головним доказом, що theme architecture працює правильно.