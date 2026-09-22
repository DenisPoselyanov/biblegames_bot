# DESIGN_RULES — канонічна дизайн-система Bible Games

> **Статус:** активне domain-джерело правди для UI, UX, themes і visual QA.
> Переписано під Phase 3.5 (WS7 close-out, 2026-09-22) — цей документ описує
> **дизайн-систему v2 «Небесна аврора»**, яка замінила `Світло`/premium
> spiritual minimalism як канонічну ідентичність продукту.
> **Канонічна фаза:** Phase 3.5 — Design v2 Visual Migration
> **Основна тема:** `aurora` («Небесна аврора», dark за замовчуванням)
> **Повна Phase 3.5 специфікація:** [`phases/PHASE_3_5_DESIGN_V2_VISUAL_MIGRATION.md`](./phases/PHASE_3_5_DESIGN_V2_VISUAL_MIGRATION.md)
> **Попередня специфікація (Phase 3, IA/route model — досі чинна):** [`PHASE_3_REBRANDING_AND_THEME_SYSTEM.md`](./PHASE_3_REBRANDING_AND_THEME_SYSTEM.md)
> **Канонічна motion-система:** [`MOTION_SYSTEM.md`](./MOTION_SYSTEM.md) (контракт не змінився цією фазою — нових primitives не додано, ADR-018)

Цей документ замінює попередній напрям `Світло`/premium spiritual
minimalism як головну ідентичність продукту. `light`/`classic` не
видаляються — це owner-approved рішення (Phase 3.5 §5 крок 1), вони
лишаються legacy/alternative themes, вибір яких не залежить від
`designSystemV2` flag. Основна візуальна система Bible Games тепер —
**spiritual premium**: темна за замовчуванням, glass-картки, indigo/violet
primary з теплим золотом лише як акцент, оцінена проти Hallow, Glorify та
YouVersion.

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
- маршрути без узгодження з master specification (IA не змінилась цією
  фазою — див. Phase 3.5 §3, "explicitly out of scope");
- склад нагород;
- ціни;
- entitlement;
- payment flow;
- точну кількість navigation tabs лише на основі референсного макета.

Візуальні референси (`proto/design-v2`, ніколи не змерджений як код —
див. §7.4) задають **стиль**, а не копію екрану.

---

# 2. Ключові файли поточної реалізації

| Роль | Файл |
|---|---|
| Static fallback tokens (pre-hydration) | `src/index.css` |
| Runtime theme application + semantic palette derivation | `src/lib/cosmeticTheme.ts` |
| Theme catalog (`aurora`/`aurora-light`/`light`/`classic`/…) | `src/data/cosmetics.ts` |
| Rollout flag | `src/lib/flags.ts` (`designSystemV2`) |
| react-vant mapping | `src/lib/vantTheme.ts` |
| react-vant provider | `src/components/VantProvider.tsx` |
| App shell v2 (aurora background + nav) | `src/components/shell/AppShellV2.tsx`, `ShellAurora.tsx` |
| Shared component library | `src/components/ui/*` |
| Contrast regression suite | `src/lib/paletteContrast.test.ts` |

`resolveDefaultCosmeticThemeId()` (`src/data/cosmetics.ts`) — з WS7
(2026-09-22) `designSystemV2` за замовчуванням `true`: нові користувачі без
збереженого вибору отримують `aurora`. Флаг знято до `false` миттєво
відновлює Phase 3's `light`/`classic` дефолт (rollback target, verified
live — Phase 3.5 §11.4/§12). Існуючий вибір користувача (`activeTheme` у
профілі) цим прапорцем ніколи не чіпається.

---

# 3. Brand direction

## 3.1. Канонічна формула

> **Spiritual premium: dark-by-default calm + indigo/violet identity + warm
> gold restraint + learning-first clarity.**

Оцінено проти Hallow, Glorify, YouVersion (Phase 3.5 §1).

## 3.2. Продукт має відчуватися

- спокійним і glossy, але не холодним;
- духовно преміальним (dark-mode-first, як insight/медитативні застосунки);
- теплим завдяки золотому акценту, не завдяки кольору фону;
- сучасним;
- зрозумілим із першого погляду;
- ігровим лише настільки, наскільки це допомагає навчанню.

## 3.3. Продукт не має виглядати

- дитячою arcade-грою;
- casino-like reward app;
- фінансовим dashboard;
- старим церковним сайтом;
- суцільним glassmorphism (glass — контрольований виняток, §11.5);
- набором однакових карток;
- copy Apple/Kahoot/Hallow;
- каталогом AI-зображень;
- зі golden як другим primary (gold — **лише accent**, §3.4 locked rule).

## 3.4. Locked visual decisions (Phase 3.5 §4 — не для реінтерпретації)

Ці рішення затверджені власником продукту і не є implementation judgment
call. Зміна будь-якого з них потребує нового owner-рішення (`AskUserQuestion`
до впровадження), так само як WS5/WS6/WS8 Phase 3 фіксували scope:

- тема: темна за замовчуванням, світла доступна, перемикач живе в Профілі
  (не лише system-рівень — ручний override Phase 3 лишається);
- палітра: indigo/violet primary, теплий gold — **лише акцент, ніколи не
  другий primary**;
