# DESIGN_RULES — дизайн-система Bible Games Bot

> Єдине джерело правди для кольорів, відступів, типографіки, тем і компонентних патернів.  
> Усі нові екрани та правки стилів **повинні** відповідати цим правилам.

**Ключові файли реалізації:**

| Роль | Файл |
|------|------|
| Статичні токени (fallback) | `src/index.css` |
| Runtime-теми | `src/lib/cosmeticTheme.ts`, `src/data/cosmetics.ts` |
| react-vant | `src/lib/vantTheme.ts`, `src/components/VantProvider.tsx` |
| App shell | `src/components/Layout.module.css` |

---

## 1. Design Direction

| Аспект | Рішення |
|--------|---------|
| Продукт | Біблійна навчальна гра для щоденного використання в Telegram |
| Тон | «Dark luxury / parchment gold» — теплі акценти, скляна глибина |
| Платформа | Mobile-first Telegram Mini App, `max-width: 480px` |
| Шрифти | Cormorant Garamond (заголовки) + Source Sans 3 (UI) |
| Бібліотека UI | react-vant, стилізована через токени |

**Не робити:** маркетинговий лендінг, uniform card grid без ієрархії, stock purple gradients, сіро-білий «шаблонний» UI.

---

## 2. Архітектура токенів

```
index.css (:root)          ← fallback = тема «classic»
        ↓ перезаписується
cosmeticTheme.ts           ← 28 CSS vars на :root (user theme)
        ↓ паралельно
vantTheme.ts               ← --rv-* для react-vant
        ↓ споживають
*.module.css               ← компонентні стилі
```

**Правило:** у CSS-модулях і TSX — тільки `var(--*)`. Ніколи не звертатися до `preview.primary` напряму.

---

## 3. Кольорова система

### 3.1 Семантичні ролі

| Роль | Токен | Призначення |
|------|-------|-------------|
| Canvas | `--bg` | Фон сторінки |
| Surface | `--surface`, `--surface-hover` | Картки, панелі, tabbar |
| Border | `--border`, `--border-light` | Рамки, роздільники |
| Text | `--text`, `--text-muted`, `--text-dim` | Основний / другорядний / приглушений |
| Accent | `--gold`, `--gold-light`, `--gold-dark` | Primary (історична назва; = `preview.primary`) |
| Heading | `--heading` | Заголовки секцій (serif) |
| Nested | `--nested-surface` | Вкладені блоки всередині карток |
| Overlay | `--overlay-bg`, `--overlay-bg-strong` | Hover/active фони |
| CTA | `--cta-bg`, `--cta-shadow`, `--on-primary` | Primary-кнопки |
| Glass | `--glass-bg`, `--glass-border`, `--glass-shadow` | Скляні картки |
| Accent fill | `--accent-bg`, `--accent-bg-strong`, `--accent-border`, `--accent-border-strong` | Badge, highlight |

### 3.2 Семантичні стани (фіксовані, не темізуються)

| Стан | Токени |
|------|--------|
| Success | `--success`, `--success-bg`, `--success-text` |
| Danger | `--danger`, `--danger-bg`, `--danger-text` |
| Warning | `--warning`, `--warning-bg` |
| Info | `--info`, `--info-bg` |

Значення за замовчуванням (`src/index.css`):

```css
--success: #4a9c5d;
--success-bg: rgba(74, 156, 93, 0.18);
--success-text: #9ee0ad;
--danger: #9c4a4a;
--danger-bg: rgba(156, 74, 74, 0.18);
--danger-text: #e8b0b0;
--warning: var(--gold);
--info: #5b8fc9;
--info-bg: rgba(91, 143, 201, 0.15);
```

### 3.3 Косметичні теми

Користувач обирає тему в магазині. `PlayerContext` викликає `applyCosmeticThemeById()`.

| ID | Назва | Mode | background | surface | primary | accent | text |
|----|-------|------|------------|---------|---------|--------|------|
| `classic` | Класичний стиль | dark | `#101820` | `#182430` | `#d8a84e` | `#f1d28a` | `#f8f3e7` |
| `gennesaret-sea` | Генісаретське море | dark | `#0f2f3f` | `#174b61` | `#62b6cb` | `#f2cc8f` | `#f7fbff` |
| `eden-garden` | Едемський сад | dark | `#18251a` | `#2c432e` | `#8fb56f` | `#e0b95a` | `#f7f5e8` |
| `sinai-revelation` | Синайське одкровення | dark | `#21162f` | `#3a244a` | `#c8553d` | `#f28c28` | `#fff6ef` |
| `heavenly-jerusalem` | Небесний Єрусалим | **light** | `#f7f4ea` | `#ffffff` | `#c9a227` | `#6c63ff` | `#24242e` |

