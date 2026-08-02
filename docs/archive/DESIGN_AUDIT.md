# DESIGN_AUDIT — поточний знімок відповідності дизайн-системі

> **Тип документа:** supporting UI audit, не roadmap.  
> **Еталон:** [DESIGN_RULES.md](../DESIGN_RULES.md)  
> **Головний порядок робіт:** [docs/BIBLE_GAMES_MASTER_SPECIFICATION.md](../BIBLE_GAMES_MASTER_SPECIFICATION.md)

Цей аудит був сформований під час попередньої хвилі UI-полірування. Старе формулювання «після Phase 1» не стосується нової Phase 1. У новій системі:

- критичні security/data задачі виконуються у Phase 1–2;
- системний learning UI — у Phase 3;
- фінальне performance/accessibility/release polish — у Phase 7.

## Підсумок baseline

| Метрика | Зафіксований стан | Оцінка |
|---|---:|---|
| CSS modules без Kahoot | близько 30 | значна UI база вже існує |
| Critical hardcoded hex | виправлено в основних перевірених файлах | добре |
| Z-index без token | залишалися в декількох modules | борг |
| Використання shared `.btn-cta` / `.glass-card` | практично відсутнє | критичне дублювання |
| CTA pattern duplicates | приблизно 15 блоків / 11 files | борг |
| Glass pattern duplicates | приблизно 8 files | борг |
| Kahoot arcade palette | documented exception | допустимо |

Орієнтовна попередня відповідність дизайн-правилам була близько 78%, але це не є автоматично актуальною метрикою після наступних змін. Перед Phase 3 потрібний повторний automated/manual scan.

## Що вже добре

- tokens у `src/index.css`;
- runtime cosmetic themes;
- Vant theme integration;
- early theme application/FOUC prevention;
- `color-scheme` і `accent-color`;
- Layout token compliance;
- safe-area practices;
- reduced motion;
- окремий documented Kahoot visual language;
- значна частина semantic colors переведена на variables.

## Основний UI debt

### Shared primitives фактично не adopted

Глобальні або спільні CTA/glass/pressable patterns були визначені, але різні screens продовжували дублювати стилі.

Ціль:

- shared Button/Card/Surface/Modal/Sheet primitives;
- один canonical interaction pattern;
- consistent focus/disabled/loading states;
- без масового копіювання CSS.

### Radius, spacing і typography

У game/admin screens залишалися:

- hardcoded radius;
- off-scale spacing;
- off-scale font sizes;
- різні `999px`, `20px`, `14px`, `0.85rem` patterns;
- inconsistent dense/comfortable layouts.

Ціль — token migration без сліпої заміни, яка ламає спеціальні game layouts.

### Z-index

Потрібно:

- inventory stacking contexts;
- modal/toast/nav layers;
- token usage;
- перевірка `transform`, `filter`, `backdrop-filter`, які створюють нові contexts;
- mobile keyboard/sheet behavior.

### Modals

Існували щонайменше два підходи:

- react-vant Dialog;
- custom bottom sheets/modals.

Потрібно визначити:

- коли Dialog;
- коли bottom sheet;
- shared backdrop/focus trap/escape behavior;
- safe-area;
- scroll lock;
- accessibility.

### Inline styles і content colors

Допустимі:

- runtime CSS custom properties;
- calculated progress widths;
- documented data-driven accents.

Потрібно прибрати:

- випадкові hardcoded semantic colors;
- style objects, які дублюють CSS modules;
- theme logic у component render.

## Підтверджені винятки

### Kahoot

Kahoot може мати окрему arcade palette. Виняток не дозволяє переносити arcade patterns у learning screens.

### Theme/content accents

Theme card colors можуть бути content data, якщо:

- контраст перевіряється;
- вони передаються через CSS variables;
- semantic success/error не змішуються з decorative accent.

### Mastery heatmap

Потрібна окрема mastery scale (`--mastery-*`), а не випадкові inline green values.

## Новий порядок виправлення

### До Phase 3

- не починати великий visual rewrite раніше за Phase 1/2;
- дозволені лише accessibility, broken layout і security-related UI fixes;
- зберегти design tokens.

### У Phase 3

- повторний design inventory;
- app shell/navigation;
- shared primitives;
- Today/Learn/Progress states;
- mobile widths 320/360/390;
- loading/empty/error/offline;
- token adoption;
- legacy screen compatibility.

### У Phase 7

- фінальний accessibility audit;
- performance/motion audit;
- text scaling;
- screen reader;
- device matrix;
- visual regression;
- removal of obsolete CSS.

## Acceptance checklist для UI PR

- [ ] відповідає `DESIGN_RULES.md`;
- [ ] не створює паралельний token set;
- [ ] працює на 320px;
- [ ] touch targets не менші за 44×44 CSS px для основних controls;
- [ ] safe-area перевірена;
- [ ] keyboard/focus перевірені;
- [ ] reduced motion працює;
- [ ] loading/empty/error states існують;
- [ ] contrast достатній;
- [ ] не використовується лише колір для meaning;
- [ ] немає accidental horizontal scroll;
- [ ] visual change має screenshot/manual evidence;
- [ ] critical learning flow не залежить від animation;
- [ ] Kahoot exception не поширюється на інші screens.

## Правило оновлення

Після суттєвої хвилі UI змін цей файл оновлюється фактичними scan results і датою. Не використовувати старі відсотки як доказ поточної відповідності.