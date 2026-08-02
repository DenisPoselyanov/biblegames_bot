# Bible Games — документація

Ця папка є єдиною точкою входу до актуальної документації проєкту.

## Головні документи

1. [BIBLE_GAMES_MASTER_SPECIFICATION.md](./BIBLE_GAMES_MASTER_SPECIFICATION.md) — канонічна специфікація продукту, архітектури, пріоритетів, великих фаз і Definition of Done.
2. [AI_AGENT_MASTER_EXECUTION_PROMPT.md](./AI_AGENT_MASTER_EXECUTION_PROMPT.md) — універсальний execution prompt для Codex, Claude Code та інших coding agents.
3. [PHASE_STATUS.md](./PHASE_STATUS.md) — короткий фактичний статус великих фаз.
4. [DECISIONS.md](./DECISIONS.md) — журнал прийнятих архітектурних і продуктових рішень.

## Активні domain-документи

- [PHASE_3_REBRANDING_AND_THEME_SYSTEM.md](./PHASE_3_REBRANDING_AND_THEME_SYSTEM.md) — обов’язкова специфікація ребрендингу Phase 3: тема `Світло`, premium spiritual minimalism, semantic tokens, UI migration, accessibility, theme contract і межа з платними темами Phase 6.
- [DESIGN_RULES.md](./DESIGN_RULES.md) — канонічні правила кольорів, типографіки, spacing, surfaces, компонентів, imagery, game-mode exceptions і visual QA.
- [MOTION_SYSTEM.md](./MOTION_SYSTEM.md) — канонічні transitions, micro-interactions, correct/wrong feedback, level/rank/achievement celebrations, Kahoot/«Мільйонер», reduced motion, performance budgets і binding розподіл імплементації між Phase 1–8.
- [MONETIZATION_STRATEGY.md](./MONETIZATION_STRATEGY.md) — варіанти Telegram Ads, Stars, підписок, affiliate program, sponsorships і Church-плану для Phase 6; конкретна модель ще не обрана.

## Активні операційні документи

- [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) — пояснення структури й роботи з проєктом.
- [LOCAL_TOOLS.md](./LOCAL_TOOLS.md) — локальні команди та операційні нотатки.
- [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) — налаштування PostgreSQL/Supabase через Express BFF.
- [AI_SETUP.md](./AI_SETUP.md) — безпечне використання поточних legacy AI-інструментів до реалізації Phase 4.

## Архів

Старі roadmap, task boards, audits і замінені документи перенесені до [archive/](./archive/README.md).

Архівні файли зберігаються лише для історії. Вони не визначають актуальний scope, порядок фаз або статус реалізації.

## Правило джерела правди

У разі розбіжності документи мають такий пріоритет:

1. `BIBLE_GAMES_MASTER_SPECIFICATION.md`;
2. прийняті рішення в `DECISIONS.md`;
3. active domain-document відповідної фази;
4. фактичний код і перевірені tests;
5. операційні документи;
6. архівні документи не використовуються для нової роботи.

`PHASE_3_REBRANDING_AND_THEME_SYSTEM.md`, `DESIGN_RULES.md` і `MOTION_SYSTEM.md` деталізують Phase 3, але не створюють окремої нумерації або паралельного roadmap. Розподіл motion-роботи між іншими фазами в `MOTION_SYSTEM.md` є implementation allocation, а не новою системою фаз.

Не створюйте новий master roadmap, task board, паралельну дизайн-систему або другу motion-систему поруч із цією структурою.