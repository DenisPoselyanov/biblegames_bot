# DESIGN_AUDIT — порівняння проєкту з DESIGN_RULES.md

> Згенеровано після впровадження Phase 1. Оновлено після Phase 2 (design system alignment wave, `phase-02a`…`phase-02f`).  
> Еталон: [DESIGN_RULES.md](DESIGN_RULES.md)

## Підсумок

| Метрика | Значення | Статус |
|---------|----------|--------|
| CSS-модулів (без Kahoot) | 30 | — |
| Файлів з хардкод hex (критично) | 12 → **0** (поза винятками) | 🟢 |
| Файлів з z-index без токена | 7 → **0** (Kahoot виняток) | 🟢 |
| Використання `.btn-cta` у TSX (composes) | 0 → **11 блоків / 10 файлів** | 🟢 |
| Використання `.glass-card` у TSX | **0** | 🔴 (свідомо відкладено, див. нижче) |
| Дублікатів CTA-патерну в CSS | ~15 блоків / 11 файлів → **1** (CosmeticThemeShop, свідомий виняток) | 🟢 |
| Дублікатів glass-патерну в CSS | ~8 файлів (без змін) | 🔴 |
| Mastery heatmap кольори | hardcoded hex → `--mastery-1..4` токени | 🟢 |
| Файлів без hex (повна відповідність кольорам) | 19 | 🟢 |
| Документованих винятків | Kahoot, themes.ts colors, sub-6px decorative radii, off-scale intermediate spacing (game pages) | ⚪ |

**Загальна оцінка:** ~**90%** відповідність DESIGN_RULES після Phase 2 (z-index/radius/typography/spacing token sweep, CTA consolidation, mastery tokens, BackButton integration). Залишок: `.glass-card` adoption (потребує окремого design-рішення щодо blur/shadow, не механічної заміни) та частина off-scale intermediate spacing в ігрових сторінках (свідомо не форсувались, щоб не змінювати візуальну щільність без QA).

---

## ✅ Відповідає DESIGN_RULES

| Область | Файли / реалізація |
|---------|-------------------|
| Токени в `:root` | `src/index.css` — fallback = `classic` |
| Runtime-теми | `cosmeticTheme.ts`, `vantTheme.ts`, `VantProvider.tsx` |
| FOUC prevention | `main.tsx` → раннє `applyCosmeticThemeById()` |
| `color-scheme` + `accent-color` | `index.css`, `cosmeticTheme.ts`, `index.html` |
| Layout shell | `Layout.module.css` — повна token-compliance |
| Модалки (z-index) | `ExplanationModal`, `QuestionEditModal`, `Profile` → `var(--z-modal)` |
| Study hub | `StudyHub.module.css` — spacing, glass, typography |
| Theme list | `Themes.tsx` — `var(--success)` замість `#4a7c59` |
| ThemeCard radius | `var(--radius-xl)` |
| Reduced motion | `index.css` + Layout |
| Safe-area | Tabbar, toast, modals |
| Kahoot виняток | Задокументовано в DESIGN_RULES §10 |

---

## 🔴 Критичні відхилення

### 1. Глобальні utility-класи не використовуються

✅ **`.btn-cta` виправлено (Phase 2, `phase-02c`)** — 11 дубльованих CSS-блоків у 10 файлах (Home, StudyHub, Shop, AdminPanel, Quiz, Millionaire, Survival, Social, ExplanationModal, QuestionEditModal) тепер використовують `composes: btn-cta from global;` замість повторення `background`/`box-shadow`/`border`. `CosmeticThemeShop.btnBuy` свідомо залишений без змін — це легша варіація (без shadow), не точний дублікат.

🔴 **`.glass-card` — свідомо відкладено.** На відміну від CTA, "дублікати" glass-картки в 8 файлах насправді відрізняються (`blur(8px)` vs `blur(12px)`, `--glass-shadow` vs `--shadow-md`/`--shadow-sm`/відсутній shadow) — це не механічний дублікат, а сімейство навмисно різних трактувань картки. Уніфікація вимагає окремого дизайн-рішення щодо канонічних blur/shadow значень, а не token-заміни.

### 2. Хардкод семантичних кольорів

