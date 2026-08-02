# Bible Games — канонічна motion-система

> **Статус:** активне domain-джерело правди для анімацій, переходів, feedback, celebrations і motion QA  
> **Основна фаза реалізації:** Phase 3 — Learning-First Product Rebuild  
> **Залежності:** Phase 1–2 для authoritative events; Phase 5–6 для social/economy-specific motion; Phase 7 для release hardening  
> **Пов’язані документи:** [`BIBLE_GAMES_MASTER_SPECIFICATION.md`](./BIBLE_GAMES_MASTER_SPECIFICATION.md), [`PHASE_3_REBRANDING_AND_THEME_SYSTEM.md`](./PHASE_3_REBRANDING_AND_THEME_SYSTEM.md), [`DESIGN_RULES.md`](./DESIGN_RULES.md)

---

# 1. Призначення

Цей документ визначає одну узгоджену motion-систему Bible Games для:

- переходів між екранами;
- відкриття вкладених маршрутів;
- tab navigation;
- loading, skeleton, empty, offline і error states;
- уроків і навчальних блоків;
- правильної та неправильної відповіді;
- progress, XP, streak, achievements, level up і rank up;
- крамниці, theme preview, покупки та entitlement;
- спільнот, викликів і leaderboard;
- Kahoot-подібних кімнат;
- режиму «Мільйонер»;
- інших існуючих і майбутніх режимів;
- haptic і optional sound feedback;
- reduced motion, low-end devices, accessibility і performance.

Motion не є декоративним шаром, який додається після завершення UI. Він є частиною interaction design і повинен:

1. пояснювати зміну стану;
2. зберігати просторову послідовність;
3. підтверджувати дію користувача;
4. підсилювати лише справді важливі досягнення;
5. не затримувати навчання;
6. не створювати casino-like або дитяче відчуття;
7. залишатися зрозумілим без руху.

---

# 2. Канонічний характер motion

> **Calm premium motion + clear state feedback + restrained spiritual celebration.**

Motion Bible Games має відчуватися:

- м’яким;
- точним;
- коротким;
- впевненим;
- світлим;
- преміальним;
- природним;
- стабільним у Telegram WebView.

Motion не має бути:

- гумовим;
- надмірно пружним;
- дитячим;
- агресивним;
- постійно пульсуючим;
- схожим на казино;
- повільним заради «кінематографічності»;
- однаково великим для дрібної та великої події.

Глобальне правило:

> Чим частіше користувач бачить анімацію, тим стриманішою вона має бути. Чим рідкісніша і важливіша подія, тим урочистішою вона може стати.

На звичайному екрані одночасно допускається:

- одна головна motion-подія;
- до двох допоміжних micro-interactions;
- жодної нескінченної декоративної анімації без функціонального значення.

---

# 3. Поточний baseline коду

У репозиторії вже існує motion-фундамент:

- `framer-motion` як єдине runtime-джерело анімацій;
- `src/lib/motion.ts` із duration, easing і shared variants;
- `MotionSheet`;
- `MotionDialog`;
- `FullscreenMotion`;
- page, tab, question, correct/wrong і feedback variants;
- `AnimatePresence mode="wait"` для частини overlays;
- `useReducedMotion()` у shared motion components.

Цю основу потрібно еволюційно розширити. Заборонено:

- паралельно вводити `motion/react`, поки проєкт використовує `framer-motion`;
- створювати другу бібліотеку motion tokens;
- розкидати випадкові inline transitions по компонентах;
- дублювати correct/wrong/celebration logic у кожному режимі.

Поточні `answerCorrectVariants` і `answerWrongVariants` є baseline, але не повним interaction contract. Phase 3 повинна перетворити їх на reusable state sequences з accessibility, authoritative triggers і interruption handling.

---

# 4. Непорушні принципи

## 4.1. Motion має передавати зміст

Кожна анімація повинна відповідати хоча б на одне питання:

- що з’явилося або зникло;
- звідки відкрився новий екран;
- яку дію прийнято;
- що змінилося в progress;
- яка відповідь правильна;
- яку нагороду підтвердив сервер;
- чому користувач бачить celebration.

Якщо motion не пояснює стан — його треба прибрати.

## 4.2. Server-authoritative celebrations

Анімації, що підтверджують фінальний результат, запускаються лише після authoritative response/event:

- XP;
- coins;
- purchase success;
- entitlement grant;
- achievement;
- level up;
- rank up;
- challenge result;
- leaderboard position;
- Kahoot victory;
- «Мільйонер» victory;
- streak milestone.

Клієнт може миттєво анімувати press/selection/pending, але не має права оптимістично показувати перемогу, списання, нагороду або entitlement.

## 4.3. Idempotency

