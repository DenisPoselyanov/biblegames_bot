# DESIGN_RULES — канонічна дизайн-система Bible Games

> **Статус:** активне domain-джерело правди для UI, UX, themes і visual QA  
> **Канонічна фаза:** Phase 3 — Learning-First Product Rebuild  
> **Основна тема:** `Світло`  
> **Повна Phase 3 специфікація:** [`PHASE_3_REBRANDING_AND_THEME_SYSTEM.md`](./PHASE_3_REBRANDING_AND_THEME_SYSTEM.md)  
> **Канонічна motion-система:** [`MOTION_SYSTEM.md`](./MOTION_SYSTEM.md)

Цей документ замінює попередній напрям `Dark luxury / parchment gold` як головну ідентичність продукту. Темний `classic` не видаляється автоматично, але стає legacy/alternative theme. Основна візуальна система Bible Games тепер — **premium spiritual minimalism**.

---

# 1. Роль документа

`DESIGN_RULES.md` визначає:

- базову візуальну ідентичність;
- semantic tokens;
- типографіку;
- spacing;
- surfaces і elevation;
- компонентні патерни;
- правила ілюстрацій;
- game-mode exceptions;
- accessibility;
- theme architecture;
- visual QA.

Цей документ не визначає:

- бізнес-логіку;
- маршрути без узгодження з master specification;
- склад нагород;
- ціни;
- entitlement;
- payment flow;
- точну кількість navigation tabs лише на основі референсного макета.

Візуальні референси задають **стиль**, а не копію екрану.

---

# 2. Ключові файли поточної реалізації

| Роль | Файл |
|---|---|
| Static fallback tokens | `src/index.css` |
| Runtime theme application | `src/lib/cosmeticTheme.ts` |
| Theme definitions/catalog prototype | `src/data/cosmetics.ts` |
| react-vant mapping | `src/lib/vantTheme.ts` |
| react-vant provider | `src/components/VantProvider.tsx` |
| App shell CSS | `src/components/Layout.module.css` |
| Current app shell structure | `src/components/Layout.tsx` |

Поточний код використовує `DEFAULT_COSMETIC_THEME_ID = 'classic'`. Це baseline, а не фінальна вимога. Перехід на `light` виконується в Phase 3 з migration, fallback і visual tests.

---

# 3. Brand direction

## 3.1. Канонічна формула

> **Premium spiritual minimalism + learning-first clarity + restrained game motivation.**

## 3.2. Продукт має відчуватися

- світлим;
- теплим;
- спокійним;
- дорогим;
- сучасним;
- духовно делікатним;
- зрозумілим із першого погляду;
- ігровим лише настільки, наскільки це допомагає навчанню.

## 3.3. Продукт не має виглядати

- дитячою arcade-грою;
- casino-like reward app;
- фінансовим dashboard;
- старим церковним сайтом;
- суцільним glassmorphism;
- набором однакових карток;
- copy Apple/Kahoot;
- каталогом AI-зображень;
- темним luxury UI за замовчуванням.

## 3.4. Apple-inspired principle

Беремо:

- повітря;
- чітку ієрархію;
- передбачувану взаємодію;
- спокійні поверхні;
- великі touch targets;
- короткий motion;
- системність.

Не копіюємо:

- Apple assets;
- proprietary screen layouts;
- system dialogs;
- logos;
- чужу інформаційну архітектуру.

---

# 3.5. Motion relationship

`DESIGN_RULES.md` визначає вигляд станів, а `MOTION_SYSTEM.md` — їхню зміну в часі. Компонент не може вводити власні easing, celebration або correct/wrong sequence, якщо shared motion contract уже існує. Theme може змінювати палітру particles/glow, але не semantics, critical durations, reduced-motion behavior або blocking time.

# 4. Primary Theme — «Світло»

## 4.1. Ідентичність

```text
id: light
title: Світло
price: 0
availability: always
mode: light
```

## 4.2. Непорушні правила

- доступна всім;
- default для нових користувачів;
- не продається;
- не видаляється;
- є visual regression baseline;
- має працювати без premium assets;
- має fallback до завантаження профілю;
- не створює FOUC із темної теми.

## 4.3. Базова палітра

