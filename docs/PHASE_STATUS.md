# Bible Games — статус фаз

> Цей файл є коротким індексом. Повні scope, acceptance criteria, dependencies і Definition of Done містяться тільки в [BIBLE_GAMES_MASTER_SPECIFICATION.md](./BIBLE_GAMES_MASTER_SPECIFICATION.md).

| Phase | Назва | Статус |
|---:|---|---|
| 0 | Canonical Documentation and Verified Baseline | ready for merge |
| 1 | Production Safety & Engineering Foundation | next; створює authoritative IDs, idempotency і safe triggers для rewards/wins/celebrations |
| 2 | Core Architecture & Authoritative Data Platform | blocked by Phase 1; створює typed outcome/event contracts і server-time reconciliation |
| 3 | Learning-First Product Rebuild | blocked by Phase 2; включає тему `Світло`, design system і основну motion-систему |
| 4 | Content Quality, Reviewed AI Pipeline & Protected Content Studio | blocked by Phase 2–3; використовує restrained productivity motion без fake progress |
| 5 | Social, Groups, Challenges & Multiplayer | planned; реалізує communities/challenges/Kahoot motion на server-authoritative events |
| 6 | Economy, Shop, Entitlements & Monetization | planned; monetization model not selected; реалізує shop/theme/purchase motion після server confirmation — see [MONETIZATION_STRATEGY.md](./MONETIZATION_STRATEGY.md) |
| 7 | Performance, Offline, Accessibility & Public Release | planned; завершує reduced motion, low-end, Telegram WebView і motion QA hardening |
| 8 | Expansion and Bonus Capabilities | optional future; optional sound і richer theme-specific celebrations |

## Phase 3 design and motion documents

Phase 3 має два binding domain-документи:

- [PHASE_3_REBRANDING_AND_THEME_SYSTEM.md](./PHASE_3_REBRANDING_AND_THEME_SYSTEM.md) — visual identity, тема `Світло`, semantic themes і migration;
- [MOTION_SYSTEM.md](./MOTION_SYSTEM.md) — transitions, feedback, celebrations, authoritative triggers, reduced motion, performance і розподіл реалізації за Phase 1–8.

Наявність motion-специфікації не означає, що runtime animation уже реалізована. Вона є implementation target після завершення залежностей Phase 1–2.

## Phase 6 decision rule

Phase 6 does not automatically select Telegram Ads, Stars purchases, subscriptions, affiliate programs, sponsorships, a Church plan, or third-party advertising. Before any production monetization, the selected model must be approved through a separate ADR in `DECISIONS.md` after security, server-authoritative economy, legal/privacy, minor protection and no-pay-to-win gates are satisfied.

## Правило

Цей індекс не містить окремих задач і не створює власний roadmap. Статус `completed` дозволено встановити лише після виконання acceptance criteria та глобального Definition of Done із головної специфікації.