Кожна велика celebration прив’язується до stable event ID або result ID. Повторне отримання того самого event після reconnect, retry, remount або background restore не запускає celebration вдруге.

## 4.4. Motion не блокує UX

- input feedback: до 100 ms;
- стандартний route transition: до 300 ms;
- answer feedback: починається не пізніше 100 ms після authoritative result;
- звичайна celebration: до 900 ms;
- велика celebration: до 1500 ms;
- основна CTA доступна не пізніше 700–800 ms після початку великої celebration;
- користувач може продовжити, не чекаючи завершення particles.

## 4.5. Final state існує без motion

Усі states мають бути зрозумілими через:

- текст;
- icon;
- border;
- background;
- semantic status;
- ARIA announcement.

Колір або рух не можуть бути єдиним носієм змісту.

---

# 5. Motion tokens

## 5.1. Duration

| Semantic token | Target | Використання |
|---|---:|---|
| `motion.instant` | 80 ms | миттєва зміна pressed/active |
| `motion.micro` | 120 ms | icon, checkbox, small indicator |
| `motion.fast` | 160 ms | button, answer state, small feedback |
| `motion.standard` | 240 ms | card, local content transition |
| `motion.page` | 280 ms | route transition |
| `motion.progress` | 400 ms | progress, counters, chart bars |
| `motion.emphasis` | 440–600 ms | result, achievement, milestone |
| `motion.celebration` | 700–1100 ms | level up, rank up, important win |
| `motion.ceremony` | 1100–1800 ms | фінальна перемога у великому режимі |

Значення мають мапитися на існуючі `DURATION` tokens або versioned replacement. Off-scale duration у компоненті потребує пояснення.

## 5.2. Distance

```text
motion.distance.xs   = 2px
motion.distance.sm   = 6px
motion.distance.md   = 12px
motion.distance.lg   = 20px
motion.distance.page = 24px
```

Для стандартного UI заборонено без потреби переміщати елемент на 50–100 px.

## 5.3. Scale

```text
press             1 → 0.975
answer selection  1 → 0.985
soft emphasis     1 → 1.015 → 1
modal enter       0.97 → 1
achievement       0.82 → 1
major reward      0.72 → 1
```

## 5.4. Easing

### Premium smooth

```text
[0.22, 1, 0.36, 1]
```

Для page enter, progress, card reveal, achievement і result.

### Fast UI

```text
[0.16, 1, 0.3, 1]
```

Для button, sheet, answer selection і dropdown.

### Controlled exit

```text
[0.4, 0, 1, 1]
```

Exit коротший за enter.

## 5.5. Spring

Spring дозволений лише для:

- direct press;
- draggable interaction;
- active tab indicator;
- маленького badge reveal.

Spring із сильним overshoot заборонений для:

- Scripture;
- lesson content;
- dialogs;
- error states;
- prayer/reflection surfaces;
- purchase confirmation.

---

# 6. Цільова motion-архітектура

Рекомендована логічна структура без обов’язкового фізичного rewrite:

```text
src/lib/motion/
├── tokens.ts
├── easings.ts
├── variants.ts
├── sequences.ts
├── celebrations.ts
├── reducedMotion.ts
├── deviceTier.ts
└── eventDeduplication.ts

src/components/motion/
├── RouteTransition.tsx
├── MotionSheet.tsx
├── MotionDialog.tsx
├── MotionList.tsx
├── AnimatedNumber.tsx
├── AnimatedProgress.tsx
├── AnswerFeedbackMotion.tsx
├── AchievementReveal.tsx
├── LevelUpSequence.tsx
├── RankUpSequence.tsx
├── CelebrationLayer.tsx
└── GameResultSequence.tsx
```

Не обов’язково створювати кожен файл окремо. Важливі:

- один contract;
- shared presets;
- stable component APIs;
- no duplicated sequences;
- reduced-motion coverage;
- authoritative result handling;
- testability.

## 6.1. `MotionProvider`

Provider або equivalent app-level context повинен визначати:

- system reduced motion;
- user-selected motion intensity;
- device performance tier;
- particles allowed;
- haptic allowed;
- sound allowed;
- active route direction;
- replayed event IDs;
- test override.

Пріоритет:

```text
system reduced motion
→ user preference
→ device capability
→ default full motion
```

## 6.2. `AnimatedNumber`

Використовується для:

- XP;
- coins;
- score;
- prize;
- rank position;
- streak;
- correct answers;
- participant count.

Великі значення інтерполюються; не потрібно рендерити кожну одиницю.

## 6.3. `AnimatedProgress`

Progress анімується через `transform: scaleX()` або інший compositor-friendly спосіб. Не анімувати великі `width`/layout reflow без потреби.

