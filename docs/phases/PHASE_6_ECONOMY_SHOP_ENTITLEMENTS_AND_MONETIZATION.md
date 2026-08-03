# Phase 6 — Economy, Shop, Entitlements & Monetization

> **Priority:** P2 business foundation  
> **Depends on:** Phase 1 authoritative wallet primitives, Phase 2 contracts/database, Phase 3 theme system, Phase 5 social/host roles, [`../MONETIZATION_STRATEGY.md`](../MONETIZATION_STRATEGY.md)  
> **Canonical parent:** [`../BIBLE_GAMES_MASTER_SPECIFICATION.md`](../BIBLE_GAMES_MASTER_SPECIFICATION.md)

---

## 1. Product outcome

After Phase 6, Bible Games has a transparent, server-authoritative economy and shop. Users can unlock cosmetic themes and other approved items without being able to forge balances or purchases. If real-money monetization is enabled, Telegram Stars, subscriptions, affiliate programs or sponsorships operate through verified payment/reconciliation flows rather than client-side assumptions.

The phase does not automatically select every monetization option described in the strategy. The product owner must approve the final production model through an ADR before real-money launch.

---

## 2. Current baseline and conflicts

The current prototype includes:

- client-side coin balance in the player profile;
- client-side theme/avatar purchase methods in `PlayerContext`;
- theme definitions/catalog-like data in frontend files;
- local ownership/unlock arrays;
- Shop and theme UI;
- future theme economy plans;
- no fully authoritative catalog/ledger/entitlement/payment state machine;
- internal “coins” that must remain separate from Telegram Stars.

Critical conflicts:

- current client can calculate/update coins and unlocks;
- profile PUT historically accepted those values;
- theme selection and ownership may be conflated;
- a cosmetic catalog in frontend data cannot be the production price authority;
- social/game rewards from Phase 5 can become abuse vectors;
- Telegram Stars success cannot be inferred from the Mini App closing or client callback alone;
- Ads/sponsorships can harm the spiritual/minimal product if inserted in inappropriate contexts;
- minors and church users require clear pricing, privacy and no manipulative design.

---

## 3. Economy principles

1. Internal coins and Telegram Stars are separate systems.
2. Internal coins have no cash value and cannot be withdrawn or secretly converted.
3. Wallet balance is server-authoritative and backed by an immutable ledger.
4. Purchases and entitlement grants are transactional and idempotent.
5. Essential learning, correct answers and fair competition are not paywalled or sold.
6. No pay-to-win in Kahoot, challenges, rank or mastery.
7. Cosmetic themes never alter answer semantics, rewards, difficulty or accessibility.
8. Real payment success requires provider verification and reconciliation.
9. Prices, availability and product descriptions are versioned and auditable.
10. Monetization UX is calm, transparent and appropriate for a Christian learning product.

---

## 4. Decision gate before real-money implementation

Create an ADR that explicitly selects one or more models:

- official Telegram Ads revenue sharing;
- one-time Telegram Stars purchases;
- recurring Stars subscription;
- Free/Premium/Church-Classroom plans;
- affiliate program;
- manual Christian partner placements;
- monetized Telegram channel;
- no real-money monetization at initial launch.

The ADR must define:

- target users;
- value proposition;
- legal/privacy/tax/accounting owner;
- content restrictions;
- refund/support policy;
- pricing governance;
- metrics and stop conditions;
- countries/platform constraints;
- child/minor safeguards.

Until accepted, only sandbox and internal catalog/economy work is allowed.

---

## 5. Internal wallet and ledger

## 5.1 Wallet

```ts
interface Wallet {
  id: string;
  userId: string;
  currency: 'BGC';
  balance: number;
  version: number;
  updatedAt: string;
}
```

`BGC` is an internal identifier only. User-facing naming may be `Монети`.

## 5.2 Ledger transaction

```ts
interface WalletTransaction {
  id: string;
  walletId: string;
  type: 'reward' | 'purchase' | 'refund' | 'reversal' | 'migration' | 'admin_adjustment' | 'expiration';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  sourceType: string;
  sourceId: string;
  idempotencyKey: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  reversedTransactionId?: string;
}
```

