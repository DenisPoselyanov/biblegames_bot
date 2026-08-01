# DESIGN_AUDIT — порівняння проєкту з DESIGN_RULES.md

> Згенеровано після впровадження Phase 1. Оновлюйте після кожної хвилі вирівнювання.  
> Еталон: [DESIGN_RULES.md](DESIGN_RULES.md)

## Підсумок

| Метрика | Значення | Статус |
|---------|----------|--------|
| CSS-модулів (без Kahoot) | 30 | — |
| Файлів з хардкод hex (критично) | 12 → **0** (поза винятками) | 🟢 |
| Файлів з z-index без токена | 7 → **6** | 🟡 |
| Використання `.btn-cta` / `.glass-card` у TSX | **0** | 🔴 |
| Дублікатів CTA-патерну в CSS | ~15 блоків / 11 файлів | 🔴 |
| Дублікатів glass-патерну в CSS | ~8 файлів | 🔴 |
| Файлів без hex (повна відповідність кольорам) | 19 | 🟢 |
| Документованих винятків | Kahoot, themes.ts colors, mastery scale | ⚪ |

**Загальна оцінка:** ~**78%** відповідність DESIGN_RULES (критичні hex виправлено; Phase 2 backlog — glass/CTA adoption, spacing, radius).

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

`.btn-cta`, `.glass-card`, `.pressable` визначені в `index.css`, але **жоден TSX не імпортує ці класи**.  
15+ CSS-блоків дублюють той самий код.

**Рекомендація (Phase 2):** додати класи в JSX або винести shared module `ui-patterns.module.css`.

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

| Файл | Було | Має бути | Статус |
|------|------|----------|--------|
| `PlayerProfileModal.module.css` | `50` | `var(--z-modal)` | ✅ виправлено |
| `Home.module.css` | `1` | `var(--z-base)` | ⏳ backlog |
| `PlayHub.module.css` | `1`, `2` | `var(--z-base)` | ⏳ backlog |
| `Quiz.module.css` | `0`, `1` | tokens | ⏳ backlog |
| `Survival.module.css` | `1` | `var(--z-base)` | ⏳ backlog |
| `Social.module.css` | `1` | `var(--z-base)` | ⏳ backlog |
| `Shop.module.css` | `1` | `var(--z-base)` | ⏳ backlog |

---

## 🟡 Середні відхилення

### Border-radius без токенів

Найгірші файли (кількість hardcoded px):

| Файл | ~count | Типові значення |
|------|--------|-----------------|
| `AdminPanel.module.css` | 11 | 8px, 10px, 12px |
| `Millionaire.module.css` | 11 | 14px, 20px, 24px, 999px |
| `Survival.module.css` | 10 | 12px, 14px, 16px, 20px |
| `ThemeDetail.module.css` | 8 | 12px, 16px, 20px |
| `Quiz.module.css` | 8 | 12px, 14px, 16px, 20px |
| `TopicMap.module.css` | 7 | 6px, 8px, 16px |

**Маппінг:** `6px→--radius-sm`, `10px→--radius-md`, `14px→--radius-lg`, `20px→--radius-xl`, `999px→--radius-full`.

**Виняток (OK):** `16px 16px 14px 14px` на bottom-sheet modals (DESIGN_RULES §8.5).

### Off-scale typography

Поширені поза шкалою: `0.8rem`, `0.85rem`, `0.95rem`, `1.05rem` — особливо в `AdminPanel`, `GlobalStats`, game pages.

### Off-scale spacing

Game UIs (`Millionaire`, `Quiz`, `Kahoot`, `Survival`) — багато `0.85rem`, `1.15rem`, `1.25rem` замість `var(--space-*)`.

### Два modal-підходи

react-vant `Dialog` (ConfirmModal) vs custom bottom-sheet (Explanation, QuestionEdit, PlayerProfile) — різні backdrop, z-index patterns. Узгоджено частково.

---

## ⚪ Документовані винятки (не порушення)

| Виняток | Де | Чому OK |
|---------|-----|---------|
| Kahoot arcade palette | `Kahoot.module.css`, `KahootHub.tsx` | DESIGN_RULES §10 |
| Theme card accent colors | `data/themes.ts`, `data/categories.ts` | Контентні дані для правої панелі картки |
| Mastery / contribution green scale | `TopicMap.tsx`, `ThemeDetail.tsx` | GitHub-style heatmap; потребує окремих `--mastery-*` токенів (backlog) |
| Difficulty colors в Admin | `AdminPanel.tsx` `DIFFICULTY_COLORS` | Адмін-утиліта, не user-facing theme |
| `cosmeticTheme.ts` hex у mixColor | `#000000`, `#ffffff` | Внутрішня логіка derivation |
| `vantTheme.ts` fixed semantic | `#4a9c5d`, `#9c4a4a` | Синхронізовано з `index.css` tokens |

---

## Рейтинг файлів за відповідністю

### 🟢 Добре (0 critical hex)

`Layout.module.css`, `StudyHub.module.css`, `ThemeCard.module.css`, `CosmeticThemeShop.module.css`, `Themes.module.css`, `Profile.module.css`, `Shop.module.css`, `skeletons.module.css`, `PracticeNodeStageEditor.module.css`, `ScripturePanel.module.css`, `InfoTooltip.module.css`, `ThemePicker.module.css`, `GlobalStats.module.css`, `TopicMap.module.css`, `ExplanationModal.module.css`, `PlayerRankCard.module.css`, `PracticeStageStepper.module.css`

### 🟡 Помірно (1–2 issues або дублікати патернів)

`Quiz.module.css`, `ThemeDetail.module.css`, `QuestionEditModal.module.css`, `PlayerProfileModal.module.css`, `ModePlaceholder.module.css`

### 🔴 Потребують уваги (після fix — переглянути spacing/radius)

`Home.module.css`, `AdminPanel.module.css`, `Millionaire.module.css`, `PlayHub.module.css`, `Social.module.css`, `Survival.module.css`

### ⚪ Виняток

`Kahoot.module.css` — поза scope DESIGN_RULES

---

## TSX inline styles

| Файл | Проблема | Статус |
|------|----------|--------|
| `TopicMap.tsx` | mastery legend `style={{ color: '#39d353' }}` | ⏳ backlog — потрібні `--mastery-*` токени |
| `AdminPanel.tsx` | `color: '#888'` | ✅ → `var(--text-dim)` |
| `Themes.tsx` | `--accent` inline | ✅ OK (CSS var ref) |

---

## Phase 2 Backlog (пріоритет)

1. **Adopt `.btn-cta` / `.glass-card`** у TSX — прибрати 15+ дублікатів
2. **Radius sweep** — механічна заміна `10/14/20px` у game pages
3. **Spacing migration** — Millionaire, Quiz, Survival → `var(--space-*)`
4. **Mastery tokens** — `--mastery-1`…`--mastery-4` для TopicMap / ThemeDetail
5. **Z-index sweep** — `z-index: 1` → `var(--z-base)` у 6 файлах
6. **Modal unification** — один підхід до backdrop + z-index
7. **Light theme QA** — semantic colors на `heavenly-jerusalem`

---

## Чеклист для PR-рев'ю

Скопіюйте з [DESIGN_RULES.md §13](DESIGN_RULES.md) і додайте:

- [ ] Файл не в списку 🔴 рейтингу без обґрунтування
- [ ] Немає нових hex поза `index.css` / `cosmetics.ts` / Kahoot
- [ ] Glass/CTA не дублюються (або використовують global class)

---

*Останнє оновлення: після Phase 1 alignment + critical fixes.*