## 6.4. `CelebrationLayer`

Один спільний шар для:

- particles;
- glow;
- rays;
- restrained confetti;
- theme-aware decorative symbols.

Не створювати окремий confetti implementation для кожного режиму.

---

# 7. Route transitions

## 7.1. Головні вкладки

Між top-level tabs використовується спокійний crossfade:

```text
old: opacity 1 → 0, 100–140 ms
new: opacity 0 → 1, y 4px → 0, 180–220 ms
```

Не використовувати повний горизонтальний slide між tabs.

Active tab:

- icon color transition;
- label opacity;
- scale `0.96 → 1`;
- optional shared indicator;
- 160–200 ms.

## 7.2. Вкладений маршрут

Forward:

```text
current: opacity 1 → 0, x 0 → -8px
next: opacity 0 → 1, x 16px → 0
```

Back:

```text
current: opacity 1 → 0, x 0 → 12px
previous: opacity 0 → 1, x -8px → 0
```

Motion лише натякає на напрям і не імітує нативний iOS navigation один в один.

## 7.3. Fullscreen game route

Для Quiz, Kahoot room, «Мільйонер», «Виживання»:

- shell softly dims або crossfades;
- fullscreen surface: `opacity 0 → 1`, `y 12–20px → 0`;
- bottom navigation exits разом із route;
- 260–320 ms;
- Telegram BackButton і browser history синхронізовані.

## 7.4. Повернення з гри

- result screen exits;
- Play Hub входить без повторної анімації всього списку;
- змінений XP/progress коротко підсвічується;
- celebration не replay-иться.

---

# 8. App launch, loading і data transitions

## 8.1. Launch

- warm ivory background з’являється відразу;
- невеликий brand mark fade 200–300 ms;
- після auth/profile logo dissolves;
- Home crossfades in;
- ніякого штучного splash delay;
- logo не pulse-иться нескінченно.

## 8.2. Skeleton

- reserved layout dimensions;
- opacity pulse `0.45 → 0.75 → 0.45`;
- 1400–1800 ms;
- без яскравого shimmer;
- disabled у minimal/reduced mode;
- skeleton → content через crossfade без CLS.

## 8.3. Slow network

- локальна дія отримує pending state;
- screen не блокується глобальним spinner без потреби;
- answer option має local pending indicator;
- button width не змінюється;
- timeout/error переходить у retryable state.

---

# 9. Home / Today

Початковий reveal:

1. header fade;
2. hero card `opacity 0 → 1`, `y 10px → 0`;
3. daily verse через 40 ms;
4. quick actions — один короткий stagger;
5. daily goal — останнім.

Уся композиція має бути стабільною за 450–550 ms.

Hero image:

- легкий `scale 1.015 → 1` тільки при першому вході;
- без постійного parallax;
- без autoplay movement;
- CTA з’являється разом із content.

Resume lesson press:

- scale `1 → 0.975`;
- arrow `x 0 → 2–3px`;
- route starts через 80–120 ms.

Verse of the day:

- card fade;
- quote icon reveal;
- copy action → check morph;
- не анімувати текст слово за словом.

---

# 10. Learning і lesson navigation

## 10.1. Search

Focus:

- stronger border;
- elevated surface;
- icon movement до 2 px;
- keyboard open не запускає animated reflow.

## 10.2. Segmented control

- shared background indicator через `layoutId` або equivalent;
- 180–220 ms;
- active label color transition;
- content list crossfade;
- no full list slide.

## 10.3. Learning cards

- stagger лише перших 4–6 visible cards;
- наступні без затримки;
- `opacity + y 6–8px`;
- card press feedback без hover dependency.

## 10.4. Accordion/module expansion

- chevron rotate 180°;
- content opacity;
- measured/grid expansion 200–260 ms;
- no bounce;
- focus і screen reader state синхронні.

## 10.5. Lesson blocks

Scripture text залишається стабільним. Заборонено:

- typewriter;
- reveal word-by-word;
- blinking;
- automatic parallax;
- motion, що ускладнює читання.

Transition між interactive lesson steps:

```text
old: opacity 1 → 0, y 0 → -4px
new: opacity 0 → 1, y 10px → 0
```

## 10.6. Lesson completion

1. progress reaches 100%;
2. check appears;
3. card moves into completed state;
4. completion message;
5. authoritative XP count-up;
6. next-step CTA.

Sequence 700–1000 ms, CTA доступна раніше завершення decorative effects.

---

# 11. Practice — answer interaction

## 11.1. Selection і pending

На press:

- scale `1 → 0.985`;
- selected border;
- indicator fill;
- інші options не рухаються.

Під час server validation:

- selected option переходить у `pending`;
- small spinner лише в indicator;
- repeat input blocked;
- screen не dim-иться;
- state має timeout/retry.