**Правила тем:**

- `:root` fallback **завжди** = тема `classic` (запобігає FOUC до завантаження профілю).
- Похідні кольори (muted text, glass, CTA gradient) обчислюються в `cosmeticTheme.ts` через `mixColor()` / `withAlpha()`.
- Semantic colors (`--success`, `--danger`) не змінюються при зміні теми.
- Тестувати нові UI на `classic` (dark) і `heavenly-jerusalem` (light).

### 3.4 Похідні кольори

Для прозорих/змішаних відтінків:

```css
/* Стандартний спосіб */
border: 1px solid color-mix(in srgb, var(--gold) 28%, transparent);

/* У runtime-темах — через cosmeticTheme.ts */
--accent-border: rgba(primary, 0.25);
```

**Заборонено:** хардкод `#4a7c59`, `#e21b3c` тощо в компонентах (окрім Kahoot — див. §10).

---

## 4. Типографіка

### 4.1 Шрифти

| Токен | Stack | Використання |
|-------|-------|--------------|
| `--font-serif` | `'Cormorant Garamond', Georgia, serif` | h1–h6, декоративні заголовки |
| `--font-sans` | `'Source Sans 3', system-ui, sans-serif` | Body, UI, кнопки, react-vant |

### 4.2 Розмірний ряд

| Токен | rem | px (при 16px base) |
|-------|-----|---------------------|
| `--fs-xs` | 0.65 | 10.4 |
| `--fs-sm` | 0.75 | 12 |
| `--fs-base` | 0.875 | 14 |
| `--fs-md` | 0.95 | 15.2 |
| `--fs-lg` | 1.1 | 17.6 |
| `--fs-xl` | 1.35 | 21.6 |
| `--fs-2xl` | 1.75 | 28 |
| `--fs-3xl` | 2.25 | 36 |

### 4.3 Міжрядковий інтервал

| Токен | Значення |
|-------|----------|
| `--lh-tight` | 1.2 |
| `--lh-normal` | 1.45 |
| `--lh-relaxed` | 1.6 |

### 4.4 Патерни використання

| Елемент | Стиль |
|---------|-------|
| Заголовок сторінки | `var(--heading)` + `var(--font-serif)` + `var(--fs-xl)` |
| Заголовок картки | `var(--gold)` + `var(--font-sans)` + `font-weight: 700` + `var(--fs-lg)` |
| Body / опис | `var(--text-muted)` + `var(--fs-sm)` + `var(--lh-normal)` |
| Kicker / badge | `var(--gold-light)` + `var(--fs-sm)` + `font-weight: 800` + `uppercase` |
| Meta / лічильник | `var(--text-muted)` + `var(--fs-sm)` + `font-weight: 500` |

**Правило:** не вводити off-scale розміри (`0.85rem`, `1.05rem`). Мапити на найближчий `--fs-*` токен.

### 4.5 Font-weight (без токенів)

| Weight | Використання |
|--------|--------------|
| 400 | Body за замовчуванням |
| 500 | Meta, labels |
| 600 | Вторинний акцент |
| 700 | Кнопки, заголовки карток |
| 800 | Kicker, stat numbers, modal titles |

---

## 5. Відступи (Spacing)

### 5.1 Офіційна шкала

| Токен | rem | px |
|-------|-----|-----|
| `--space-xs` | 0.25 | 4 |
| `--space-sm` | 0.5 | 8 |
| `--space-md` | 0.75 | 12 |
| `--space-lg` | 1 | 16 |
| `--space-xl` | 1.5 | 24 |
| `--space-2xl` | 2 | 32 |
| `--space-3xl` | 3 | 48 |

**Правило:** `gap`, `padding`, `margin` — через `var(--space-*)`.

### 5.2 Layout-константи (документовані винятки)

| Константа | Значення | Де |
|-----------|----------|-----|
| Tabbar clearance | `5.5rem` | `Layout.module.css` → `.main` padding-bottom |
| Page bottom padding | `3rem`–`5rem` | Залежно від сторінки |
| Max content width | `480px` | Layout, modals |
| Safe-area top | `max(0.75rem, env(safe-area-inset-top))` | Toast |
| Safe-area bottom | `env(safe-area-inset-bottom)` | Tabbar, modals |