| Role | Token | Target |
|---|---|---:|
| App canvas | `--bg-app` | `#F7F4EE` |
| Main surface | `--bg-surface` | `#FFFEFC` |
| Subtle surface | `--bg-surface-subtle` | `#F1EDE6` |
| Elevated surface | `--bg-elevated` | `#FFFFFF` |
| Primary text | `--text-primary` | `#13294B` |
| Secondary text | `--text-secondary` | `#667085` |
| Muted text | `--text-muted` | `#8A8F98` |
| Brand navy | `--brand-primary` | `#132F57` |
| Spiritual gold | `--accent-spiritual` | `#C59A3D` |
| Soft gold | `--accent-spiritual-soft` | `#D8B96B` |
| Soft border | `--border-soft` | `#E7E1D8` |
| Strong border | `--border-strong` | `#D8D0C4` |

Значення можуть отримати невелику корекцію після contrast audit. Зміна загального напряму потребує ADR.

## 4.4. Колірна ієрархія

1. Navy — функціональний primary.
2. Warm ivory — основний фон.
3. White/cream — surfaces.
4. Gold — духовний і progress accent.
5. Semantic state colors — correct, wrong, warning, info.

Gold не є універсальним CTA і не використовується для довгого тексту.

---

# 5. Semantic tokens

## 5.1. Background

```css
--bg-app;
--bg-surface;
--bg-surface-subtle;
--bg-elevated;
--bg-inverse;
--bg-scrim;
```

## 5.2. Text

```css
--text-primary;
--text-secondary;
--text-muted;
--text-inverse;
--text-link;
```

## 5.3. Brand

```css
--brand-primary;
--brand-primary-hover;
--brand-primary-pressed;
--on-brand-primary;
--accent-spiritual;
--accent-spiritual-soft;
--accent-spiritual-bg;
```

## 5.4. Border and focus

```css
--border-soft;
--border-default;
--border-strong;
--border-focus;
--focus-ring;
```

## 5.5. Component roles

```css
--card-bg;
--card-border;
--card-shadow;
--button-primary-bg;
--button-primary-text;
--button-secondary-bg;
--button-secondary-text;
--button-secondary-border;
--nav-bg;
--nav-active;
--nav-inactive;
--progress-track;
--progress-fill;
--input-bg;
--input-border;
```

## 5.6. State tokens

```css
--state-success;
--state-success-bg;
--state-success-text;
--state-danger;
--state-danger-bg;
--state-danger-text;
--state-warning;
--state-warning-bg;
--state-info;
--state-info-bg;
```

State tokens можуть мати theme-aware корекцію, але значення стану не повинно змінюватися. Green завжди success, red завжди danger.

## 5.7. Hero/imagery

```css
--hero-overlay-start;
--hero-overlay-end;
--hero-image-opacity;
--illustration-tint;
```

---

# 6. Legacy compatibility

Під час міграції:

```css
--bg: var(--bg-app);
--surface: var(--bg-surface);
--surface-hover: var(--bg-surface-subtle);
--text: var(--text-primary);
--text-muted: var(--text-secondary);
--text-dim: var(--text-muted);
--gold: var(--accent-spiritual);
--gold-light: var(--accent-spiritual-soft);
--heading: var(--text-primary);
--cta-bg: var(--button-primary-bg);
--on-primary: var(--button-primary-text);
```

Правила:

- aliases тимчасові;
- новий код використовує нові tokens;
- alias removal має issue/owner/date;
- deprecated token usage перевіряється lint/check script;
- не робити global search-and-replace без visual review.

---

# 7. Theme schema

## 7.1. Current limitation

Поточний `CosmeticTheme.preview` містить лише:

- background;
- surface;
- primary;
- accent;
- text.

Цього недостатньо для великого theme catalog.

## 7.2. Target contract

Theme definition має бути versioned і містити:

- stable ID;
- display metadata;
- light/dark mode;
- semantic palette;
- elevation profile;
- imagery/tint profile;
- optional asset set;
- minimum app version;
- accessibility status;
- catalog status;
- preview data;
- schema version.

Приклад концептуальної TypeScript моделі наведений у `PHASE_3_REBRANDING_AND_THEME_SYSTEM.md`.

## 7.3. Theme invariants

Тема може змінювати:

- palette;
- surfaces;
- accent;
- elevation у дозволених межах;
- imagery tone;
- decorative tint.

Тема не може змінювати:

- layout;
- routes;
- component behavior;
- correct answer;
- reward;
- difficulty;
- information hierarchy;
- touch target;
- accessibility meaning;
- competitive advantage.

---

# 8. Typography

## 8.1. Font stacks

```css
--font-display: 'Cormorant Garamond', Georgia, serif;
--font-ui: 'Source Sans 3', system-ui, -apple-system, sans-serif;
```

## 8.2. Display font