## 11.2. Правильна відповідь

Sequence:

### 0–100 ms

- selected state fixed;
- success border;
- soft success tint.

### 100–260 ms

- check icon `scale 0.7 → 1`;
- card `1 → 1.015 → 1`;
- subtle light sweep.

### 220–420 ms

- feedback panel: `Правильно!`;
- explanation;
- biblical reference.

### 320–650 ms

- XP chip;
- animated delta;
- progress update.

Не використовувати:

- fullscreen green flash;
- confetti після кожної відповіді;
- strong bounce;
- forced auto-advance;
- приховане explanation.

## 11.3. Неправильна відповідь

Sequence:

### 0–180 ms

```text
x: 0 → -3 → 3 → -2 → 0
```

### 120–280 ms

- danger tint;
- error icon;
- selected wrong answer лишається readable.

### 220–400 ms

- correct option receives success border/check;
- інші стають secondary.

### 300–520 ms

- `Не зовсім`;
- correct answer;
- explanation;
- biblical reference;
- detailed explanation action.

Заборонено:

- shame messaging;
- strong vibration;
- whole-screen shake;
- sad emoji;
- dramatic loss effect.

## 11.4. Наступне питання

1. feedback collapses/fades;
2. current card `opacity 1 → 0`, `x 0 → -8px`;
3. progress updates;
4. next card `opacity 0 → 1`, `x 12px → 0`;
5. focus moves to question heading.

220–280 ms.

## 11.5. Auto-advance

User setting may allow:

```text
manual
after 1.2 s
after 2 s
```

Default: manual, особливо коли є explanation.

---

# 12. Practice result

Sequence:

1. question card exits;
2. result icon reveal;
3. score count-up;
4. progress ring fills;
5. summary cards short stagger;
6. CTA appears.

Celebration intensity:

- ordinary completion: no particles;
- 80–99%: 6–10 soft particles;
- 100%: light ring + 10–16 particles;
- CTA available immediately after essential data appears.

---

# 13. Progress, XP, level, rank і achievements

## 13.1. Animated numbers

Changed values animate 300–500 ms. Unchanged stats do not replay on every screen open.

## 13.2. XP bar

1. current state visible;
2. delta arrives;
3. bar grows;
4. threshold: bar reaches 100%;
5. pause 100–150 ms;
6. level-up sequence;
7. reset to remainder.

Не скидати bar до нуля до показу 100%.

## 13.3. Level up

1. XP reaches 100%;
2. gold line glow;
3. old level number exits upward;
4. new level enters from below;
5. badge `1 → 1.06 → 1`;
6. thin expanding ring;
7. 8–14 soft particles;
8. unlock/reward summary;
9. CTA.

900–1400 ms. CTA can end particles.

## 13.4. Rank up

Наприклад `Шукач Слова → Учень`:

1. old plaque softens;
2. new badge outline draws;
3. central symbol reveals;
4. title crossfades;
5. restrained glow;
6. explanation of rank meaning.

1100–1600 ms. No explosion, coin spin або fireworks.

## 13.5. Achievement

Ordinary:

- badge `0.8 → 1`;
- border sweep;
- title and reason;
- optional XP delta.

Rare:

- centered elevated card;
- 8–12% dim;
- 6–10 particles;
- dismiss/continue.

Achievement list does not replay unlock celebration on every open.

## 13.6. Streak

Continue streak:

- small flame glow;
- number count-up;
- ring progress.

Milestones 7/30/100:

- milestone card;
- gold ring;
- restrained particles;
- optional share.

Lost streak:

- calm state transition;
- no destruction, red drama або shame.

---

# 14. Profile, settings і system surfaces

## 14.1. Profile

- avatar fade;
- updated progress animates only when changed;
- first visible stat cards short stagger;
- achievement opens through focused shared transition;
- timeline new milestone: line extension + dot + item fade.

## 14.2. Settings

- toggle thumb 160–200 ms, no bounce;
- segmented indicator 180–220 ms;
- sheet/dialog use shared components;
- language/translation change crossfades affected content;
- destructive action has no celebration;
- loading and result states preserve control width.

## 14.3. Toasts

- one visible toast or managed queue;
- enter `opacity + y -8 → 0`;
- success has check;
- error retains retry action;
- `AnimatePresence mode="popLayout"` or equivalent;
- does not cover bottom CTA/navigation;
- screen reader announcement.

---

# 15. Theme switching і theme-aware motion

## 15.1. Preview

- selected preview raises subtly;
- swatches transition;
- demo component crossfades;
- real app theme does not change before preview/apply intent.

## 15.2. Apply owned theme

