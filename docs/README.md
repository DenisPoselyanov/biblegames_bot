# Bible Games — канонічна документація

Ця папка є єдиною точкою входу до актуальної документації проєкту.

## Почати звідси

1. [BIBLE_GAMES_MASTER_SPECIFICATION.md](./BIBLE_GAMES_MASTER_SPECIFICATION.md) — продукт, архітектура, великі Phase та глобальний Definition of Done.
2. [OPEN_SOURCE_REFERENCE_ARCHITECTURE.md](./OPEN_SOURCE_REFERENCE_ARCHITECTURE.md) — binding уточнення стеку, modular-monolith архітектури, MVP, roadmap і правил використання open-source референсів.
3. [PHASE_STATUS.md](./PHASE_STATUS.md) — фактичний стан канонічних Phase.
4. [phases/README.md](./phases/README.md) — окремі детальні implementation-плани Phase 0–8.
5. [AI_AGENT_MASTER_EXECUTION_PROMPT.md](./AI_AGENT_MASTER_EXECUTION_PROMPT.md) — execution rules для Codex, Claude Code та інших агентів.
6. [DECISIONS.md](./DECISIONS.md) — прийняті ADR.
7. [ROADMAP_MIGRATION.md](./ROADMAP_MIGRATION.md) — відповідність старої Phase 0–13 системи новій канонічній структурі.
8. [AI_DOCUMENTATION_RULES.md](./AI_DOCUMENTATION_RULES.md) — короткі правила вибору джерела правди та роботи з GitHub-референсами.

## Детальні плани Phase

- [Phase 0](./phases/PHASE_0_CANONICAL_DOCUMENTATION_AND_BASELINE.md)
- [Phase 1](./phases/PHASE_1_PRODUCTION_SAFETY_AND_ENGINEERING_FOUNDATION.md)
- [Phase 2](./phases/PHASE_2_CORE_ARCHITECTURE_AND_DATA_PLATFORM.md)
- [Phase 3](./phases/PHASE_3_LEARNING_PRODUCT_REBRAND_AND_MOTION.md)
- [Phase 4](./phases/PHASE_4_CONTENT_AI_AND_CONTENT_STUDIO.md)
- [Phase 5](./phases/PHASE_5_SOCIAL_GROUPS_CHALLENGES_AND_MULTIPLAYER.md)
- [Phase 6](./phases/PHASE_6_ECONOMY_SHOP_ENTITLEMENTS_AND_MONETIZATION.md)
- [Phase 7](./phases/PHASE_7_PERFORMANCE_OFFLINE_ACCESSIBILITY_AND_RELEASE.md)
- [Phase 8](./phases/PHASE_8_EXPANSION_AND_BONUS_CAPABILITIES.md)

Перед виконанням будь-якої Phase агент читає її окремий файл **разом із** `OPEN_SOURCE_REFERENCE_ARCHITECTURE.md`. Зовнішній репозиторій є джерелом патерну, а не дозволом змінювати стек або копіювати код.

## Binding domain-документи

- [OPEN_SOURCE_REFERENCE_ARCHITECTURE.md](./OPEN_SOURCE_REFERENCE_ARCHITECTURE.md) — стек, modular monolith, domain boundaries, MVP, Phase alignment і GitHub search guide.
- [PHASE_3_REBRANDING_AND_THEME_SYSTEM.md](./PHASE_3_REBRANDING_AND_THEME_SYSTEM.md)
- [DESIGN_RULES.md](./DESIGN_RULES.md)
- [MOTION_SYSTEM.md](./MOTION_SYSTEM.md)
- [MONETIZATION_STRATEGY.md](./MONETIZATION_STRATEGY.md)
- [FUTURE_UPGRADE_OPTIONS.md](./FUTURE_UPGRADE_OPTIONS.md) — advisory-каталог; кожен код потребує окремого вибору власника.

## Операційні документи

- [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)
- [LOCAL_TOOLS.md](./LOCAL_TOOLS.md)
- [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)
- [AI_SETUP.md](./AI_SETUP.md)

## Пріоритет джерел правди

1. `BIBLE_GAMES_MASTER_SPECIFICATION.md`;
2. прийняті ADR у `DECISIONS.md`;
3. `OPEN_SOURCE_REFERENCE_ARCHITECTURE.md` та інший binding domain-документ відповідної системи;
4. implementation-файл активної Phase;
5. актуальний код, migrations і перевірені tests;
6. операційні документи;
7. `FUTURE_UPGRADE_OPTIONS.md` — тільки після явного вибору конкретного коду;
8. `archive/` — лише історія.

`OPEN_SOURCE_REFERENCE_ARCHITECTURE.md` уточнює master specification, але не може змінити product mission, Phase order або прийнятий ADR. Якщо зовнішній проєкт використовує інший стек, Bible Games реалізує патерн нативно в поточному React/TypeScript/Express/PostgreSQL стеку, якщо окремий ADR не вирішив інакше.

Старий `docs/product-rebuild/` більше не є roadmap. Там залишено лише compatibility notice, а повні файли перенесені до `docs/archive/legacy-product-rebuild/`.

Не створюйте новий master roadmap, паралельну Phase-нумерацію, другу дизайн-систему або другу motion-систему.