- типографіка: Manrope для UI, Literata для заголовків і біблійних цитат;
- gamification: збалансована — streak/progress лишаються видимими,
  монети/бейджі лишаються вторинними, ніколи не на передньому плані;
- **одна primary-кнопка на екран** — indigo→violet gradient, інвертується у
  білий `onColor`-варіант на кольоровій поверхні;
- головний об'єкт екрана (Урок дня / Гра тижня / фінальні overlay) —
  full-bleed кольорова картка, не бордерований тайл;
- progress-ramp градієнти закінчуються золотом **лише в темній темі**
  (`--progress-ramp-end`) — світла тема не отримує золотий кінець рампи;
- фінальні/result-екрани не скролляться — розмір від viewport height, не
  від content height;
- motion: середня інтенсивність (spring-переходи, мікровзаємодії),
  `prefers-reduced-motion` поважається — узгоджено з, а не заміна,
  intensity-рівнів Phase 3 WS4's `MotionProvider`.

## 3.5. Apple-inspired principle (незмінно з Phase 3)

Беремо: повітря, чітку ієрархію, передбачувану взаємодію, великі touch
targets, короткий motion, системність.
Не копіюємо: чужі assets, proprietary layouts, system dialogs, logos, чужу
інформаційну архітектуру.

---

# 3.6. Motion relationship

`DESIGN_RULES.md` визначає вигляд станів, а `MOTION_SYSTEM.md` — їхню зміну
в часі. Компонент не може вводити власні easing, celebration або
correct/wrong sequence, якщо shared motion contract уже існує. Theme може
змінювати палітру particles/glow, але не semantics, critical durations,
reduced-motion behavior або blocking time. `framer-motion` — вже наявна
production-залежність (ADR-010, Phase 3), не нова для цієї фази; ADR-018
підтвердив, що нові motion primitives не потрібні (§4's spring/medium-
intensity вже покриваються існуючими intensity-рівнями).

---

# 4. Primary Theme — «Небесна аврора» (`aurora`)

## 4.1. Ідентичність

```text
id: aurora
title: Небесна аврора
price: 0
availability: always
mode: dark (default)
companion: aurora-light (id: aurora-light, mode: light)
```

## 4.2. Непорушні правила

- доступна всім, безкоштовна;
- default для нових користувачів без збереженого вибору
  (`resolveDefaultCosmeticThemeId()`, `designSystemV2` = true за
  замовчуванням з WS7);
- не продається;
- не видаляється;
- має fallback до завантаження профілю;
- не створює FOUC — static fallback у `src/index.css` покриває
  pre-hydration вікно, `applyCosmeticTheme()` завжди перемагає inline-стилями.

## 4.3. Базова палітра (dark, `aurora`)

Значення пінуються в `src/data/cosmetics.ts` (`aurora`), звірені з WCAG AA
під час WS7 §17 re-audit (`src/lib/paletteContrast.test.ts`).

| Role | Token | Value |
|---|---|---:|
| App canvas | `--bg-app` | `#0A0918` |
| Surface (card tint) | `--bg-surface` | `rgba(255,255,255,0.055)` |
| Elevated surface | `--bg-elevated` | `rgba(255,255,255,0.1)` |
| Primary text | `--text-primary` | `#F6F4FF` |
| Secondary text | `--text-secondary` | `rgba(246,244,255,0.64)` |
| Muted text | `--text-muted` | `rgba(246,244,255,0.5)` |
| Text link / secondary button text | `--text-link` / `--button-secondary-text` | `#7678F3` |
| Brand indigo | `--brand-primary` | `#6366F1` |
| Spiritual gold | `--accent-spiritual` | `#F0C05A` |
| Gold text/icon glyph | `--accent-spiritual-text` | `#F7D896` |
| Primary button gradient | `--button-primary-bg` | `linear-gradient(135deg, #6063F1 0%, #9E42F6 100%)` |
| Focus border | `--border-focus` | `#F0C05A` |
| Progress ramp end (dark-only gold) | `--progress-ramp-end` | `#F0C05A` |

`--text-link`/`--button-secondary-text` НЕ дорівнюють `--brand-primary`: сирий
`#6366F1` вимірює 4.41:1 на `bgApp` — нижче WCAG AA 4.5:1 для нормального
тексту (WS7 §17). Той самий патерн, що вже існував для
`accentSpiritual`/`accentSpiritualText` — фон/бордер лишається насиченим
brand-кольором, роль тексту отримує освітлений відтінок.

`--button-primary-bg`'s зупинки (`#6063F1`/`#9E42F6`) — на пів кроку темніші
за "сирі" `#6366F1`/`#A855F7` з proto.css: кнопковий текст (14px/700 — нижче
14pt/18.66px порогу "великого тексту") на сирих зупинках вимірював
4.47:1/3.96:1, нижче AA. Різниця візуально непомітна, hue/градієнт-напрям
не змінені (§3.4 locked).

## 4.4. Світлий компаньйон — «Небесна аврора · Світла» (`aurora-light`)

Той самий бренд, освітлений вдень (§3.4: "світла доступна"). Вибирається
через Профіль → Виглід → Світлий.