Requirements:

- unique source/idempotency constraints;
- no mutation/deletion of finalized ledger entries;
- reversals create new linked entries;
- transaction and balance update occur atomically;
- balance cannot become negative unless an explicit policy exists;
- admin adjustment requires permission/reason/audit;
- reconciliation can recompute/check balance from ledger.

## 5.3 Reward sources

Approved sources may include:

- lesson completion;
- practice completion;
- review milestone;
- achievement;
- challenge/game outcome;
- streak milestone;
- migration/promotion campaign.

Each source has versioned eligibility and anti-farming rules.

## 5.4 Abuse prevention

- per-source caps/cooldowns;
- unique completion IDs;
- no reward for replayed outcome;
- guest/test account restrictions;
- duplicate challenge/opponent checks;
- anomaly monitoring;
- manual adjustment audit;
- no reliance on client timestamps or scores.

---

## 6. Catalog model

## 6.1 Catalog item

```ts
interface CatalogItem {
  id: string;
  type: 'theme' | 'avatar' | 'badge' | 'frame' | 'hint_pack' | 'supporter_bundle' | 'feature_entitlement';
  status: 'draft' | 'active' | 'hidden' | 'retired';
  titleKey: string;
  descriptionKey: string;
  assetVersion: string;
  entitlementProductId: string;
  availability: AvailabilityWindow;
  eligibility?: EligibilityRule;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}
```

## 6.2 Price

Price is separate and versioned:

```ts
interface CatalogPrice {
  id: string;
  catalogItemId: string;
  currency: 'BGC' | 'XTR';
  amount: number;
  startsAt: string;
  endsAt?: string;
  regionOrSegment?: string;
  version: number;
}
```

`XTR` represents Telegram Stars where applicable. Never copy Stars into the internal wallet balance.

## 6.3 Availability

Support:

- always available;
- limited date window;
- event/season;
- invite/plan entitlement;
- retired but retained for owners;
- platform/region restrictions where legally required.

Expired items remain usable by existing owners unless the product contract explicitly says otherwise.

## 6.4 Assets

Catalog publication validates:

- image/preview/theme bundle hashes;
- file size and format;
- accessibility/contrast audit;
- theme schema compatibility;
- fallback assets;
- license/provenance;
- CDN/cache versioning;
- no remote arbitrary script/CSS execution.

---

## 7. Entitlements

## 7.1 Entitlement record

```ts
interface Entitlement {
  id: string;
  userId: string;
  productId: string;
  sourceType: 'purchase' | 'subscription' | 'grant' | 'migration' | 'promotion';
  sourceId: string;
  status: 'active' | 'expired' | 'revoked';
  grantedAt: string;
  expiresAt?: string;
  revokedAt?: string;
  metadata?: Record<string, unknown>;
}
```

## 7.2 Ownership checks

Server checks entitlement for:

- applying paid theme/avatar/frame;
- premium analytics/features;
- Church/Classroom host limits;
- paid content pack if later approved;
- removing ads if an ad-supported model is selected.

Frontend visibility is not authorization.

## 7.3 Restore

Entitlements are restored after login on another device from server records/provider reconciliation. Local `unlockedThemes` arrays are migration inputs only.

## 7.4 Revocation/expiration

Define UX and data behavior:

- expired subscription removes premium capability but preserves user progress/content created according to policy;
- revoked cosmetic falls back to `Світло` without corrupting profile;
- purchased one-time cosmetics remain active unless refund/fraud policy revokes them;
- historical purchase/entitlement records remain auditable.

---

## 8. Internal coin purchase flow

## 8.1 Request

```text
POST /api/v1/shop/purchases
```

Payload:

- catalog item ID;
- expected price/version;
- idempotency key.

The client never sends final balance or entitlement.

## 8.2 Server transaction

1. authenticate user;
2. load active catalog item/price;
3. verify eligibility/availability;
4. reject duplicate ownership where non-consumable;
5. lock/check wallet;
6. insert purchase ledger transaction;
7. grant entitlement/consumable balance;
8. create economy outcome event;
9. commit atomically;
10. return authoritative balance and entitlement.