Використовувати для:

- page title;
- hero title;
- main question;
- learning plan title;
- milestone.

Не використовувати для:

- button;
- input;
- dense list;
- timer;
- metadata;
- long explanation.

## 8.3. UI font

Використовувати для:

- body;
- labels;
- buttons;
- navigation;
- captions;
- statistics;
- settings;
- explanations.

## 8.4. Type scale

Рекомендована semantic scale:

```css
--text-xs: 0.75rem;
--text-sm: 0.875rem;
--text-md: 1rem;
--text-lg: 1.125rem;
--text-xl: 1.375rem;
--text-2xl: 1.75rem;
--text-3xl: clamp(2rem, 8vw, 3rem);
```

Не вводити випадкові off-scale values без documented reason.

## 8.5. Weight

- 400 — body;
- 500 — metadata;
- 600 — labels/secondary emphasis;
- 700 — CTA і important title;
- 800 — короткий stat/kicker лише за потреби.

## 8.6. Text resilience

- перевірити довгі українські назви;
- text scale 200%;
- no clipping;
- no fixed-height body text;
- no ellipsis для critical content;
- біблійна цитата має readable line-height.

---

# 9. Spacing and layout

## 9.1. Scale

```css
--space-1: 0.25rem;  /* 4 */
--space-2: 0.5rem;   /* 8 */
--space-3: 0.75rem;  /* 12 */
--space-4: 1rem;     /* 16 */
--space-5: 1.25rem;  /* 20 */
--space-6: 1.5rem;   /* 24 */
--space-8: 2rem;     /* 32 */
--space-10: 2.5rem;  /* 40 */
--space-12: 3rem;    /* 48 */
```

## 9.2. Layout rules

- mobile-first single column;
- no horizontal scroll;
- max content width відповідає Telegram Mini App;
- page horizontal padding 16–24 px залежно від width;
- one dominant hero per first viewport;
- major sections separated by 24–40 px;
- CTA in one-thumb reach;
- sticky actions account for tabbar and safe-area;
- no density reduction merely to fit more cards.

## 9.3. Safe area

```css
padding-top: max(var(--space-3), env(safe-area-inset-top));
padding-bottom: calc(var(--space-4) + env(safe-area-inset-bottom));
```

---

# 10. Radius and elevation

## 10.1. Radius

```css
--radius-sm: 8px;
--radius-md: 12px;
--radius-lg: 18px;
--radius-xl: 24px;
--radius-full: 9999px;
```

Pill використовується лише коли форма має зміст: filter chip, compact status, segmented item.

## 10.2. Shadows

```css
--shadow-card: 0 8px 24px rgba(35, 43, 57, 0.07);
--shadow-floating: 0 12px 32px rgba(35, 43, 57, 0.11);
--shadow-modal: 0 20px 56px rgba(35, 43, 57, 0.16);
```

Правила:

- тінь показує elevation;
- no black halo;
- no universal gold glow;
- dark themes мають власний audited profile;
- border + shadow не повинні створювати важку рамку.

---

# 11. Surface patterns

## 11.1. Standard card

- `--card-bg`;
- `--card-border`;
- `--card-shadow`;
- radius 18–24 px;
- padding 20–24 px;
- no decorative gradient by default.

## 11.2. Hero card

Містить:

- kicker;
- strong title;
- short explanation;
- progress або one primary action;
- restrained imagery;
- overlay for readability.

Hero не повинен містити 5 рівнозначних CTA.

## 11.3. List card

- rows мають stable min-height;
- divider не доходить під leading icon, якщо це покращує hierarchy;
- chevron лише коли row navigates;
- не додавати chevron до static info;
- entire row clickable, а не лише icon.

## 11.4. Metric cards

- число або значення головне;
- label короткий;
- icon secondary;
- не більше 4 компактних metrics в одному row на достатній ширині;
- на вузькому екрані grid adapts.

## 11.5. Glass

Glassmorphism — контрольований виняток, не основа системи.

Дозволено:

- overlay на hero image;
- floating transient control.

Заборонено:

- усі content cards;
- довгий текст;
- weak-device без fallback;
- blur заради декоративності.

---

# 12. Buttons

## 12.1. Primary

- navy fill;
- white/ivory text;
- min-height 48 px;
- visible pressed state;
- visible focus;
- no aggressive gradient;
- one primary action per local decision group.

## 12.2. Secondary

- surface or transparent;
- navy text;
- soft border;
- no stronger visual weight than primary.

## 12.3. Tertiary