| Role | Token | Value |
|---|---|---:|
| App canvas | `--bg-app` | `#F7F5FF` |
| Primary text | `--text-primary` | `#1A1430` |
| Muted text | `--text-muted` | `rgba(26,20,48,0.62)` |
| Brand indigo | `--brand-primary` | `#4F46E5` |
| Spiritual gold (darkened, text role) | `--accent-spiritual-text` | `#7D560B` |
| Progress ramp end (**не золото** — locked rule) | `--progress-ramp-end` | `#4C1D95` |

`--text-muted` піднято з `rgba(26,20,48,0.44)` (2.80:1, WS1 pin) до `0.62`
(~4.85:1) під час WS7 §17 — той самий клас проблеми, що й у dark-варіанті.

## 4.5. Кольорова ієрархія

1. Indigo/violet — функціональний primary (кнопки, brand, active nav).
2. Deep navy / lavender-white — основний фон (dark/light відповідно).
3. Translucent surface tint — cards, elevated panels.
4. Gold — духовний і progress accent (dark-only на ramp-end, §3.4).
5. Semantic state colors — correct, wrong, warning, info (§5.6, тепер
   theme-aware, §21.1).

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
--accent-spiritual-text;
--accent-spiritual-soft;
--accent-spiritual-bg;
--on-accent-spiritual;
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
--progress-ramp-end;
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

**Змінено у WS7 §17:** `--state-success*`/`--state-danger*` більше не
статичні глобали — вони обчислюються per-theme в `deriveSemanticPalette()`
(`isLight` branch), бо фіксовані значення (`#9ee0ad`/`#e8b0b0`, тюновані під
темний canvas) вимірювали ~1.2–1.3:1 на власному tinted-фоні в БУДЬ-ЯКІЙ
світлій темі — і в уже зданій `light`, і в новій `aurora-light` (не
introduced цією фазою, знайдено і виправлено під час re-audit). Темні теми
(`classic`, `aurora`) лишились байт-у-байт незмінними (regression-тест —
`src/lib/paletteContrast.test.ts`). Значення стану семантично незмінні —
green завжди success, red завжди danger — змінюється лише точний відтінок
для читабельності. `--state-warning`/`--state-info` лишились статичними
(низьке використання — лише `OfflineBanner`, не входило в WS7 scope; варте
окремого аудиту, якщо їхнє використання зросте).

## 5.7. Hero/imagery

```css
--hero-overlay-start;
--hero-overlay-end;
--hero-image-opacity;
--illustration-tint;
```

## 5.8. Aurora shell blobs (WS2, `ShellAurora`)

```css
--aurora-1;
--aurora-2;
--aurora-3;
```

За замовчуванням `transparent` на кожній попередній темі — лише
`aurora`/`aurora-light` пінують реальні значення; сам шар вмикається
`designSystemV2` flag, не цими токенами.

## 5.9. Typography tokens

```css
--font-serif;  /* Literata на aurora/aurora-light, інакше Cormorant Garamond fallback */
--font-sans;   /* Manrope на aurora/aurora-light, інакше Source Sans 3 fallback */
```

---

# 6. Legacy compatibility

Під час міграції (незмінно з Phase 3, все ще активно для `classic`):

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

## 7.1. Поточний стан

`CosmeticTheme` (`src/data/cosmetics.ts`) містить `preview` (5 кольорів:
background/surface/primary/accent/text) + опційний `semantic` block —
`Partial<SemanticPalette>` overrides, що перемагають generic-деривацію.
`aurora`/`aurora-light` пінують більшість ролей вручну (owner-approved
значення з `proto/design-v2`); токени, що не пінуються явно (наприклад
`buttonSecondaryBg`, `onAccentSpiritual`), і далі обчислюються з `preview`
через `deriveSemanticPalette()`'s generic-формулу.

## 7.2. Theme invariants

Тема може змінювати: palette, surfaces, accent, elevation у дозволених
межах, imagery tone, decorative tint.

Тема не може змінювати: layout, routes, component behavior, correct answer,
reward, difficulty, information hierarchy, touch target, accessibility
meaning, competitive advantage.

## 7.3. Легасі теми (owner decision, Phase 3.5 §5 крок 1)

`light` («Світло») і `classic` («Класичний стиль») **не видалені** —
залишаються вибираними legacy/alternative themes незалежно від
`designSystemV2` flag, той самий статус, що мав `classic` після Phase 3
WS3/WS8. Прапорець лише керує *дефолтом для нового користувача*, ніколи не
чіпає вже збережений вибір.

## 7.4. `/proto` — статус прототипу

`proto/design-v2` — окрема гілка, ніколи не змержена в `main`/`phase-3.5/*`.
Її `src/proto/*` click-through screens **не існують у продакшн-коді** — усі
візуальні рішення вручну перенесені у реальний
`deriveSemanticPalette()`/`cosmeticTheme.ts` pipeline (WS1–WS6), а не
змержені як код (§10 forbidden shortcuts — ізольований cascade-layer
прототипу ніколи не мав потрапити в production). `src/proto/studio/`
(Content Studio) — окреме питання, не ретируеться, лишається постійним
референсом для Phase 4 §10.

---

# 8. Typography

## 8.1. Font stacks