| Файл | Проблема | Статус |
|------|----------|--------|
| `Home.module.css` | `#2ecc71`, `#1abc9c`, `#f1c40f`, `#f0d060` | ✅ виправлено |
| `Millionaire.module.css` | `#4a9c5d`, `#9ee0ad`, `#9c4a4a`, `#e8b0b0` | ✅ виправлено |
| `Quiz.tsx` | `#4a9c5d`, `#c9a227`, `#e05050` у SVG timer | ✅ виправлено |
| `QuestionEditModal.module.css` | `#f08080` | ✅ виправлено |
| `ThemeDetail.module.css` | success gradient hex | ✅ виправлено |
| `PlayHub.module.css` | stock purple/cyan gradients | ✅ виправлено |
| `AdminPanel.module.css` | `#8bf`, `#6c6`, `#e88` shorthand | ✅ виправлено |
| `Social.module.css` | `#e88`, `#ff6b6b` | ✅ виправлено |
| `Survival.module.css` | semantic gradient hex | ✅ виправлено |
| `ModePlaceholder.module.css` | `#1b1608` | ✅ виправлено |

### 3. Z-index без токенів

✅ **Виправлено (Phase 2, `phase-02a`).**

| Файл | Було | Стало | Статус |
|------|------|----------|--------|
| `PlayerProfileModal.module.css` | `50` | `var(--z-modal)` | ✅ виправлено |
| `Home.module.css` | `1` | `var(--z-base)` | ✅ виправлено |
| `PlayHub.module.css` | `1`, `2` | `var(--z-base)`, `calc(var(--z-base) + 1)` | ✅ виправлено |
| `Quiz.module.css` | `0`, `1` | `0` (лишено — локальна пара 0/1 у межах одного компонента), `var(--z-base)` | ✅ виправлено |
| `Survival.module.css` | `1` | `var(--z-base)` | ✅ виправлено |
| `Social.module.css` | `1` | `var(--z-base)` | ✅ виправлено |
| `Shop.module.css` | `1` | `var(--z-base)` | ✅ виправлено |

---

## 🟡 Середні відхилення

### Border-radius без токенів

✅ **Виправлено (Phase 2, `phase-02a`)** у `AdminPanel`, `Millionaire`, `Survival`, `ThemeDetail`, `Quiz`, `TopicMap.module.css`, за мапінгом `6px→--radius-sm`, `10px→--radius-md`, `14px→--radius-lg`, `20px→--radius-xl`, `999px→--radius-full` (нестандартні значення — `8/12/16/24px` — замінені на найближчий токен).

**Свідомий виняток:** `2px`/`3px`/`4px` (progress-bar заокруглення, heatmap-легенда) лишені без токена — `--radius-sm` (6px) дав би помітну зміну вигляду цих декоративних елементів. Bottom-sheet `16px 16px 14px 14px` — той самий задокументований виняток, що й раніше (DESIGN_RULES §8.5).

### Off-scale typography

✅ **Частково виправлено (Phase 2, `phase-02b`).** `0.8rem`, `0.85rem`, `0.95rem`, `1.05rem` та інші strays у `AdminPanel`, `GlobalStats`, `Quiz`, `Millionaire`, `Survival` замінені на найближчий `--fs-*` токен. Великі decorative/display розміри (emoji-іконки, timer-числа, рахунок ≥ 2rem) свідомо залишені літералами — шкала `--fs-*` покриває UI-текст, не "hero"-цифри.

### Off-scale spacing

🟡 **Частково виправлено (Phase 2, `phase-02b`).** У `Millionaire`, `Quiz`, `Survival` замінені лише значення, що **точно** збігаються з токеном (`0.25/0.5/0.75/1/1.5/2/3rem`). Проміжні off-scale значення (`0.35rem`, `0.65rem`, `0.85rem`, `1.1rem`, `1.55rem` тощо) свідомо залишені літералами — крок токенів достатньо широкий, щоб примусове округлення помітно змінило щільність padding/gap на вже готових ігрових екранах без візуального QA. Потребує окремого проходу з реальною візуальною перевіркою, якщо буде рішення уніфікувати повністю.

### Два modal-підходи

✅ **Перевірено (Phase 2, `phase-02c`) — bottom-sheet сімейство вже уніфіковане.** `ExplanationModal`, `QuestionEditModal`, `PlayerProfileModal` мають ідентичний backdrop (`rgba(0,0,0,0.62)`), `z-index: var(--z-modal)` і radius (`16px 16px 14px 14px`). react-vant `Dialog` (`ConfirmModal`) лишається окремим підходом — це навмисне рішення, задокументоване в DESIGN_RULES §8.5, не помилка.

---

## ⚪ Документовані винятки (не порушення)

| Виняток | Де | Чому OK |
|---------|-----|---------|
| Kahoot arcade palette | `Kahoot.module.css`, `KahootHub.tsx` | DESIGN_RULES §10 |
| Theme card accent colors | `data/themes.ts`, `data/categories.ts` | Контентні дані для правої панелі картки |
| Mastery / contribution green scale | `TopicMap.tsx`, `ThemeDetail.tsx` | GitHub-style heatmap; ✅ винесено в `--mastery-1..4` токени (Phase 2, `phase-02d`) |
| Difficulty colors в Admin | `AdminPanel.tsx` `DIFFICULTY_COLORS` | Адмін-утиліта, не user-facing theme |
| `cosmeticTheme.ts` hex у mixColor | `#000000`, `#ffffff` | Внутрішня логіка derivation |
| `vantTheme.ts` fixed semantic | `#4a9c5d`, `#9c4a4a` | Синхронізовано з `index.css` tokens |

