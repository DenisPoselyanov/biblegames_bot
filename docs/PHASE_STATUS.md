# Bible Games — статус фаз

> Цей файл є коротким індексом. Канонічний порядок і верхньорівневі acceptance criteria містяться в [BIBLE_GAMES_MASTER_SPECIFICATION.md](./BIBLE_GAMES_MASTER_SPECIFICATION.md), а супердетальні implementation-плани кожної Phase — у [`phases/README.md`](./phases/README.md).

| Phase | Назва | Статус | Детальний план |
|---:|---|---|---|
| 0 | Canonical Documentation and Verified Baseline | ready for merge | [Phase 0](./phases/PHASE_0_CANONICAL_DOCUMENTATION_AND_BASELINE.md) |
| 1 | Production Safety & Engineering Foundation | next; створює authoritative IDs, idempotency і safe triggers для rewards/wins/celebrations | [Phase 1](./phases/PHASE_1_PRODUCTION_SAFETY_AND_ENGINEERING_FOUNDATION.md) |
| 2 | Core Architecture & Authoritative Data Platform | blocked by Phase 1; створює typed outcome/event contracts і server-time reconciliation | [Phase 2](./phases/PHASE_2_CORE_ARCHITECTURE_AND_DATA_PLATFORM.md) |
| 3 | Learning-First Product Rebuild | blocked by Phase 2; включає learning-first UX, тему `Світло`, design system і основну motion-систему | [Phase 3](./phases/PHASE_3_LEARNING_PRODUCT_REBRAND_AND_MOTION.md) |
| 4 | Content Quality, Reviewed AI Pipeline & Protected Content Studio | blocked by Phase 2–3; використовує restrained productivity motion без fake progress | [Phase 4](./phases/PHASE_4_CONTENT_AI_AND_CONTENT_STUDIO.md) |
| 5 | Social, Groups, Challenges & Multiplayer | planned; реалізує communities/challenges/Kahoot на server-authoritative events | [Phase 5](./phases/PHASE_5_SOCIAL_GROUPS_CHALLENGES_AND_MULTIPLAYER.md) |
| 6 | Economy, Shop, Entitlements & Monetization | planned; monetization model not selected; purchase/theme/payment state тільки після server confirmation | [Phase 6](./phases/PHASE_6_ECONOMY_SHOP_ENTITLEMENTS_AND_MONETIZATION.md) |
| 7 | Performance, Offline, Accessibility & Public Release | planned; завершує production performance, offline policy, accessibility, reduced motion і release hardening | [Phase 7](./phases/PHASE_7_PERFORMANCE_OFFLINE_ACCESSIBILITY_AND_RELEASE.md) |
| 8 | Expansion and Bonus Capabilities | optional future; AI assistant, Church/Classroom, internationalization та інші окремо схвалені ініціативи | [Phase 8](./phases/PHASE_8_EXPANSION_AND_BONUS_CAPABILITIES.md) |

## Phase 3 design and motion documents

Phase 3 має binding domain-документи:

- [PHASE_3_REBRANDING_AND_THEME_SYSTEM.md](./PHASE_3_REBRANDING_AND_THEME_SYSTEM.md) — visual identity, тема `Світло`, semantic themes і migration;
- [DESIGN_RULES.md](./DESIGN_RULES.md) — конкретні UI/UX/component rules;
- [MOTION_SYSTEM.md](./MOTION_SYSTEM.md) — transitions, feedback, celebrations, authoritative triggers, reduced motion, performance і розподіл реалізації за Phase 1–8.

Наявність специфікацій не означає, що runtime implementation уже завершена. Вони є обов’язковими implementation targets після завершення залежностей Phase 1–2.

## Phase 6 decision rule

Phase 6 не вибирає автоматично Telegram Ads, Stars purchases, subscriptions, affiliate programs, sponsorships, Church plan або third-party advertising. Перед production-монетизацією обрана модель має бути затверджена окремим ADR після security, server-authoritative economy, legal/privacy, minor protection і no-pay-to-win gates.

## Правило

Цей індекс не містить окремих задач і не створює власний roadmap. Відповідний файл у `docs/phases/` деталізує реалізацію, але не може змінювати canonical phase order. Статус `completed` дозволено встановити лише після виконання acceptance criteria з master specification і Phase-файлу, глобального Definition of Done та наявності evidence у коді, tests, migrations, rollout і rollback.