```css
--font-sans: 'Manrope', system-ui, -apple-system, sans-serif;
--font-serif: 'Literata', Georgia, serif;
```

Fallback (теми без явного pin — `classic`, `light`, будь-яка майбутня
некастомізована тема): `'Source Sans 3'` / `'Cormorant Garamond'` — той
самий стек, що діяв до цієї фази, для нульового візуального зсуву.

## 8.2. Literata (display/serif)

Використовувати для: page title, hero title, main question, learning plan
title, milestone, біблійна цитата.
Не використовувати для: button, input, dense list, timer, metadata, long
explanation.

## 8.3. Manrope (UI)

Використовувати для: body, labels, buttons, navigation, captions,
statistics, settings, explanations.

## 8.4. Type scale (реальні токени `src/index.css`)

```css
--fs-xs: 0.65rem;
--fs-sm: 0.75rem;
--fs-base: 0.875rem;
--fs-md: 0.95rem;
--fs-lg: 1.1rem;
--fs-xl: 1.35rem;
--fs-2xl: 1.75rem;
--fs-3xl: 2.25rem;
```

Не вводити випадкові off-scale values без documented reason.

## 8.5. Weight

- 400 — body;
- 500 — metadata;
- 600 — labels/secondary emphasis;
- 700 — CTA і important title (button text — перевірити контраст, §4.3);
- 800 — короткий stat/kicker лише за потреби.

## 8.6. Text resilience

- перевірити довгі українські назви;
- text scale 200% (viewport meta без `maximum-scale`/`user-scalable=no` —
  WS10 §17 fix, `index.html`);
- no clipping;
- no fixed-height body text;
- no ellipsis для critical content;
- біблійна цитата має readable line-height.

---

# 9. Spacing and layout

## 9.1. Scale (реальні токени)

```css
--space-xs: 0.25rem;  /* 4  */
--space-sm: 0.5rem;   /* 8  */
--space-md: 0.75rem;  /* 12 */
--space-lg: 1rem;     /* 16 */
--space-xl: 1.5rem;   /* 24 */
--space-2xl: 2rem;    /* 32 */
--space-3xl: 3rem;    /* 48 */
```

## 9.2. Layout rules

- mobile-first single column;
- no horizontal scroll;
- max content width відповідає Telegram Mini App (480px inner column для
  aurora nav pill, `BottomNavigation.module.css`);
- page horizontal padding 16–24 px залежно від width;
- one dominant hero per first viewport (full-bleed colored card, §3.4);
- major sections separated by 24–40 px;
- CTA in one-thumb reach;
- sticky actions account for tabbar (56px / 52px aurora pill) і safe-area;
- no density reduction лише щоб влізло більше карток.

## 9.3. Safe area

```css
padding-top: max(var(--space-md), env(safe-area-inset-top));
padding-bottom: calc(var(--space-lg) + env(safe-area-inset-bottom));
```

---

# 10. Radius and elevation

## 10.1. Radius (реальні токени)

Базова шкала (flag off / pre-3.5 теми):

```css
--radius-sm: 6px;
--radius-md: 10px;
--radius-lg: 14px;
--radius-xl: 20px;
--radius-tile: var(--radius-lg);
--radius-full: 9999px;
```

Design-v2 (WS9): `CosmeticThemeSync` ставить `data-design-v2="on"` на `<html>`,
коли ввімкнено `designSystemV2`, і `src/index.css` перевизначає шкалу на
прототипні значення (`proto.css` `@theme inline`):

```css
:root[data-design-v2='on'] {
  --radius-md: 12px;
  --radius-lg: 16px;   /* control: кнопки, segmented, inputs */
  --radius-tile: 20px; /* tile: quick-tiles, answer options, list rows */
  --radius-xl: 28px;   /* card: ContentCard / HeroCard */
}
```