## 8.3 Price changes

If expected price differs, return a conflict with current price and require explicit confirmation. Do not silently charge more.

## 8.4 Duplicate/concurrent purchase

Unique constraints and idempotency ensure:

- double tap charges once;
- retry returns original outcome;
- two devices cannot buy the same non-consumable twice;
- partial failure rolls back both debit and entitlement.

## 8.5 Refund/reversal

Internal coin refunds follow explicit rules and create linked ledger entries. The original purchase remains in history.

---

## 9. Theme shop integration

## 9.1 Phase boundary

Phase 3 already provides:

- semantic theme renderer;
- default `Світло`;
- legacy theme compatibility;
- preview component;
- theme preference selection for owned themes.

Phase 6 provides:

- catalog metadata;
- price;
- purchase;
- entitlement;
- restore/revoke;
- availability;
- publication workflow;
- analytics.

## 9.2 Theme preview

Preview uses a sandboxed demo surface or temporary token layer. It must not persist or affect Telegram chrome until user selects/apply.

## 9.3 Apply theme

Server validates ownership and updates preference. Client applies flash-free crossfade from `MOTION_SYSTEM.md`.

## 9.4 Theme safety

Every theme must pass:

- contrast/accessibility;
- success/danger/warning visibility;
- large text;
- reduced motion;
- loading/error/offline states;
- Quiz/Kahoot/Millionaire semantics;
- Android/iOS Telegram;
- performance/assets budget.

A paid theme cannot be lower quality or less accessible than `Світло`.

---

## 10. Consumables and hints

Hints can be monetized only under a non-pay-to-win policy.

Rules:

- never sell the correct answer for competitive/leaderboard modes;
- hint effect is explicit and mode-specific;
- purchase/use is server-authoritative and idempotent;
- consumable balance is separate from wallet where appropriate;
- retries do not consume twice;
- accessibility does not depend on purchasing hints;
- essential explanations remain available after answering.

The product owner may decide to remove paid hints entirely.

---

## 11. Telegram Stars one-time purchases

If selected by ADR:

## 11.1 Product mapping

Map internal product ID to Telegram invoice/product metadata and Stars amount. Server is the price authority.

## 11.2 Checkout creation

Server creates payment/invoice data after:

- authentication;
- catalog/price validation;
- eligibility;
- idempotency/payment intent creation.

Payment intent states:

```text
created → pending → confirmed → fulfilled
                 ↘ failed | expired | cancelled
confirmed → refunded | disputed where supported
```

## 11.3 Verification

Do not grant entitlement because:

- client reports success;
- Mini App closes;
- redirect query says paid;
- local SDK callback fires without server evidence.

Grant only after official provider/bot update/callback is verified and reconciled.

## 11.4 Fulfillment

- provider event unique ID;
- payment intent match;
- amount/currency/product check;
- atomic entitlement grant;
- receipt/support reference;
- idempotent duplicate provider callback;
- economy/payment audit event.

## 11.5 Reconciliation

Scheduled/manual reconciliation detects:

- confirmed but not fulfilled;
- fulfilled without confirmed payment;
- duplicate callbacks;
- refund/reversal;
- amount mismatch;
- stale pending intents.

---

## 12. Subscriptions and product plans

If selected, possible plans:

### Free

- core learning/practice;
- base theme `Світло`;
- fair progress and explanations;
- limited host/group capacity only if justified;
- no degradation of essential Scripture learning.

### Premium

Possible value:

- additional cosmetic themes;
- advanced personal analytics;
- optional convenience features;
- expanded non-essential content packs if reviewed;
- ad-free experience if ads exist;
- supporter recognition without competitive advantage.

### Church/Classroom

Possible value:

- larger/private groups;
- leader dashboard;
- assignments;
- Kahoot host/session history/export;
- custom approved playlists;
- organization management;
- aggregated privacy-safe analytics.

## Subscription requirements