---

## Рейтинг файлів за відповідністю

### 🟢 Добре (0 critical hex, tokens adopted)

`Layout.module.css`, `StudyHub.module.css`, `ThemeCard.module.css`, `CosmeticThemeShop.module.css`, `Themes.module.css`, `Profile.module.css`, `Shop.module.css`, `skeletons.module.css`, `PracticeNodeStageEditor.module.css`, `ScripturePanel.module.css`, `InfoTooltip.module.css`, `ThemePicker.module.css`, `GlobalStats.module.css`, `TopicMap.module.css`, `ExplanationModal.module.css`, `PlayerRankCard.module.css`, `PracticeStageStepper.module.css`, `Home.module.css`, `AdminPanel.module.css`, `Millionaire.module.css`, `PlayHub.module.css`, `Social.module.css`, `Survival.module.css`, `QuestionEditModal.module.css`

### 🟡 Помірно (proміжний off-scale spacing лишився, свідомо не форсований)

`Quiz.module.css`, `ThemeDetail.module.css`, `PlayerProfileModal.module.css`, `ModePlaceholder.module.css`

### 🔴 Потребують уваги

Немає (усі попередньо 🔴 файли вирівняні в Phase 2 в межах задокументованого scope; глибший spacing-QA — окремий майбутній backlog).

### ⚪ Виняток

`Kahoot.module.css` — поза scope DESIGN_RULES

---

## TSX inline styles

| Файл | Проблема | Статус |
|------|----------|--------|
| `TopicMap.tsx` | mastery legend/cell colors | ✅ → `var(--mastery-1..4)`, `var(--mastery-glow)` (Phase 2, `phase-02d`) |
| `ThemeDetail.tsx` | `progressBorderColor()` hardcoded hex | ✅ → `var(--mastery-1..4)` (Phase 2, `phase-02d`) |
| `AdminPanel.tsx` | `color: '#888'` | ✅ → `var(--text-dim)` |
| `Themes.tsx` | `--accent` inline | ✅ OK (CSS var ref) |

---

## Phase 2 Backlog — статус (завершено `phase-02a`…`phase-02f`)

1. ✅ **Adopt `.btn-cta`** у TSX (через `composes`) — 11 дублікатів прибрано. `.glass-card` свідомо відкладено (див. вище).
2. ✅ **Radius sweep** — механічна заміна `8/10/12/14/16/20/999px` у game pages.
3. 🟡 **Spacing migration** — лише точні збіги з токеном замінені; проміжні off-scale значення свідомо залишені (див. вище).
4. ✅ **Mastery tokens** — `--mastery-1`…`--mastery-4` для TopicMap / ThemeDetail.
5. ✅ **Z-index sweep** — `z-index: 1`/`2` → токени у 6 файлах.
6. ✅ **Modal unification** — перевірено, bottom-sheet сімейство вже було уніфіковане.
7. ✅ **Light theme QA** — перевірено вручну (dev server, підмінені CSS-змінні light-палітри): нові/змінені токени рендеряться коректно, регресій не внесено. Попередньо задокументована окрема проблема (semantic colors типу `--success-text` не адаптовані під світлу тему) лишається відкритою в DESIGN_RULES §14 — це не регресія від Phase 2, а вже наявний backlog.

### Що лишається поза Phase 2 (майбутній backlog)

- `.glass-card` adoption — потребує дизайн-рішення щодо канонічних blur/shadow значень для 8 файлів, що зараз розходяться.
- Повна spacing-уніфікація ігрових сторінок (проміжні off-scale значення) — потребує візуального QA-проходу, не механічної заміни.
- Semantic colors (`--success-text` та інші) адаптовані під `heavenly-jerusalem` (світла тема) — DESIGN_RULES §14, окремий backlog-пункт, не зачіпався в Phase 2.

---

## Чеклист для PR-рев'ю

Скопіюйте з [DESIGN_RULES.md §13](DESIGN_RULES.md) і додайте:

- [ ] Файл не в списку 🔴 рейтингу без обґрунтування
- [ ] Немає нових hex поза `index.css` / `cosmetics.ts` / Kahoot
- [ ] Glass/CTA не дублюються (або використовують global class)

---

*Останнє оновлення: після Phase 1 alignment + critical fixes.*