- text/icon action;
- underline or state where needed;
- 44×44 interactive area even if visual glyph is smaller.

## 12.4. Gold/premium

Gold-filled control is reserved for premium/theme preview or special reward action and requires contrast test.

## 12.5. Destructive

- semantic danger;
- confirmation only for irreversible action;
- not hidden behind misleading neutral button.

---

# 13. Inputs and controls

## 13.1. Inputs

- min-height 48 px;
- sufficient placeholder contrast;
- visible focus;
- inline error text;
- icon does not replace label;
- keyboard-safe scroll.

## 13.2. Search

- clear button;
- accessible label;
- debounce only if server query;
- no fake search field that opens unrelated modal without indication.

## 13.3. Segmented control

- 2–4 options;
- selected navy;
- no tiny labels;
- responsive alternative on narrow width;
- arrow-key/keyboard support in web mode where applicable.

## 13.4. Toggle

- label describes resulting state;
- disabled reason visible;
- state not indicated only by color.

---

# 14. Navigation

## 14.1. Visual rules

Bottom navigation:

- one continuous surface;
- no accidental divider between `Прогрес` and `Профіль`;
- equal item distribution;
- stable icon size;
- stable label baseline;
- active navy/brand;
- inactive muted;
- safe-area bottom;
- no layout shift on selection.

## 14.2. Product structure

Reference screenshots do not define tabs. Master specification and Phase 3 decide the final learning-first navigation.

Current baseline and target differ; migration requires:

- route map;
- redirects;
- deep-link tests;
- Telegram BackButton behavior;
- analytics mapping;
- feature flag;
- rollback.

Крамниця не займає core learning tab лише для монетизації.

---

# 15. Iconography

- one icon family;
- outline-first;
- consistent 1.5–2 px optical stroke;
- navy active;
- gray inactive;
- gold spiritual/decorative;
- filled state only when meaningful;
- icon-only button has accessible name;
- no emoji as production icon unless content explicitly requires emoji.

Permitted motifs:

- Bible;
- cross;
- dove;
- lamp;
- shield;
- crown;
- branch;
- path;
- lyre;
- prayer hands.

Do not use sacred symbols as arbitrary confetti.

---

# 16. Imagery

## 16.1. Direction

- warm;
- soft;
- atmospheric;
- quiet;
- non-cartoonish;
- non-chaotic;
- supportive to content.

## 16.2. Suitable motifs

- cross on hill;
- sunrise;
- path;
- ark;
- open Bible;
- dove;
- lantern;
- sea;
- mountains;
- olive branches.

## 16.3. Technical requirements

- modern compressed format;
- width/height reserved;
- responsive crop;
- lazy loading outside first viewport;
- graceful fallback;
- contrast overlay;
- no functional dependence on image;
- image budget documented.

## 16.4. Editorial requirements

- visible AI artifacts rejected;
- biblical/historical depiction reviewed;
- artwork is not presented as factual reconstruction;
- no image that undermines theological neutrality without review.

---

# 17. Progress and gamification

## 17.1. Progress

- track neutral;
- fill gold/accent;
- number available when useful;
- no misleading animation;
- server-authoritative value.

## 17.2. XP and levels

- secondary motivation;
- never more prominent than next learning action;
- no pay-to-win appearance;
- reward animation restrained.

## 17.3. Streak

- motivational, not punitive;
- no shame language;
- missed day does not trigger aggressive red alert;
- flame icon is optional, not mandatory.

## 17.4. Achievements

- consistent badge frame;
- semantic rarity only if it has product meaning;
- no fake scarcity;
- locked state accessible.

---

# 18. Practice answer states

## 18.1. Neutral

- surface background;
- clear border;
- large tap area;
- no hint of correct position.

## 18.2. Selected

- selected state visible before submission;
- no accidental submit on scroll;
- keyboard/focus support.

## 18.3. Correct

- success border + background;
- check icon;
- `Правильно!` text;
- explanation/reference;
- reward secondary.

## 18.4. Incorrect

- selected wrong answer danger state;
- correct answer success state;
- `Неправильно` without shame;
- explanation/reference;
- next action.

No answer state may rely on color alone.

---

# 19. Game mode exceptions

## 19.1. Kahoot-like mode

Allowed:

- red/blue/yellow/green answer tiles;
- geometric answer symbols;
- stronger timer/score hierarchy.

Required:

- shape + text labels;
- accessible contrast;
- no flashing;
- theme-compatible shell;
- result/explanation returns to common system.

## 19.2. Millionaire