- provider state reconciliation;
- renewal/expiry/grace period;
- plan version;
- entitlement mapping;
- cancellation instructions;
- restore across devices;
- no loss of user-created data without clear policy;
- downgrade behavior;
- support/refund policy;
- legal/privacy review.

---

## 13. Official Telegram Ads revenue sharing

If available/eligible, official Sponsored Messages are platform-controlled. Documentation and product must not promise a specific fill rate or income.

Implementation considerations:

- revenue reporting/admin reconciliation if Telegram exposes it;
- no custom code pretending to be official ads;
- premium/ad-free entitlement only if Telegram/product capabilities support the intended behavior;
- measure user impact;
- do not place internal ads inside question/lesson flows merely to imitate platform advertising.

Official ads are supplemental income, not the sole business model assumption.

---

## 14. Manual sponsorships and partners

If approved, create a separate partner-placement system rather than arbitrary ad HTML.

Allowed examples:

- Christian publisher;
- Bible store;
- camp/conference;
- educational ministry;
- approved music/media project.

Requirements:

- partner review;
- start/end dates;
- disclosure `Партнерський матеріал`;
- approved image/text/link;
- safe destination validation;
- no behavioral targeting using sensitive spiritual data;
- placement frequency caps;
- analytics with privacy limits;
- immediate disable switch;
- content restrictions.

Forbidden placements:

- during a question answer state;
- inside Scripture quotation;
- interrupting prayer/reflection;
- before showing explanation;
- fake system notification;
- manipulative urgency.

---

## 15. Affiliate program

If Telegram Mini App affiliate capability is selected:

- referral identity/token is server-validated;
- attribution window/rules documented;
- self-referral/collusion prevention;
- commission calculation versioned;
- Stars/payment provider truth is authoritative;
- privacy disclosure;
- dispute/reversal handling;
- no misleading spiritual endorsements;
- community leader incentives do not pressure minors/users.

Do not implement affiliate tracking before the underlying purchase/subscription system is stable.

---

## 16. Telegram channel monetization

A separate Bible Games channel may support:

- verse/lesson announcements;
- product updates;
- community content;
- official channel ad revenue eligibility;
- approved sponsorships.

The channel is a distribution product, not a replacement for in-app account data. Channel analytics and bot deep links must respect consent and access checks.

---

## 17. Third-party ad networks

Treat as an experimental deferred option because Telegram WebView, privacy, content quality and visual design may conflict.

Before any test:

- legal/privacy consent review;
- content category blocking;
- child/minor suitability;
- WebView technical compatibility;
- CSP/cookie/tracking analysis;
- performance impact;
- strict placement rules;
- remote kill switch;
- vendor security review.

Default recommendation remains not to use generic uncontrolled banner networks in the core spiritual learning flow.

---

## 18. Shop UX

## 18.1 Store hierarchy

- current balance;
- featured approved items;
- categories;
- owned/available/locked states;
- transparent price;
- preview;
- purchase/restore history entry;
- no dark patterns.

## 18.2 Item detail

Show:

- preview;
- exact included items/features;
- price/currency;
- ownership type: permanent/subscription/consumable;
- availability;
- accessibility compatibility;
- user balance;
- refund/support information where relevant.

## 18.3 Purchase confirmation

Required when spending meaningful currency. Display final price and resulting balance. Avoid preselected upsells.

## 18.4 Insufficient balance

Explain available legitimate earning or purchase options without shame, countdown pressure or false scarcity.

## 18.5 Motion

Follow `MOTION_SYSTEM.md`:

- pending spinner inside stable button;
- server-confirmed balance animation;
- entitlement reveal;
- no falling coins/fullscreen confetti;
- no optimistic payment celebration;
- duplicate event does not replay.

---

## 19. Pricing and promotion governance

Create admin/product process for:

- price creation/change;
- sale/promotion window;
- region/segment if legally justified;
- approval;
- audit/history;
- user-visible comparison against prior price only when truthful;
- rollback/disable.

Avoid manipulative countdowns, fake “limited” labels and inflated strike-through prices.

---

## 20. Admin/support tools

Protected tools need:

