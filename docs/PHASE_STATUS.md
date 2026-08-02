# Bible Games — статус фаз

> Цей файл є коротким індексом. Повні scope, acceptance criteria, dependencies і Definition of Done містяться в [BIBLE_GAMES_MASTER_SPECIFICATION.md](./BIBLE_GAMES_MASTER_SPECIFICATION.md). Детальні active domain specifications не створюють окремої системи фаз.

| Phase | Назва | Статус |
|---:|---|---|
| 0 | Canonical Documentation and Verified Baseline | ready for merge |
| 1 | Production Safety & Engineering Foundation | next |
| 2 | Core Architecture & Authoritative Data Platform | blocked by Phase 1 |
| 3 | Learning-First Product Rebuild | blocked by Phase 2; visual direction approved — see [PHASE_3_REBRANDING_AND_THEME_SYSTEM.md](./PHASE_3_REBRANDING_AND_THEME_SYSTEM.md) |
| 4 | Content Quality, Reviewed AI Pipeline & Protected Content Studio | blocked by Phase 2–3 |
| 5 | Social, Groups, Challenges & Multiplayer | planned |
| 6 | Economy, Shop, Entitlements & Monetization | planned; monetization model not selected; paid theme catalog depends on Phase 3 theme contract — see [MONETIZATION_STRATEGY.md](./MONETIZATION_STRATEGY.md) |
| 7 | Performance, Offline, Accessibility & Public Release | planned |
| 8 | Expansion and Bonus Capabilities | optional future |

## Phase 3 visual decision

Затверджений напрям ребрендингу:

- базова безкоштовна тема `Світло`;
- premium spiritual minimalism;
- warm ivory background;
- deep navy primary;
- restrained muted gold accent;
- serif display typography + clean sans-serif UI;
- м’які surfaces, мінімальні shadows і стримані біблійні hero illustrations;
- semantic theme tokens;
- reference screens задають visual language, але не копіюються як product structure;
- current `classic` theme зберігається як legacy/alternative під час контрольованої міграції.

Дизайн-система і default theme реалізуються в Phase 3. Каталог, ціни, wallet purchases та theme entitlements реалізуються в Phase 6.

## Phase 6 decision rule

Phase 6 does not automatically select Telegram Ads, Stars purchases, subscriptions, affiliate programs, sponsorships, a Church plan, or third-party advertising. Before any production monetization, the selected model must be approved through a separate ADR in `DECISIONS.md` after security, server-authoritative economy, legal/privacy, minor protection and no-pay-to-win gates are satisfied.

## Правило

Цей індекс не містить окремих задач і не створює власний roadmap. Статус `completed` дозволено встановити лише після виконання acceptance criteria та глобального Definition of Done із головної специфікації.