Allowed:

- prize ladder;
- gold accent;
- special question composition.

Required:

- same typography family;
- same shared controls;
- same accessible answer states;
- no separate unrelated design system.

## 19.3. Admin/content tools

Protected tools prioritize density and accuracy. They use the same tokens but do not need consumer hero imagery or decorative spiritual visuals.

---

# 20. Motion

```css
--motion-micro: 120ms;
--motion-fast: 180ms;
--motion-normal: 240ms;
--motion-page: 280ms;
```

Rules:

- motion explains state change;
- no permanent pulse;
- no autoplay parallax;
- no bounce-heavy spiritual reading UI;
- reduced motion disables nonessential effects;
- progress animation does not misrepresent value.

---

# 21. Accessibility

Minimum requirements:

- regular text contrast target 4.5:1;
- large text/UI boundary target 3:1 where applicable;
- 44×44 CSS px touch targets;
- visible focus;
- semantic headings;
- aria labels;
- logical DOM order;
- no color-only meaning;
- text scale 200%;
- reduced motion;
- screen reader review of critical flows;
- every paid theme passes same audit.

Gold on ivory is not assumed accessible. It must be measured.

---

# 22. Telegram-specific rules

- use `100dvh`;
- respect safe-area;
- account for virtual keyboard;
- sync Telegram header/background with theme;
- test Android Telegram;
- test iOS Telegram;
- test browser fallback;
- do not depend on hover;
- BackButton follows route state;
- no conflict with Telegram MainButton;
- theme switch updates Telegram chrome without flicker.

---

# 23. Shared primitives

Required or standardized in Phase 3:

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
- `Skeleton`;
- `EmptyState`;
- `ErrorState`;
- `BottomSheet`;
- `ThemePreview`.

A primitive exists only when it reduces real duplication and has stable API.

---

# 24. Paid and unlockable themes

Phase 3 defines technical compatibility. Phase 6 defines purchases.

Every future theme must:

- use semantic tokens;
- preserve UX structure;
- pass accessibility;
- pass performance budget;
- have versioned assets;
- have preview;
- have fallback;
- not affect scoring;
- not affect difficulty;
- not hide core content;
- not inject arbitrary CSS/JS.

Candidate directions:

- Нічна молитва;
- Пустельний шлях;
- Оливкова гілка;
- Царські псалми;
- Ранкова благодать;
- Ліхтар віри;
- Ковчег;
- Небесний спокій;
- migrated versions of current legacy themes.

Names do not imply approved price or release.

---

# 25. Visual QA

## 25.1. Widths

- 320;
- 360;
- 390;
- 412;
- 430;
- 480 CSS px.

## 25.2. States

- loading;
- empty;
- error;
- offline;
- long text;
- no image;
- correct;
- incorrect;
- disabled;
- locked;
- large text;
- reduced motion.

## 25.3. Themes

- `Світло` full matrix;
- `classic` compatibility;
- one dark candidate;
- invalid theme fallback;
- persisted restore;
- no FOUC.

## 25.4. Automated checks

- hardcoded color audit;
- visual regression critical routes;
- accessibility scan;
- horizontal overflow;
- theme switch test;
- Telegram shell smoke;
- asset size budget.

## 25.5. Human review

- minimalism;
- hierarchy;
- spiritual tone;
- CTA clarity;
- card density;
- gold restraint;
- image restraint;
- cross-screen consistency.

---

# 26. Definition of Done

Design work is not complete until:

1. `Світло` is the default free theme.
2. Theme migration preserves existing selection and entitlements.
3. No dark-to-light startup flash.
4. Core screens use semantic tokens.
5. Shared primitives replace real duplication.
6. Navigation follows product architecture, not mockup copying.
7. Correct/incorrect states are accessible.
8. Telegram Android/iOS tested.
9. Critical visual regression is stable.
10. Accessibility has no critical issues.
11. Asset/performance budgets pass.
12. Rollback is tested.
13. Legacy token deprecation is documented.
14. Owner completes final visual review.

---

# 27. Forbidden patterns

- new raw brand hex in feature CSS;
- random radius;
- random shadow;
- gold body text without contrast check;
- multiple primary CTA in one decision block;
- copy reference navigation blindly;
- every card using glass blur;
- paid theme changing layout;
- paid theme changing reward;
- image-only meaning;
- color-only answer state;
- theme-specific component fork without documented need;
- client-side fake purchase;
- hiding core learning behind theme entitlement;
- declaring redesign complete from screenshots alone.
