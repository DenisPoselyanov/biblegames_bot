# Bible Games — статус канонічних фаз

> Канонічний порядок визначає [BIBLE_GAMES_MASTER_SPECIFICATION.md](./BIBLE_GAMES_MASTER_SPECIFICATION.md). Детальні execution-плани знаходяться в [`phases/`](./phases/README.md). Стек, MVP, domain boundaries і open-source reference rules уточнює [OPEN_SOURCE_REFERENCE_ARCHITECTURE.md](./OPEN_SOURCE_REFERENCE_ARCHITECTURE.md).

| Phase | Назва | Статус | Детальний план |
|---:|---|---|---|
| 0 | Canonical Documentation and Verified Baseline | completed — canonical docs migrated; reference architecture and GitHub search guide indexed | [Phase 0](./phases/PHASE_0_CANONICAL_DOCUMENTATION_AND_BASELINE.md) |
| 1 | Production Safety & Engineering Foundation | **next** — trusted Telegram principal, RBAC, server authority, Zod contracts, test/CI/audit foundation | [Phase 1](./phases/PHASE_1_PRODUCTION_SAFETY_AND_ENGINEERING_FOUNDATION.md) |
| 2 | Core Architecture & Authoritative Data Platform | blocked by Phase 1 — modular monolith, Drizzle/PostgreSQL schema, revisions, jobs, object storage і read models | [Phase 2](./phases/PHASE_2_CORE_ARCHITECTURE_AND_DATA_PLATFORM.md) |
| 3 | Learning Product, MVP, Rebrand & Motion | partial legacy UI exists; canonical completion blocked by Phase 1–2 — має довести `lesson → practice → review → mastery → progress` і інтегрувати «Мільйонер» через спільний Question Runtime | [Phase 3](./phases/PHASE_3_LEARNING_PRODUCT_REBRAND_AND_MOTION.md) |
| 4 | Content Quality, Reviewed AI Pipeline & Content Studio | planned; blocked by Phase 2–3 — authoring, revisions, validation, queue, media proposals, human review і atomic publication | [Phase 4](./phases/PHASE_4_CONTENT_AI_AND_CONTENT_STUDIO.md) |
| 5 | Social, Groups, Challenges & Multiplayer | planned — private communities і async challenges спочатку; persistent/reconnectable Kahoot після них | [Phase 5](./phases/PHASE_5_SOCIAL_GROUPS_CHALLENGES_AND_MULTIPLAYER.md) |
| 6 | Economy, Shop, Entitlements & Monetization | planned; monetization model not selected — immutable ledger, entitlements і no-pay-to-win | [Phase 6](./phases/PHASE_6_ECONOMY_SHOP_ENTITLEMENTS_AND_MONETIZATION.md) |
| 7 | Performance, Offline, Accessibility & Public Release | planned — offline capability matrix, media/CDN, accessibility, observability, load tests і release gates | [Phase 7](./phases/PHASE_7_PERFORMANCE_OFFLINE_ACCESSIBILITY_AND_RELEASE.md) |
| 8 | Expansion and Bonus Capabilities | optional future — advanced adaptive learning/FSRS, Church/Classroom, bounded AI assistant та інші owner-approved options | [Phase 8](./phases/PHASE_8_EXPANSION_AND_BONUS_CAPABILITIES.md) |

## Canonical MVP

Перший production MVP завершується всередині Phase 3 після виконання залежностей Phase 1–2. Він має довести один повний server-authoritative цикл:

```text
published lesson
→ checkpoint
→ practice session with frozen question revisions
→ feedback and explanation
→ mistake review
→ objective mastery
→ progress dashboard
```

У цей MVP входить «Мільйонер» як перша гра на спільному Question Runtime. Live Kahoot, відкриті communities, Stars/Premium, user-facing AI chat, full offline rewards і Redis-based horizontal realtime не є MVP blockers.

## Важливе розмежування

Старий `docs/product-rebuild/MASTER_ROADMAP.md` мав іншу нумерацію Phase 0–13. Його Phase 0–7 були реалізовані в коді й залишаються частиною актуального baseline, але **не означають**, що канонічні Phase 0–7 завершені. Відповідність і правила переходу описані в [ROADMAP_MIGRATION.md](./ROADMAP_MIGRATION.md).

## Binding domain-документи

- [OPEN_SOURCE_REFERENCE_ARCHITECTURE.md](./OPEN_SOURCE_REFERENCE_ARCHITECTURE.md) — stack, modular monolith, Question Bank/Runtime, Lesson Blocks, MVP, reference repos і search guide.
- [PHASE_3_REBRANDING_AND_THEME_SYSTEM.md](./PHASE_3_REBRANDING_AND_THEME_SYSTEM.md)
- [DESIGN_RULES.md](./DESIGN_RULES.md)
- [MOTION_SYSTEM.md](./MOTION_SYSTEM.md)
- [MONETIZATION_STRATEGY.md](./MONETIZATION_STRATEGY.md)
- [FUTURE_UPGRADE_OPTIONS.md](./FUTURE_UPGRADE_OPTIONS.md) — лише каталог кандидатів, не roadmap.

## Reference rule

Oppia, H5P, Moodle, ClassQuiz, Anki/FSRS, Frappe Learning, Kolibri й AndBible є архітектурними референсами, а не dependencies. Будь-яке копіювання коду потребує окремої license review; за замовчуванням патерн реалізується нативно в поточному React/TypeScript/Express/PostgreSQL стеку.

Статус `completed` дозволено встановити тільки після виконання acceptance criteria, migrations, tests, rollout/rollback і наявності evidence у коді.