1. neutral overlay fade;
2. CSS semantic tokens update;
3. content crossfade 240–350 ms;
4. Telegram chrome sync;
5. overlay exits;
6. no dark/light flash.

Не анімувати кожну card окремо.

## 15.3. Theme customization limits

Theme may change:

- particle palette;
- glow palette;
- decorative symbol;
- celebration texture;
- background tint.

Theme may not change:

- route direction;
- critical duration;
- success/danger meaning;
- reduced-motion behavior;
- touch feedback;
- blocking time;
- information hierarchy.

---

# 16. Shop і purchases

## 16.1. Store entrance

- standard route transition;
- balance fade;
- featured item first;
- first visible grid items short stagger.

## 16.2. Purchase pending

- press feedback;
- spinner inside button;
- button width reserved;
- no optimistic entitlement;
- duplicate request blocked by idempotency.

## 16.3. Purchase success

Після server-confirmed purchase:

1. balance count-down;
2. entitlement check reveal;
3. button morphs to `Застосувати`;
4. short gold highlight;
5. optional success haptic;
6. event marked consumed.

No falling coins or fullscreen confetti.

## 16.4. Insufficient balance

- 2–3 px horizontal nudge;
- balance highlight;
- calm explanation;
- no aggressive red flash.

## 16.5. Payment/Stars

Real-money success requires verified provider callback and reconciled server state. Client checkout completion alone does not trigger final celebration.

---

# 17. Communities, challenges і friend challenge

## 17.1. Join community

1. pending button;
2. server confirmation;
3. avatar joins stack via fade/scale;
4. member count animates;
5. CTA becomes `Відкрити`.

## 17.2. Activity feed

- new item enters through fade;
- existing rows move through controlled `popLayout`;
- no full-list replay.

## 17.3. Leaderboard

- individual rows use controlled layout animation;
- rank number crossfade;
- XP delta highlight;
- position change label `+N позицій`;
- decline is neutral, not red punishment.

## 17.4. Challenge a friend

Configuration:

- segmented indicators;
- selected friend state;
- CTA activation transition.

Send:

1. pending;
2. small challenge/paper-plane icon movement 6–8 px;
3. server confirmation;
4. `Виклик надіслано`;
5. view/cancel actions.

Accept:

- avatars move slightly toward center;
- `VS` appears;
- start CTA.

No aggressive fighting animation.

---

# 18. Kahoot-like multiplayer

## 18.1. Lobby

Participant join:

```text
opacity 0 → 1
scale 0.82 → 1
y 6px → 0
```

- count animates;
- grid uses `popLayout`;
- host start button gets one highlight when ready;
- no permanent pulse.

## 18.2. Countdown

```text
3 → 2 → 1 → Почали
```

Each:

- `scale 0.8 → 1`;
- opacity;
- short halo;
- 500–650 ms;
- no flashing;
- timer begins only after clients receive authoritative start.

## 18.3. Question enter

1. stable header/progress;
2. question card fade/up;
3. answer tiles stagger 40–60 ms;
4. timer starts after answer UI ready according to server time.

## 18.4. Timer

- ring/line progress;
- last seconds change accent;
- no pulse every second;
- one restrained emphasis at last 3 seconds;
- reduced mode: numeric update only.

## 18.5. Answer selection

- selected tile scale `0.98`;
- lock indicator;
- others reduce emphasis;
- no repeat movement after lock.

## 18.6. Reveal

- correct tile success;
- selected wrong tile danger;
- others muted;
- score updates after authoritative result;
- no client-side final score.

## 18.7. Intermediate leaderboard

- rows move 350–500 ms;
- rank crossfade;
- score count-up;
- top 3 restrained glow;
- personal change summarized.

## 18.8. Final podium and victory

1. leaderboard dims;
2. third place enters;
3. second place enters;
4. first place enters;
5. winner badge/ring;
6. 20–30 light particles;
7. restrained confetti;
8. result CTA active after ~700 ms.

Non-winners receive:

- personal place;
- correct answers;
- progress;
- positive next action;
- no «defeat» drama.

Victory is keyed to server result ID and cannot replay after reconnect.

---

# 19. «Мільйонер»

## 19.1. Mode entry

- deeper theme-aware background;
- ladder fade;
- question stage rises;
- lifelines stagger;
- no long television intro.

## 19.2. Answer selection

First tap:

- selected navy/gold state;
- single border emphasis;
- optional confirmation for high stakes.

Lock:

1. outline contracts;
2. lock icon;
3. other options muted;
4. suspense pause 350–600 ms;
5. authoritative reveal.

## 19.3. Correct answer

1. answer success state;
2. check;
3. light sweep;
4. ladder moves to next prize;
5. amount count-up;
6. milestone badge if applicable;
7. CTA.