```css
/* Safe-area шаблон */
padding: max(var(--space-md), env(safe-area-inset-top));
padding-bottom: calc(var(--space-md) + env(safe-area-inset-bottom));
```

---

## 6. Радіуси, тіні, переходи

### 6.1 Border radius

| Токен | px |
|-------|-----|
| `--radius-sm` | 6 |
| `--radius-md` | 10 |
| `--radius-lg` | 14 |
| `--radius-xl` | 20 |
| `--radius-full` | 9999px (pill) |

**Виняток — bottom-sheet modals:** `border-radius: 16px 16px 14px 14px` (асиметричний, не токенізований).

### 6.2 Shadows

| Токен | Значення |
|-------|----------|
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.3)` |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.35)` |
| `--shadow-lg` | `0 8px 32px rgba(0,0,0,0.45)` |
| `--shadow-gold` | `0 4px 16px var(--gold-glow)` |
| `--cta-shadow` | Динамічний, з cosmeticTheme |

### 6.3 Transitions

| Токен | ms |
|-------|-----|
| `--duration-micro` | 100 |
| `--duration-fast` | 160 |
| `--duration-normal` | 240 |
| `--duration-page` | 280 |
| `--duration-slow` | 440 |

| Easing | Токен |
|--------|-------|
| Out (UI enter) | `--ease-out` |
| In (UI exit) | `--ease-in` |
| Smooth (progress) | `--ease-smooth` |

---

## 7. Z-index

| Токен | Значення | Використання |
|-------|----------|--------------|
| `--z-base` | 1 | Локальні шари |
| `--z-dropdown` | 50 | Tabbar |
| `--z-modal` | 100 | Модалки, tooltip |
| `--z-toast` | 200 | Toast |

**Заборонено:** `z-index: 1000` або довільні числа без токена.

---

## 8. Компонентні патерни

### 8.1 App shell

```css
/* Layout.module.css */
.shell { min-height: 100dvh; background: var(--bg); }
.main { max-width: 480px; padding: var(--space-lg) var(--space-lg) 5.5rem; }
```

Page enter: fade `240ms` (`layoutTabEnter`). Вимикається при `prefers-reduced-motion`.

### 8.2 Скляна картка

Використовувати клас `.glass-card` з `index.css` або повторювати канонічний патерн:

```css
.card {
  background: var(--glass-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  transition: transform var(--duration-fast) var(--ease-out);
}
.card:active {
  transform: scale(0.98);
  border-color: var(--accent-border-strong);
}
```

### 8.3 CTA-кнопка

Використовувати глобальний клас `.btn-cta`:

```css
.btn-cta {
  background: var(--cta-bg);
  color: var(--on-primary);
  border: 1px solid color-mix(in srgb, var(--gold) 30%, transparent);
  box-shadow: var(--cta-shadow), inset 0 1px 0 rgba(255,255,255,0.3);
  font-weight: 700;
}
.btn-cta:active { transform: scale(0.98); }
```

### 8.4 Pressable

Клас `.pressable` або `:active { transform: scale(0.96–0.98) }` для інтерактивних елементів.

### 8.5 Модалки

**Два підходи (не змішувати на одному екрані):**

1. **react-vant Dialog** — `ConfirmModal.tsx` (прості підтвердження).
2. **Custom bottom-sheet** — `ExplanationModal`, `QuestionEditModal`:
   - Backdrop: `rgba(0, 0, 0, 0.62)`, `z-index: var(--z-modal)`
   - Surface: `var(--surface)`, `border: 1px solid var(--border)`
   - Radius: `16px 16px 14px 14px`
   - Max width: `480px`

### 8.6 Toast

Класи `.app-toast`, `.app-toast--success|error|warning|info` у `index.css`.  
Обгортка: react-vant `Popup` у `Toast.tsx`.

### 8.7 Skeleton

`react-vant Skeleton` через `AppSkeleton.tsx`. Контейнери — `skeletons.module.css` з токенами `--surface`, `--border`, `--radius-lg`, `--space-*`.  
Кольори shimmer — з Vant theme vars (`skeletonParagraphBackground`).

### 8.8 Focus

```css
button:focus-visible, a:focus-visible, input:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}
```

### 8.9 Inputs

```css
input, select, textarea {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-sm) var(--space-md);
  color: var(--text);
}
input:focus { border-color: var(--gold); }
```

---

## 9. react-vant інтеграція

`VantProvider` обгортає застосунок і синхронізує:

1. `<ConfigProvider themeVars={...}>` — runtime props
2. `applyVantThemeToDocument()` — `--rv-*` CSS vars на `:root`

Ключові маппінги (`vantTheme.ts`):

| Vant var | Джерело |
|----------|---------|
| `primaryColor` | `preview.primary` |
| `textColor` | `preview.text` |
| `backgroundColor` | `preview.background` |
| `backgroundColorLight` | `preview.surface` |
| `tabbarItemActiveColor` | `preview.primary` |
| `successColor` | `#4a9c5d` (фіксований) |
| `dangerColor` | `#9c4a4a` (фіксований) |

Tabbar у `Layout.tsx` додатково: `activeColor="var(--gold)"`, `inactiveColor="var(--text-muted)"`.

---

## 10. Винятки

### Kahoot mode

`src/pages/play/kahoot/Kahoot.module.css` — окремий arcade-стиль (брендові кольори Kahoot: `#e21b3c`, `#1368ce`, `#d89e00`, `#26890c`).  
**Не підпорядковується** загальним токенам. Не переносити Kahoot-патерни на інші сторінки.

---

## 11. Browser Support & Modern Web

**Цільова платформа:** Telegram WebView, сучасні мобільні браузери (iOS Safari 16+, Chrome Android).  
**Політика:** Baseline Widely Available CSS. Без polyfills.

### Обов'язкові практики

| Практика | Реалізація |
|----------|------------|
| `color-scheme` | `light` / `dark` на `<html>` при застосуванні косметичної теми |
| `accent-color` | `var(--gold)` на `:root` для нативних контролів |
| `scrollbar-gutter: stable` | На `html` — запобігає layout shift |
| `100dvh` | Замість `100vh` для mobile shell |
| `color-mix()` | Для похідних кольорів (кнопки, borders) |
| `prefers-reduced-motion` | Всі анімації вимикаються (вже в `index.css`) |
| `backdrop-filter` | З `-webkit-backdrop-filter` префіксом |
| FOUC prevention | `:root` = classic + раннє `applyCosmeticThemeById()` у `main.tsx` |

### Не використовувати

- `prefers-color-scheme` для вибору палітри застосунку (теми user-selected, не OS-driven).
- Анімацію `scrollbar-color` (WebKit flicker bug).
- `100vh` на mobile (address bar issues).

---

## 12. Анти-патерни

| Не робити | Робити замість |
|-----------|----------------|
| Хардкод `#4a7c59` для success | `var(--success)` |
| `z-index: 50` / `1000` | `var(--z-modal)` / `var(--z-toast)` |
| Inline `style={{ color: '#...' }}` | CSS module + `var(--*)` |
| Дублювати CTA/glass стилі в кожному модулі | `.btn-cta`, `.glass-card` |
| Off-scale font sizes | Найближчий `--fs-*` |
| Ad-hoc spacing (`0.85rem`) | `var(--space-*)` |
| Картка в картці без причини | Плоский surface + nested-surface |
| Default react-vant вигляд без теми | Завжди через `VantProvider` |

---

## 13. Чеклист для нового UI

- [ ] Кольори тільки через `var(--*)`
- [ ] Spacing через `var(--space-*)`
- [ ] Radius через `var(--radius-*)` (окрім bottom-sheet modals)
- [ ] Typography через `--fs-*` + правильний `--font-*`
- [ ] `:active` / `:focus-visible` стани
- [ ] `prefers-reduced-motion` враховано
- [ ] Safe-area для fixed елементів
- [ ] Перевірено на `classic` (dark) і `heavenly-jerusalem` (light)
- [ ] Z-index через токени
- [ ] Не виглядає як generic template

---

## 14. Backlog (Phase 2)

Наступні кроки для повної узгодженості (не блокують поточну розробку):

- Міграція game-сторінок (Millionaire, Quiz) на spacing-токени
- Рефакторинг модулів на `.btn-cta` / `.glass-card` замість дублювання
- Уніфікація modal-систем (Dialog vs bottom-sheet)
- Додавання `--radius-card: 16px` як окремого токена для ThemeCard
- Semantic colors, адаптовані до light-теми

---

## 15. Аудит відповідності

Повне порівняння кодової бази з цими правилами: [DESIGN_AUDIT.md](DESIGN_AUDIT.md).

---

*Останнє оновлення: узгоджено з `index.css`, `cosmetics.ts`, `cosmeticTheme.ts` (тема classic як fallback).*