Той самий блок несе `--space-section` (20px — відстань між верхньорівневими
блоками екрана, `/proto`'s `space-y-5`; поза design-v2 = `--space-lg`) і
design-v2 type scale (`--fs-*`: 11/12/13/15/17/19/24/27 px
при базових 15 px) — це єдине місце, де живуть «некольорові» рішення
прототипу. Flag off → селектор не збігається → Phase 3 шкала недоторкана.

Aurora-специфічні винятки: floating nav pill `26px` (`.nav--aurora .inner`),
nav item `20px` (`.nav--aurora .item`) — обидва трохи більші за базовий
`--radius-xl`, навмисно для "floating glass pill" ефекту (§4.4 hero card /
§11.5 glass).

Pill використовується лише коли форма має зміст: filter chip, compact
status, segmented item.

## 10.2. Shadows

```css
--shadow-card: 0 8px 24px rgba(35, 43, 57, 0.07);   /* light */
--card-shadow (aurora): 0 18px 40px -18px rgba(3, 2, 12, 0.85);
--card-shadow (aurora-light): 0 18px 40px -18px rgba(76, 56, 140, 0.22);
```

Правила:

- тінь показує elevation;
- no black halo;
- no universal gold glow;
- кожна тема має власний audited shadow-profile (color, не лише opacity —
  aurora-light's фіолетовий tint, не сірий);
- border + shadow не повинні створювати важку рамку.

---

# 11. Surface patterns

## 11.1. Standard card

- `--card-bg`, `--card-border`, `--card-shadow`;
- radius 14–20 px (`--radius-lg`/`--radius-xl`);
- padding 20–24 px (`--space-xl`/`--space-2xl`);
- no decorative gradient за замовчуванням, крім hero (§11.2).

## 11.2. Hero card — full-bleed colored card (locked, §3.4)

Замінює попередній "bordered tile" паттерн. `HeroCard`/`CoverArt`
primitives (WS3). Містить:

- kicker;
- strong title (Literata);
- short explanation;
- progress АБО одна primary action;
- restrained imagery;
- overlay for readability (`--hero-overlay-start/end`).

Кнопка на hero-картці інвертується у `Button`'s `onColor` variant (білий
фон, темний текст) — не той самий indigo-gradient, що на нейтральному фоні
(§3.4, перевірено окремо — onColor-контраст не залежить від theme tokens).

Hero не повинен містити 5 рівнозначних CTA.

## 11.3. List card / numbered row

- rows мають stable min-height (56px `ListRow`, ~52px `numberedRow`
  content-derived — обидва понад 44px touch floor);
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

## 11.5. Glass — контрольований виняток

Glassmorphism — контрольований виняток, не основа системи. Aurora-варіант
`BottomNavigation` (`variant="aurora"`) — floating glass pill з
`backdrop-filter: blur(24px)` — єдиний production-використання цієї фази.

Дозволено:

- floating nav pill (транзиентний, завжди на екрані, не content);
- overlay на hero image.

Заборонено:

- усі content cards (Shop/Social cards перейшли з legacy glass-blur на
  стандартний `ContentCard`, WS6 — §27 forbidden patterns);
- довгий текст;
- weak-device без fallback;
- blur заради декоративності.

---

# 12. Buttons

## 12.1. Primary — indigo→violet gradient (locked, §3.4)

- `--button-primary-bg` gradient, `--button-primary-text` (білий);
- min-height 48 px;
- font-weight 700, `--fs-base` (14px) — **нижче WCAG "великого тексту"
  порогу**, тому текст на КОЖНІЙ зупинці градієнта має пройти 4.5:1
  (§4.3 — саме тому зупинки на пів кроку темніші за "сирі" proto-значення);
- visible pressed state (`scale(0.98)`);
- visible focus;
- одна primary-кнопка на локальне рішення (§3.4).

## 12.2. Secondary

- surface or transparent;
- `--button-secondary-text` (aurora: pinned `#7678F3`, не сирий
  `brandPrimary` — §4.3);
- soft border;
- no stronger visual weight than primary.

## 12.3. Tertiary

- text/icon action;
- underline or state where needed;
- 44×44 interactive area навіть якщо візуальний гліф менший.

## 12.4. onColor — hero-картки (WS3, §11.2)

- білий фон, темний текст (`#181124`), власна тінь;
- використовується ЛИШЕ коли кнопка сидить на кольоровій/imagery поверхні
  (hero card), не на нейтральному `bgApp`/`bgSurface`.

## 12.5. Gold/premium

Gold-filled control зарезервований для premium/theme preview або special
reward action і потребує contrast test (`onAccentSpiritual` — обчислюється
через `deriveOnPrimary`, автоматично вибирає темний/світлий текст за
luminance порогом 0.55).

## 12.6. Destructive

- semantic danger (`--state-danger`, тепер theme-aware — §5.6, §21.1);
- confirmation only for irreversible action;
- not hidden behind misleading neutral button.

---

# 13. Inputs and controls

## 13.1. Inputs

- min-height 48 px (`SearchField` — §17 touch-target sweep, незмінно цією
  фазою);
- сфокусований стан: `border-color: var(--border-focus)` +
  `box-shadow: 0 0 0 3px var(--focus-ring)` — solid border несе основний
  contrast-обов'язок (3:1, перевірено §21.1), `--focus-ring` — декоративне
  glow поверх, не єдиний індикатор;
- inline error text;
- icon does not replace label;
- keyboard-safe scroll.

## 13.2. Search

- clear button;
- accessible label;
- debounce only if server query;
- no fake search field that opens unrelated modal without indication.

## 13.3. Segmented control

- 2–4 options (Профіль's "Виглід" Темний/Світлий — 2 опції, §4.1);
- selected — brand indigo;
- min-height 44 px (§17 touch-target sweep);
- responsive alternative on narrow width.

## 13.4. Toggle

- label describes resulting state;
- disabled reason visible;
- state not indicated only by color.

---

# 14. Navigation

## 14.1. Visual rules — aurora variant

Floating glass pill (`BottomNavigation` `variant="aurora"`, WS2):

- transparent outer `.nav`, inner pill has `border-radius: 26px`,
  `backdrop-filter: blur(24px)`, `--card-shadow`;
- item min-height 52px (pill) / 56px (edge-to-edge legacy), label 10px,
  icon 19px (stroke 2.2 активний / 1.8 неактивний) — значення з `/proto`'s
  `TabBar`;
- active item gets `--bg-elevated` fill + `1px` `--border-soft` hairline,
  ink label (`--nav-active`, запінений на обох aurora-темах, не indigo) і
  **золотий гліф** (`--accent-spiritual-text`) — WS9;
- inactive — `--nav-inactive`;
- safe-area bottom;
- no layout shift on selection.

## 14.2. Product structure

IA не змінена цією фазою (Phase 3.5 §3 — explicitly out of scope). П'ять
табів Phase 3's shipped route model = `/proto`'s п'ять табів один-в-один —
жодної маршрутної міграції не потрібно. WS9 привів до прототипу лише
**підписи і гліфи** (презентація, не маршрути): `Сьогодні · Навчання ·
Грати · Прогрес · Я` з `sparkles`/`book-open`/`gamepad`/`trending-up`/`user`
(flag off лишає Phase 3 набір `Головна … Профіль`).

Fullscreen-маршрути (§5.4 route metadata): урок, practice-сесія, Kahoot-room
і — з WS9 — Мільйонер, Виживання та Kahoot-лобі, за `/proto`'s `IMMERSIVE`.

Крамниця не займає core learning tab лише для монетизації.

---

# 15. Iconography

- одна icon-family — hand-rolled `src/components/Icon.tsx` (ADR-018: NOT
  `lucide-react` — оцінено і відхилено, існуючий набір достатній);
- outline-first;
- consistent 1.5–2 px optical stroke;
- indigo active;
- gray/muted inactive;
- gold spiritual/decorative;
- filled state only when meaningful;
- icon-only button has accessible name;
- no emoji as production icon unless content explicitly requires emoji.

Permitted motifs: Bible, cross, dove, lamp, shield, crown, branch, path,
lyre, prayer hands. Do not use sacred symbols as arbitrary confetti.

---

# 16. Imagery

## 16.1. Direction

warm, soft, atmospheric, quiet, non-cartoonish, non-chaotic, supportive to
content — незмінно цією фазою.

## 16.2. Suitable motifs

cross on hill, sunrise, path, ark, open Bible, dove, lantern, sea,
mountains, olive branches.

## 16.3. Technical requirements

modern compressed format, width/height reserved (aspect-ratio reserved on
lesson images — WS10 §18 CLS fix, незмінно), responsive crop, lazy loading
outside first viewport, graceful fallback, contrast overlay
(`--hero-overlay-start/end`), no functional dependence on image, image
budget documented (§18/perf gate).

## 16.4. Editorial requirements

visible AI artifacts rejected, biblical/historical depiction reviewed,
artwork is not presented as factual reconstruction, no image that
undermines theological neutrality without review.

---

# 17. Progress and gamification

## 17.1. Progress

- track neutral, fill brand indigo (`--progress-fill`);
- ramp кінчається золотом **лише в темних темах** (`--progress-ramp-end`,
  locked §3.4) — світлі теми отримують non-gold значення (aurora-light:
  глибокий фіолет `#4C1D95`, light: не визначено окремо, успадковує
  `accentSpiritual`);
- number available when useful;
- no misleading animation;
- server-authoritative value.

## 17.2. XP and levels

secondary motivation, never more prominent than next learning action, no
pay-to-win appearance, reward animation restrained.

## 17.3. Streak

motivational, not punitive, no shame language, missed day does not trigger
aggressive red alert, flame icon optional.

## 17.4. Achievements

consistent badge frame, semantic rarity only if it has product meaning, no
fake scarcity, locked state accessible.

---

# 18. Practice answer states

## 18.1. Неутральний

surface background, clear border, large tap area, no hint of correct
position.

## 18.2. Обраний

selected state visible before submission, no accidental submit on scroll,
keyboard/focus support.

## 18.3. Правильно

- `--state-success` border + `--state-success-bg` background;
- check icon;
- `Правильно!` text у `--state-success-text`;
- explanation/reference;
- reward secondary.

**WS7 §17 fix:** на світлих темах (`light`, `aurora-light`)
`--state-success-text` тепер `#166534` (темно-зелений), не глобальний
`#9ee0ad` (світло-зелений, тюнований під темний canvas) — сирий глобал
вимірював ~1.18:1 на власному tinted-фоні, практично невидимий. Темні теми
(`classic`, `aurora`) отримують ідентичний попередньому вигляд —
byte-for-byte regression test у `paletteContrast.test.ts`.

## 18.4. Неправильно

- selected wrong answer — `--state-danger` states;
- correct answer — `--state-success` states;
- `Неправильно` без сорому;
- explanation/reference;
- next action.

**WS7 §17 fix:** та сама проблема і те саме виправлення для
`--state-danger-text` (`#9C2F2F` на світлих темах замість `#e8b0b0`).

No answer state may rely on color alone.

---

# 19. Game mode exceptions

## 19.1. Kahoot-like mode

Allowed: red/blue/yellow/green answer tiles, geometric answer symbols,
stronger timer/score hierarchy.
Required: shape + text labels, accessible contrast, no flashing,
theme-compatible shell, result/explanation returns to common system.

## 19.2. Millionaire / Survival

Ре-скін WS4 — токени/поверхні лише, **не чіпає** WS9's (Phase 3)
score-authority fix (forbidden shortcut, Phase 3.5 §10). Той самий shared
typography family, controls, accessible answer states.

## 19.3. Admin/content tools

Protected tools prioritize density and accuracy. Ті самі tokens, без
consumer hero imagery чи decorative spiritual visuals.

---

# 20. Motion

Реальні токени (`src/index.css`, незмінні цією фазою — ADR-018, жодних
нових motion primitives):

```css
--duration-instant: 80ms;
--duration-micro: 120ms;
--duration-fast: 160ms;
--duration-normal: 240ms;
--duration-page: 280ms;
--duration-progress: 400ms;
--duration-slow: 440ms;
--duration-emphasis: 520ms;
--duration-celebration: 900ms;
--duration-ceremony: 1400ms;
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);
--ease-smooth: cubic-bezier(0.22, 1, 0.36, 1);
```

Aurora-специфічно: `ShellAurora`'s blob-drift керується
`useMotionCapabilities().effectiveIntensity`, не сирим media query (WS2) —
той самий контракт, що й решта `MotionProvider`-керованих ефектів.

Rules: motion explains state change, no permanent pulse, no autoplay
parallax, no bounce-heavy spiritual reading UI, reduced motion disables
nonessential effects, progress animation does not misrepresent value.

---

# 21. Accessibility

## 21.1. WS7 §17 re-audit — методологія і знахідки

Повний контрастний аудит `aurora`/`aurora-light` (WCAG 2.1 AA,
`src/lib/paletteContrast.test.ts`, автоматизований regression-гейт) знайшов
і виправив:

| Токен | Було | Стало | Причина |
|---|---|---:|---|
| `aurora` `textMuted` | `rgba(246,244,255,0.4)` — 3.56:1 | `0.5` — ~4.9:1 | нижче AA normal-text |
| `aurora-light` `textMuted` | `rgba(26,20,48,0.44)` — 2.80:1 | `0.62` — ~4.85:1 | нижче AA normal-text |
| `aurora` `buttonPrimaryBg` | `#6366F1`/`#A855F7` — 4.47:1/3.96:1 | `#6063F1`/`#9E42F6` — ~4.6:1 | кнопковий текст 14px/700, не "великий текст" |
| `aurora` `textLink`/`buttonSecondaryText` | не пінувалось (fallback `brandPrimary` `#6366F1` — 4.41:1) | `#7678F3` — ~5.4:1 | текстова роль на сирому brand-кольорі |
| `stateSuccessText`/`stateDangerText` (будь-яка світла тема) | глобал `#9ee0ad`/`#e8b0b0` — ~1.2–1.3:1 | theme-aware `#166534`/`#9C2F2F` — ~5.3–5.4:1 | статичний global, тюнований лише під темний canvas; торкнулось і вже зданої `light` |

`focusRing` (`rgba(240,192,90,0.4)` composited) виміряний нижче 3:1, але
НЕ виправлявся — це декоративний glow поверх solid `--border-focus`
(11.63:1/4.34:1), який несе фактичний contrast-обов'язок фокус-індикатора
(`button:focus-visible { outline: 2px solid var(--gold) }`,
`src/index.css`). Задокументовано як reviewed-non-issue, не пропущена
знахідка.

## 21.2. Мінімальні вимоги

- regular text contrast target 4.5:1;
- large text/UI boundary target 3:1 де застосовно;
- 44×44 CSS px touch targets;
- visible focus (solid indicator несе contrast-обов'язок, glow — декоративний);
- semantic headings, focus moves to entering screen's `<h1>` on route change
  (WS10 §17, `AppShellV2`, незмінно цією фазою);
- aria labels;
- logical DOM order;
- no color-only meaning;
- text scale 200% (viewport meta fix, WS10 §17);
- reduced motion;
- deduplicated ARIA live messages (`role="status"` на result-екранах,
  WS10 §17);
- screen reader review of critical flows;
- every theme (paid чи ні) проходить той самий аудит.

Gold on light canvas НЕ вважається доступним апріорі. Кожна пара
текст/фон вимірюється (§21.1 — точно так і був знайдений
`textMuted`/`buttonPrimaryBg`/`stateSuccessText` набір проблем).

---

# 22. Telegram-specific rules

Незмінно цією фазою:

- use `100dvh`;
- respect safe-area;
- account for virtual keyboard;
- sync Telegram header/background with theme (`syncTelegramChromeColors`,
  спрацьовує на кожен `applyCosmeticTheme()`, включно з aurora/aurora-light);
- test Android Telegram;
- test iOS Telegram;
- test browser fallback;
- do not depend on hover;
- BackButton follows route state;
- no conflict with Telegram MainButton;
- theme switch updates Telegram chrome without flicker.

---

# 23. Shared primitives

Базові (Phase 3, незмінні):

`AppPage`, `PageHeader`, `SectionHeader`, `BottomNavigation`, `ContentCard`,
`ListRow`, `Button`, `IconButton`, `SearchField`, `SegmentedControl`,
`ProgressBar`, `AchievementBadge`, `AnswerOption`, `AnswerFeedback`,
`Skeleton`, `EmptyState`, `ErrorState`, `BottomSheet`.

Додано Phase 3.5 (WS1–WS6):

- `HeroCard` (`tone="cover"` full-bleed pattern, §11.2);
- `CoverArt` (список-картки з обкладинкою — Learn/Practice/Play);
- `Pill` (status/count chips, замінили bespoke badge-класи);
- `ShellAurora` (WS2, drifting blob-фон, `AppShellV2`-only, `designSystemV2`-gated);
- `ProgressRing` (`onColor`-варіант для hero-заголовків, WS5);
- `ThemeSwatch` (live-preview індикатор екіпірованої теми, WS5);
- `ThemePreview`.

Primitive існує лише коли зменшує реальне дублювання і має стабільний API.

---

# 24. Paid and unlockable themes

Phase 3 визначає технічну сумісність, Phase 6 — покупки.

Кожна майбутня тема має:

- використовувати semantic tokens;
- зберігати UX-структуру;
- проходити accessibility (§21 — включно з `stateSuccess*`/`stateDanger*`,
  не лише текст/фон);
- проходити performance budget (§25.4);
- мати versioned assets;
- мати preview;
- мати fallback;
- не впливати на scoring;
- не впливати на difficulty;
- не приховувати core content;
- не інжектити довільний CSS/JS.

Кандидатні напрямки: Нічна молитва, Пустельний шлях, Оливкова гілка,
Царські псалми, Ранкова благодать, Ліхтар віри, Ковчег, Небесний спокій,
migrated versions of `Генісаретське море`/`Едемський сад`/`Синайське
одкровення`/`Небесний Єрусалим` (наявні платні теми каталогу, ще не
пере-аудитовані під `aurora`-стандарт §21).

Names do not imply approved price or release.

---

# 25. Visual QA

## 25.1. Widths

320, 360, 390, 412, 430, 480 CSS px.

## 25.2. States

loading, empty, error, offline, long text, no image, correct, incorrect,
disabled, locked, large text, reduced motion.

## 25.3. Themes

- `aurora` full matrix (канонічна, dark);
- `aurora-light` full matrix (канонічна, light);
- `light`/`classic` compatibility (legacy, §7.3);
- invalid theme fallback;
- persisted restore;
- no FOUC;
- rollback: `designSystemV2` off відтворює точний pre-migration екран
  (verified live, WS7 — §12 Rollback).

## 25.4. Automated checks

- `src/lib/paletteContrast.test.ts` — WCAG contrast regression (§21.1);
- `scripts/check-bundle-size.mjs` — entry JS/CSS gzip budget (260KB/40KB,
  пройдено після WS1–WS7 без нових залежностей, ADR-018);
- `src/lib/questionBankBoundary.test.ts` — bundle-boundary (§18, Phase 3);
- hardcoded color audit;
- theme switch test;
- Telegram shell smoke;
- horizontal overflow.

## 25.5. Human review

minimalism, hierarchy, spiritual tone, CTA clarity, card density, gold
restraint, image restraint, cross-screen consistency, product owner final
visual sign-off (non-agent-completable gate — Phase 3.5 §11.10, той самий
патерн, що Phase 3 §25.19).

---

# 26. Definition of Done (design-система v2)

Design-робота цієї фази не вважається завершеною, доки:

1. `aurora` — default тема для нових користувачів (WS7, §2).
2. Кожен екран Phase 3's shipped IA рендериться в новій системі — жоден
   екран мовчки не лишився на старій палітрі (WS1–WS6).
3. Rollout flag (`designSystemV2`) перемкнутий на full default, rollback
   verified live (WS7, §12).
4. WS10 §17 accessibility audit пере-запущений і проходить проти нової
   палітри (WS7, §21.1) — включно зі знахідкою й фіксом
   `stateSuccess*`/`stateDanger*`, що торкнулась і `light`.
5. WS10 §18 performance budget gate пере-запущений і проходить (WS7, §25.4)
   — без нових залежностей (ADR-018).
6. `docs/DESIGN_RULES.md` переписаний (цей документ), `docs/PHASE_STATUS.md`
   і `docs/phases/README.md` відображають фазу.
7. `/proto` — підтверджено, що ніколи не був змержений у виконуваний код
   цієї гілки (§7.4); нічого роутити не потрібно.
8. Content Studio (Phase 4) підтверджено споживає ту саму token-джерело
   правди, не форкнуту копію (Phase 4 §10/§15 вже специфіковано проти тих
   самих `--p-*` токенів).
9. Owner затверджує фінальний visual review (§25.5 — non-agent-completable).

---

# 27. Forbidden patterns

- новий сирий brand hex у feature CSS замість semantic token;
- random radius;
- random shadow;
- gold body text без contrast-перевірки;
- gradient-кнопковий текст, перевірений лише на одній зупинці градієнта
  (обидві зупинки мають пройти AA — §21.1 знахідка);
- theme-aware токен, перевірений лише в одній темі (світлий/темний —
  завжди парою, §21.1 методологія);
- multiple primary CTA в одному decision block;
- copy reference navigation blindly;
- кожна картка з glass blur (glass — контрольований виняток, §11.5);
- paid theme changing layout;
- paid theme changing reward;
- image-only meaning;
- color-only answer state;
- theme-specific component fork без документованої причини;
- client-side fake purchase;
- hiding core learning behind theme entitlement;
- ізольований cascade-layer прототип (проте `/proto`'s підхід), змержений у
  production замість інтеграції з `deriveSemanticPalette()` (§7.4, §10 Phase
  3.5);
- declaring redesign complete from screenshots alone.