Ordinary: 500–800 ms. Safe milestone: 900–1200 ms.

## 19.4. Wrong answer

1. selected answer danger;
2. correct answer shown;
3. ladder rolls to guaranteed amount;
4. final amount updates;
5. result card.

No screen crack, falling money, red flashing або whole-screen shake.

## 19.5. Final victory

1. final answer confirmed;
2. background lightens slightly;
3. top prize highlight;
4. amount count-up;
5. gold line through ladder;
6. winner badge/crown `0.72 → 1`;
7. thin radial rays;
8. 24–40 theme-aware particles;
9. CTA after 700–800 ms;
10. summary and share.

Total decorative motion до 1500 ms.

## 19.6. Lifelines

### 50:50

- two wrong options fade;
- reserved positions remain;
- 240–320 ms.

### Audience

- bars grow through `scaleY`;
- numbers count;
- 500–700 ms;
- result does not explicitly mark correct answer.

### Call a friend

- shared sheet/dialog;
- short typing state;
- no long fake-call sequence.

---

# 20. Bottom sheets, dialogs і overlays

## 20.1. Bottom sheet

```text
backdrop: opacity 0 → 1
sheet: y 12% → 0
opacity 0 → 1
220–280 ms
```

Exit slightly faster.

## 20.2. Dialog

```text
scale 0.97 → 1
y 8px → 0
opacity 0 → 1
```

## 20.3. Functional requirements

Motion components also require:

- focus trap;
- Escape/back handling;
- body scroll lock;
- return focus;
- Telegram BackButton integration;
- safe-area;
- no invisible clickable exiting layer;
- explicit `AnimatePresence` mode.

---

# 21. Empty, offline, error і reconnect

## Empty

- illustration fade;
- title/action;
- no looping decoration.

## Offline

- network state transition;
- existing content remains stable;
- reconnect gets small confirmation;
- multiplayer/payment clearly unavailable.

## Error

- no whole-screen shake for server errors;
- message + retry;
- critical state remains readable;
- local input errors may use tiny nudge.

## Reconnect

- restore room/session state;
- do not replay old answer or victory animations;
- only new authoritative event IDs animate;
- timer reconciles with server time instead of restarting visually.

---

# 22. Haptic feedback

Haptic is optional and uses supported Telegram/platform API only.

| Event | Recommended feedback |
|---|---|
| normal press | none або selection |
| correct answer | light success |
| wrong answer | very light warning |
| purchase success | success |
| level up | medium success |
| rank up | medium success |
| Kahoot/Millionaire victory | success |
| destructive confirmation | warning |

Rules:

- user can disable haptics;
- no strong vibration for wrong answer;
- haptic does not replace visual/ARIA state;
- unsupported platforms fail silently without changing logic.

---

# 23. Optional sound design

Sound is not required for Phase 3 core completion unless explicitly approved. Potential settings:

- interface sounds;
- game sounds;
- major achievement sounds.

Style:

- short;
- warm;
- clean;
- no arcade bleeps;
- no loud fanfares;
- no church bells on routine actions;
- major achievements may use restrained tonal chime.

Sound never autoplays before user interaction and never replaces visual feedback.

---

# 24. Reduced motion

At `prefers-reduced-motion: reduce` or internal minimal mode:

- page slide → fade;
- scale effects removed;
- shake removed or replaced by icon/border;
- particles/confetti removed;
- counter may crossfade;
- progress updates faster;
- achievement becomes static card;
- countdown does not zoom;
- layout movement minimized;
- decorative loops disabled.

Correct/wrong states remain clear through text, icon, border and ARIA.

System reduced-motion always overrides app preference.

---

# 25. User motion intensity

Optional setting:

## Full

- all functional transitions;
- particles for major events;
- full level/rank/game celebrations;
- counters;
- haptics if enabled.

## Reduced

- page and state transitions;
- no large particle effects;
- simplified celebrations.

## Minimal

- opacity only;
- static state updates;
- no shake, scale, confetti, decorative motion.

---

# 26. Low-end device mode

Heuristic may consider memory, hardware concurrency, runtime frame drops and Telegram WebView limitations.

In low-end mode:

- particles reduced/disabled;
- blur reduced;
- shadow layers simplified;
- distance reduced;
- stagger removed;
- large celebration uses 6–10 elements;
- transform/opacity only;
- no large animated filters;
- no fullscreen canvas if CSS/DOM is sufficient.

Device tier must not alter business logic or final state.

---

# 27. Performance budget

Targets:

- 60 FPS on normal supported mobile device;
- no visible CLS;
- input feedback under 100 ms;
- page transition under 300 ms;
- answer feedback starts under 100 ms after result;
- ordinary result sequence under 600–900 ms;
- major celebration under 1500 ms;
- CTA not blocked longer than 800 ms;
- timers/listeners cleaned on unmount;
- no duplicate animation after reconnect.

