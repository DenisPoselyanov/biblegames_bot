# Bible Games — детальні плани імплементації Phase 0–8

> **Статус:** активний implementation index  
> **Канонічний roadmap:** [`../BIBLE_GAMES_MASTER_SPECIFICATION.md`](../BIBLE_GAMES_MASTER_SPECIFICATION.md)  
> **Execution prompt:** [`../AI_AGENT_MASTER_EXECUTION_PROMPT.md`](../AI_AGENT_MASTER_EXECUTION_PROMPT.md)

Цей каталог деталізує реалізацію великих Phase 0–8. Він не створює нову нумерацію, паралельний roadmap або дрібні підфази. Кожен файл описує один великий продуктово-технічний блок і використовується Codex, Claude Code та іншими AI coding agents як execution plan після перевірки актуального коду.

## Плани

1. [`PHASE_0_CANONICAL_DOCUMENTATION_AND_BASELINE.md`](./PHASE_0_CANONICAL_DOCUMENTATION_AND_BASELINE.md) — канонічна документація, verified baseline і контроль джерел правди.
2. [`PHASE_1_PRODUCTION_SAFETY_AND_ENGINEERING_FOUNDATION.md`](./PHASE_1_PRODUCTION_SAFETY_AND_ENGINEERING_FOUNDATION.md) — auth, authorization, server authority, CI, data safety та release blockers.
3. [`PHASE_2_CORE_ARCHITECTURE_AND_DATA_PLATFORM.md`](./PHASE_2_CORE_ARCHITECTURE_AND_DATA_PLATFORM.md) — domain boundaries, canonical schemas, API contracts, database та deployment foundation.
4. [`PHASE_3_LEARNING_PRODUCT_REBRAND_AND_MOTION.md`](./PHASE_3_LEARNING_PRODUCT_REBRAND_AND_MOTION.md) — learning-first UX, тема `Світло`, design system, motion, lessons, practice і progress.
5. [`PHASE_4_CONTENT_AI_AND_CONTENT_STUDIO.md`](./PHASE_4_CONTENT_AI_AND_CONTENT_STUDIO.md) — content lifecycle, quality audit, reviewed AI pipeline та protected Content Studio.
6. [`PHASE_5_SOCIAL_GROUPS_CHALLENGES_AND_MULTIPLAYER.md`](./PHASE_5_SOCIAL_GROUPS_CHALLENGES_AND_MULTIPLAYER.md) — communities, friend challenges, leaderboards, Kahoot і realtime lifecycle.
7. [`PHASE_6_ECONOMY_SHOP_ENTITLEMENTS_AND_MONETIZATION.md`](./PHASE_6_ECONOMY_SHOP_ENTITLEMENTS_AND_MONETIZATION.md) — wallet, catalog, themes, purchases, Stars та обрані моделі монетизації.
8. [`PHASE_7_PERFORMANCE_OFFLINE_ACCESSIBILITY_AND_RELEASE.md`](./PHASE_7_PERFORMANCE_OFFLINE_ACCESSIBILITY_AND_RELEASE.md) — performance, offline, accessibility, security hardening і public release.
9. [`PHASE_8_EXPANSION_AND_BONUS_CAPABILITIES.md`](./PHASE_8_EXPANSION_AND_BONUS_CAPABILITIES.md) — AI assistant, Church/Classroom, internationalization, advanced learning та інші бонусні напрями.

## Правила використання

- Перед виконанням конкретної Phase прочитати її файл повністю.
- Потім звірити вимоги з актуальним кодом, git history, tests і поточним branch.
- Файл Phase не може змінювати порядок, визначений master specification.
- Внутрішні workstreams, PR і коміти не є окремими Phase.
- Невідповідність між планом і фактичним кодом фіксується в execution brief; план не виконується сліпо.
- Security, data integrity, accessibility і rollback не можна відкласти заради швидшого UI.
- Документи з `docs/archive/` не використовуються як активні вимоги.

## Стандарт завершення

Phase не вважається завершеною через наявність екранів, файлів або успішного build. Потрібні:

- виконані acceptance criteria;
- зелені lint, typecheck, tests і build;
- server/security/data verification відповідно до scope;
- migration і rollback;
- feature flags та staged rollout для ризикових змін;
- оновлена документація;
- перелік відомих обмежень;
- evidence у PR, а не лише текст `completed`.