- catalog item draft/publish/retire;
- price history;
- entitlement lookup;
- purchase/payment intent lookup;
- wallet ledger view;
- refund/reversal command with reason;
- reconciliation dashboard;
- fraud/anomaly flags;
- user support reference;
- audit logs.

Support cannot directly set arbitrary balance in the database. Use audited adjustment commands.

---

## 21. Accounting, legal and privacy

Before real-money launch document:

- seller/legal entity responsibility;
- Telegram/Fragment/Stars payout mechanics relevant at launch time;
- tax/accounting treatment;
- terms and privacy policy;
- refund/support contact;
- transaction retention;
- minor/parental considerations;
- consumer protection and pricing display;
- prohibited product categories;
- data sharing with payment/platform providers.

This requires current legal/platform verification before release, not memory-based assumptions.

---

## 22. API contracts

Potential endpoints:

```text
GET  /api/v1/shop/catalog
GET  /api/v1/shop/catalog/:itemId
GET  /api/v1/me/wallet
GET  /api/v1/me/entitlements
GET  /api/v1/me/purchases
POST /api/v1/shop/purchases
POST /api/v1/shop/payment-intents
POST /api/v1/shop/payments/reconcile
POST /api/v1/me/themes/:themeId/apply
POST /api/v1/admin/economy/adjustments
POST /api/v1/admin/purchases/:id/reverse
```

Provider callbacks/bot updates use dedicated authenticated endpoints/handlers and never public user authentication alone.

---

## 23. Data migrations

### Legacy wallet

- one opening migration entry;
- bounded legacy coin value;
- provenance/status;
- no repeated `totalPoints + coins` addition;
- suspicious values handled by approved policy;
- reconciliation report.

### Legacy unlocks

- map valid theme/avatar IDs to migration entitlements;
- unknown IDs quarantined/logged;
- preserve valid user selection;
- no entitlement from arbitrary local strings without catalog mapping.

### Theme catalog

- migrate existing frontend definitions to server catalog metadata;
- frontend may retain build-time fallback presentation but not price authority;
- asset versions/hashes established.

---

## 24. Observability and fraud monitoring

Metrics:

- wallet transaction volume/failures;
- balance reconciliation mismatch;
- purchase conversion/failure;
- duplicate idempotency hits;
- entitlement restore/revoke;
- payment intent state duration;
- callback duplicates/mismatch;
- refunds/reversals;
- reward-source distribution;
- suspicious farming;
- catalog/theme apply errors;
- Ads/sponsor impact if enabled.

Alerts:

- negative/impossible balance;
- fulfillment without verified payment;
- repeated callback mismatch;
- ledger/snapshot divergence;
- abnormal reward volume;
- catalog price misconfiguration.

---

## 25. Testing strategy

### Wallet/ledger

- credit/debit;
- insufficient balance;
- duplicate idempotency;
- concurrent purchases;
- rollback on entitlement failure;
- reversal/refund;
- reconciliation;
- migration once;
- permissioned adjustment.

### Catalog/entitlement

- active/expired/retired item;
- price/version conflict;
- duplicate non-consumable;
- entitlement restore;
- revoked/expired fallback;
- theme schema/asset validation;
- region/eligibility.

### Payment

- sandbox success/failure/cancel/expiry;
- duplicate provider callback;
- wrong amount/currency/product;
- confirmed not fulfilled recovery;
- refund/reversal;
- no client-only success grant;
- subscription renewal/expiry/grace if selected.

### Security

- forge balance/entitlement;
- call admin adjustment;
- replay purchase;
- use another user payment intent;
- tamper expected price;
- arbitrary theme apply;
- webhook signature/auth failure;
- export/support access.

### UI/E2E

- catalog loading/error/offline;
- item preview;
- owned/purchase/insufficient states;
- double tap;
- theme apply across device;
- reduced motion;
- payment pending/reconciliation;
- downgrade/expired entitlement;
- 320–430 px Telegram WebView.

---

## 26. Feature flags and rollout

Suggested flags:

