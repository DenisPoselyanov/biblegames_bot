# Bible Games — статус канонічних фаз

> Канонічний порядок визначає [BIBLE_GAMES_MASTER_SPECIFICATION.md](./BIBLE_GAMES_MASTER_SPECIFICATION.md). Детальні execution-плани знаходяться в [`phases/`](./phases/README.md).

| Phase | Назва | Статус | Детальний план |
|---:|---|---|---|
| 0 | Canonical Documentation and Verified Baseline | completed — canonical docs migrated onto current `main`; legacy roadmap archived | [Phase 0](./phases/PHASE_0_CANONICAL_DOCUMENTATION_AND_BASELINE.md) |
| 1 | Production Safety & Engineering Foundation | next — старі feature phases не закривають auth, RBAC, server authority, audit та CI gates | [Phase 1](./phases/PHASE_1_PRODUCTION_SAFETY_AND_ENGINEERING_FOUNDATION.md) |
| 2 | Core Architecture & Authoritative Data Platform | blocked by Phase 1 | [Phase 2](./phases/PHASE_2_CORE_ARCHITECTURE_AND_DATA_PLATFORM.md) |
| 3 | Learning Product, Rebrand & Motion | partial legacy implementation exists behind flags; canonical completion blocked by Phase 1–2 | [Phase 3](./phases/PHASE_3_LEARNING_PRODUCT_REBRAND_AND_MOTION.md) |
| 4 | Content Quality, Reviewed AI Pipeline & Content Studio | planned; blocked by Phase 2–3 | [Phase 4](./phases/PHASE_4_CONTENT_AI_AND_CONTENT_STUDIO.md) |
| 5 | Social, Groups, Challenges & Multiplayer | planned | [Phase 5](./phases/PHASE_5_SOCIAL_GROUPS_CHALLENGES_AND_MULTIPLAYER.md) |
| 6 | Economy, Shop, Entitlements & Monetization | planned; monetization model not selected | [Phase 6](./phases/PHASE_6_ECONOMY_SHOP_ENTITLEMENTS_AND_MONETIZATION.md) |
| 7 | Performance, Offline, Accessibility & Public Release | planned | [Phase 7](./phases/PHASE_7_PERFORMANCE_OFFLINE_ACCESSIBILITY_AND_RELEASE.md) |
| 8 | Expansion and Bonus Capabilities | optional future | [Phase 8](./phases/PHASE_8_EXPANSION_AND_BONUS_CAPABILITIES.md) |

## Важливе розмежування

Старий `docs/product-rebuild/MASTER_ROADMAP.md` мав іншу нумерацію Phase 0–13. Його Phase 0–7 були реалізовані в коді й залишаються частиною актуального baseline, але **не означають**, що канонічні Phase 0–7 завершені. Відповідність і правила переходу описані в [ROADMAP_MIGRATION.md](./ROADMAP_MIGRATION.md).

## Binding domain-документи

- [PHASE_3_REBRANDING_AND_THEME_SYSTEM.md](./PHASE_3_REBRANDING_AND_THEME_SYSTEM.md)
- [DESIGN_RULES.md](./DESIGN_RULES.md)
- [MOTION_SYSTEM.md](./MOTION_SYSTEM.md)
- [MONETIZATION_STRATEGY.md](./MONETIZATION_STRATEGY.md)
- [FUTURE_UPGRADE_OPTIONS.md](./FUTURE_UPGRADE_OPTIONS.md) — лише каталог кандидатів, не roadmap.

Статус `completed` дозволено встановити тільки після виконання acceptance criteria, migrations, tests, rollout/rollback і наявності evidence у коді.