Avoid animating:

- `top`;
- `left`;
- large `width`/`height`;
- heavy box-shadow every frame;
- fullscreen blur filters;
- large background image parallax;
- complex SVG filters;
- large layout containers with `layout`.

Use:

- transform;
- opacity;
- `scaleX`/`scaleY`;
- controlled `layout` only for small rows/items.

---

# 28. Accessibility і announcements

Examples:

Correct:

> «Правильно. Ной побудував ковчег. Додано 50 XP.»

Wrong:

> «Відповідь неправильна. Правильна відповідь — Ной.»

Level:

> «Досягнуто рівень 13.»

Leaderboard:

> «Ваша позиція — друге місце.»

Requirements:

- controlled `aria-live`;
- no duplicate announcements;
- focus moves to new screen/question/dialog/result heading;
- focus never moves to decorative particle;
- color-independent meaning;
- large text does not break animated layout;
- reduced motion tested.

---

# 29. Motion QA matrix

Кожен critical sequence перевіряється у станах:

```text
full motion
reduced motion
minimal motion
low-end mode
slow network
server error
rapid double tap
route interruption
background/foreground restore
reconnect
Android Telegram
іOS Telegram
mobile browser
light theme
dark theme
large text
missing imagery
```

Automated/semiautomated checks:

- one animation package;
- explicit `AnimatePresence` mode;
- reduced-motion coverage;
- no invisible clickable exiting element;
- timer cleanup;
- no duplicate celebration;
- route interruption reaches correct final state;
- persisted theme restore;
- authoritative result gating;
- visual regression fixtures;
- no horizontal overflow;
- no critical accessibility violation.

---

# 30. Розподіл імплементації за Phase

Ця секція є binding implementation allocation. Вона не створює мікрофази.

## Phase 1 — Production Safety & Engineering Foundation

Motion-related responsibility:

- server-authoritative result для rewards, purchases, progression і competitive outcomes;
- idempotency keys;
- stable event/result IDs;
- duplicate/replay protection;
- no client-trusted win/reward event;
- integration tests, що повторний request не створює другий reward;
- reconnect/retry не генерує друге authoritative event;
- critical event timestamps і audit.

Phase 1 не реалізує full visual redesign, але створює безпечні triggers для майбутніх celebrations.

Acceptance:

- duplicate answer/purchase/completion не створює duplicate celebration-worthy event;
- forged client payload не може викликати level/rank/purchase/victory;
- events мають stable IDs;
- server result однозначно визначає delta і final state.

## Phase 2 — Core Architecture & Authoritative Data Platform

Motion-related responsibility:

- typed outcome/event contracts;
- normalized deltas: XP, coins, progress, level, rank, achievement, entitlement;
- client state machine boundaries;
- server time contract для multiplayer timers;
- event consumption persistence;
- no duplicated interpretation між frontend modes;
- schema versioning для user motion preference;
- test fixtures authoritative outcomes.

Recommended concepts:

```text
ProgressionOutcome
EconomyOutcome
GameOutcome
AchievementGrantEvent
LevelChangedEvent
RankChangedEvent
EntitlementGrantedEvent
```

Acceptance:

- all clients consume same typed final outcome;
- replayed event identified;
- timer can reconcile with server clock;
- UI does not derive final competitive result independently.

## Phase 3 — Learning-First Product Rebuild

Primary motion implementation:

- canonical motion tokens/easing/distance;
- shared motion architecture;
- `MotionProvider` or equivalent;
- route transitions;
- tab transitions;
- sheets/dialogs hardening;
- animated number/progress;
- launch/loading/skeleton;
- Home/Today;
- Learning;
- Lessons;
- correct/wrong answer;
- practice result;
- profile/progress/settings;
- level up;
- rank up;
- achievement;
- streak;
- theme switching;
- motion intensity setting;
- reduced-motion implementation;
- haptic preference and safe wrapper;
- base fixtures for existing game modes;
- shared celebration layer.

Phase 3 may style existing game modes, but server-backed multiplayer-specific behavior remains Phase 5 and purchase-specific behavior remains Phase 6.

Acceptance:

- all core learning flows use shared motion presets;
- correct/wrong states accessible;
- no random inline brand motion;
- reduced/minimal mode complete;
- theme transition has no flash;
- level/rank/achievement keyed to authoritative event;
- route interruption safe;
- core critical visual regression fixtures exist.

## Phase 4 — Content Quality, AI Pipeline & Content Studio

Motion-related responsibility:

- restrained admin/productivity motion;
- AI job state transition: queued/running/review/failed/completed;
- diff/review panels;
- publication confirmation;
- no celebration that implies AI content is spiritually authoritative;
- no decorative animation during Scripture review;
- long-running job progress is honest, not fake.

Acceptance:

- job motion reflects real state;
- failed/retry states clear;
- no false progress percentage;
- review UI respects reduced motion.

## Phase 5 — Social, Groups, Challenges & Multiplayer

Motion implementation:

- community join/leave;
- member stack/count;
- activity feed;
- friend challenge send/accept;
- leaderboard reordering;
- Kahoot lobby;
- participant join;
- countdown;
- question/timer/answer reveal;
- intermediate leaderboard;
- podium;
- winner/non-winner result states;
- reconnect reconciliation;
- room recovery;
- multiplayer haptic events.

Acceptance:

- server result gates score/victory;
- timer uses server time;
- reconnect does not replay victory;
- participant list does not jank;
- non-winner experience remains respectful;
- reduced motion covers countdown/podium.

## Phase 6 — Economy, Shop, Entitlements & Monetization

Motion implementation:

- store entrance;
- catalog item states;
- theme preview;
- apply owned theme;
- purchase pending;
- server-confirmed balance update;
- entitlement grant;
- insufficient balance;
- restore purchase;
- refund/reversal state;
- verified Stars/payment success;
- catalog availability transition.

Acceptance:

- no optimistic purchase celebration;
- duplicate purchase does not animate twice;
- balance and entitlement reflect server result;
- theme switch accessible and flash-free;
- refund/reversal does not use celebratory motion;
- payment animation waits for reconciliation.

## Phase 7 — Performance, Offline, Accessibility & Public Release

Motion hardening:

- device tier;
- frame profiling;
- performance budgets;
- low-end degradation;
- Android/iOS Telegram matrix;
- reduced-motion audit;
- interruption/reconnect/background restore tests;
- visual regression coverage;
- accessibility announcements;
- memory/timer cleanup;
- no CLS;
- bundle and particle budgets;
- production monitoring for animation errors where meaningful.

Acceptance:

- critical flows meet performance budget;
- no critical accessibility issue;
- all major celebrations have minimal fallback;
- no duplicate animation after reconnect;
- no leaked timer/listener;
- no blocked navigation due to exit animation;
- release candidate passes motion QA matrix.

## Phase 8 — Expansion and Bonus Capabilities

Optional only after core product stability:

- richer theme-specific celebration packs;
- advanced sound design;
- optional spatial audio where supported;
- more sophisticated shared-element transitions;
- presentation/classroom motion presets;
- seasonal event motion;
- richer native haptics for future wrappers;
- experimental adaptive motion based on measured device performance.

Phase 8 may not weaken reduced motion, accessibility, performance or no-pay-to-win rules.

---

# 31. AI-agent implementation rules

Codex, Claude Code та інший coding agent повинен:

- read this document before any Phase touching UI/motion;
- reuse shared tokens and presets;
- inspect current implementation before changing package/import path;
- keep one motion package;
- implement final state without motion first;
- gate rewards/wins by server outcome;
- add reduced-motion behavior together with default behavior;
- handle interrupted route/remount;
- clear timers/listeners;
- add visual fixture/test;
- document new major sequence;
- profile Telegram WebView;
- report known limitations honestly.

Agent must not:

- add random inline transitions everywhere;
- create local easing for each component;
- use confetti for routine success;
- animate every card on every render;
- add infinite decorative loops;
- block CTA until particles finish;
- mix `framer-motion` and `motion/react`;
- animate final financial/competitive result before server confirmation;
- replay celebration after reconnect;
- use motion as the only error/success signal;
- ignore `prefers-reduced-motion`;
- declare motion complete after desktop browser-only check.

---

# 32. Global Definition of Done for motion

Motion work is complete only when:

1. interaction purpose is documented;
2. final state works without animation;
3. shared tokens/presets used;
4. authoritative trigger verified;
5. duplicate/replay behavior tested;
6. reduced/minimal behavior implemented;
7. low-end behavior defined;
8. keyboard/screen reader/focus correct;
9. timers/listeners cleaned;
10. interrupted navigation safe;
11. Telegram Android/iOS checked;
12. visual regression fixture exists for critical sequence;
13. performance budget met;
14. no unrelated business logic changed;
15. documentation updated.

---

# 33. Definition of success

Motion-система Bible Games успішна, коли застосунок відчувається:

- живим, але не шумним;
- ігровим, але не дитячим;
- духовним, але не театральним;
- преміальним, але не повільним;
- емоційним у важливі моменти;
- спокійним під час навчання;
- передбачуваним у кожній взаємодії;
- однаково зрозумілим із повним і мінімальним motion.