- `walletLedgerV1` already foundational;
- `catalogV1`;
- `themeShopV1`;
- `internalCoinPurchasesV1`;
- `starsPurchasesV1`;
- `premiumPlanV1`;
- `churchPlanV1`;
- `officialAdsEnabled` where applicable;
- `partnerPlacementsV1`;
- `affiliateV1`.

Rollout order:

1. ledger/catalog read-only internal;
2. migrate balances/unlocks;
3. internal coin theme purchase alpha;
4. reconciliation/anti-abuse review;
5. closed user rollout;
6. select real-money ADR;
7. provider sandbox;
8. limited production product/region;
9. support/refund readiness;
10. broader rollout after evidence.

Each monetization model has an independent kill switch.

---

## 27. Conflicts and interactions

### Phase 3 theme architecture

Do not fork theme rendering in Shop. Catalog references the same stable theme IDs/schema. Purchase does not directly mutate CSS without entitlement/pref validation.

### Phase 5 social/games

Premium host limits or challenge rewards use entitlement/economy services. RoomManager/game UI never calculates billing or grants rewards.

### Phase 4 content

Paid content packs must be reviewed/published. Sponsorship content also requires approval/provenance.

### Phase 7 offline

Purchases/payments are unavailable offline. Cached catalog may be viewable with stale indicator, but final price and purchase require server validation.

### Ads vs spiritual UX

No ads inside Scripture, answer feedback, prayer/reflection or timed competition. Partner content is clearly labeled.

### Internal coins vs Stars

No direct hidden conversion. If a bundle grants internal coins after a Stars purchase, it must be an explicit catalog product with disclosed amount and verified fulfillment, and still reviewed for pay-to-win risk.

---

## 28. Forbidden shortcuts

- trusting client balance or unlock arrays;
- using frontend catalog as price authority;
- granting on client payment callback;
- recording Stars in `coinBalance`;
- selling correct answers/rank/leaderboard advantage;
- loot boxes without legal/ethical ADR;
- duplicate purchase on double tap;
- deleting ledger entries;
- manually editing balance in DB;
- inaccessible paid themes;
- uncontrolled third-party ads;
- fake discounts/scarcity;
- monetization before support/refund/reconciliation;
- marking payment complete without provider evidence.

---

## 29. Definition of Done

Phase 6 is complete when:

1. Internal wallet is server-authoritative and ledger-backed.
2. Rewards and purchases are transactional, idempotent and auditable.
3. Legacy balances/unlocks are migrated once with provenance.
4. Catalog, prices and availability are server-authoritative and versioned.
5. Entitlements restore across devices and enforce ownership server-side.
6. Theme Shop uses the Phase 3 renderer and passes accessibility/performance checks.
7. Double tap/concurrent purchase cannot double-charge.
8. Refund/reversal creates linked records and consistent entitlement state.
9. No pay-to-win or essential learning paywall exists.
10. A real-money model is implemented only after accepted ADR.
11. Stars/payment fulfillment waits for verified provider state and reconciliation.
12. Subscriptions, ads, affiliate or sponsorships—if selected—have privacy/legal/support rules and kill switches.
13. Shop/payment/admin security and E2E tests pass.
14. Monitoring detects ledger/payment anomalies.
15. Motion reflects authoritative events and never replays duplicate purchases.

---

## 30. Rollback

Rollback may:

- hide/retire catalog items;
- disable new purchases/payment intents;
- keep owned entitlements usable;
- pause reward sources;
- disable ads/partners/affiliate;
- revert theme selection to `Світло` only when entitlement invalid, without deleting history;
- reconcile pending payments manually;
- preserve ledger, payment, entitlement and audit data;
- never restore client-side balance authority.

---

## 31. Handoff to Phase 7

Phase 7 receives:

- production wallet/catalog/payment paths;
- theme assets and entitlement cache rules;
- monetization kill switches;
- legal/privacy/support requirements;
- metrics and anomaly alerts;
- offline restrictions;
- performance-sensitive Shop/theme bundles;
- real payment reconciliation runbooks.

Phase 7 must stress-test these systems under mobile performance, slow network, backgrounding, accessibility and incident scenarios before public release.
