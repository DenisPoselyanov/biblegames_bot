# Bible Games — документація

Ця папка є єдиною точкою входу до актуальної документації проєкту.

## Головні документи

1. [BIBLE_GAMES_MASTER_SPECIFICATION.md](./BIBLE_GAMES_MASTER_SPECIFICATION.md) — канонічна специфікація продукту, архітектури, пріоритетів, великих фаз і Definition of Done.
2. [phases/README.md](./phases/README.md) — індекс окремих супердетальних implementation-планів Phase 0–8.
3. [AI_AGENT_MASTER_EXECUTION_PROMPT.md](./AI_AGENT_MASTER_EXECUTION_PROMPT.md) — універсальний execution prompt для Codex, Claude Code та інших coding agents.
4. [PHASE_STATUS.md](./PHASE_STATUS.md) — короткий фактичний статус великих фаз.
5. [DECISIONS.md](./DECISIONS.md) — журнал прийнятих архітектурних і продуктових рішень.

## Детальні плани імплементації

Кожна велика Phase має окремий активний файл у [`phases/`](./phases/README.md):

- [Phase 0 — Canonical Documentation and Verified Baseline](./phases/PHASE_0_CANONICAL_DOCUMENTATION_AND_BASELINE.md);
- [Phase 1 — Production Safety & Engineering Foundation](./phases/PHASE_1_PRODUCTION_SAFETY_AND_ENGINEERING_FOUNDATION.md);
- [Phase 2 — Core Architecture & Authoritative Data Platform](./phases/PHASE_2_CORE_ARCHITECTURE_AND_DATA_PLATFORM.md);
- [Phase 3 — Learning Product, Rebrand & Motion](./phases/PHASE_3_LEARNING_PRODUCT_REBRAND_AND_MOTION.md);
- [Phase 4 — Content Quality, Reviewed AI Pipeline & Content Studio](./phases/PHASE_4_CONTENT_AI_AND_CONTENT_STUDIO.md);
- [Phase 5 — Social, Groups, Challenges & Multiplayer](./phases/PHASE_5_SOCIAL_GROUPS_CHALLENGES_AND_MULTIPLAYER.md);
- [Phase 6 — Economy, Shop, Entitlements & Monetization](./phases/PHASE_6_ECONOMY_SHOP_ENTITLEMENTS_AND_MONETIZATION.md);
- [Phase 7 — Performance, Offline, Accessibility & Public Release](./phases/PHASE_7_PERFORMANCE_OFFLINE_ACCESSIBILITY_AND_RELEASE.md);
- [Phase 8 — Expansion and Bonus Capabilities](./phases/PHASE_8_EXPANSION_AND_BONUS_CAPABILITIES.md).

Ці файли деталізують реальний baseline коду, залежності, API/data contracts, міграції, security, UI/motion, конфлікти між функціями, rollout, rollback, тести та Definition of Done. Вони не створюють нову систему мікрофаз і не можуть змінювати порядок master roadmap.

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
4. implementation-файл відповідної Phase у `docs/phases/`;
5. фактичний код і перевірені tests;
6. операційні документи;
7. архівні документи не використовуються для нової роботи.

Implementation-файл не виконується сліпо. Перед початком агент зобов’язаний звірити його з актуальним branch, git history, routes, schemas, tests та deployment. Якщо код змінився, execution brief фіксує відмінності, але не створює паралельний roadmap.

`PHASE_3_REBRANDING_AND_THEME_SYSTEM.md`, `DESIGN_RULES.md` і `MOTION_SYSTEM.md` деталізують Phase 3, але не створюють окремої нумерації. Розподіл motion-роботи між іншими фазами в `MOTION_SYSTEM.md` є implementation allocation, а не новою системою фаз.

Не створюйте новий master roadmap, task board, паралельну дизайн-систему або другу motion-систему поруч із цією структурою.