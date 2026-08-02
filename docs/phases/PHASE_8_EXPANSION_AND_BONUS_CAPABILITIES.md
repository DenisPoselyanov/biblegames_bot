# Phase 8 — Expansion and Bonus Capabilities

> **Priority:** P3 optional expansion  
> **Depends on:** stable production completion of Phase 1–7  
> **Rule:** no Phase 8 item may weaken security, content review, accessibility, performance or no-pay-to-win guarantees  
> **Canonical parent:** [`../BIBLE_GAMES_MASTER_SPECIFICATION.md`](../BIBLE_GAMES_MASTER_SPECIFICATION.md)

---

## 1. Purpose

Phase 8 is a portfolio of optional growth directions, not a commitment to implement everything. Each capability requires its own decision brief, evidence of demand, defined owner, budget, risk review and acceptance criteria.

The phase exists to prevent bonus ideas from entering earlier phases chaotically. It keeps the core product focused while preserving a technically compatible path toward:

- in-app AI learning assistance;
- Church/Classroom products;
- internationalization;
- advanced adaptive learning;
- invited author/content ecosystem;
- standalone web/PWA/desktop options;
- richer theme and sound experiences;
- external integrations;
- carefully governed experiments.

---

## 2. Entry criteria

A Phase 8 initiative may begin only when:

1. The core learning flow is stable in production.
2. Auth, server authority and data migrations are complete.
3. Content lifecycle and human review are operating.
4. Social/economy features required by the initiative are stable.
5. Performance/accessibility budgets have headroom.
6. Monitoring and support can handle the additional feature.
7. There is user evidence or a strategic owner decision.
8. The initiative has explicit out-of-scope boundaries.
9. Legal/privacy/theological/security implications are reviewed.
10. Rollback or kill-switch behavior is defined.

No bonus feature should be justified only by “AI can build it quickly.”

---

## 3. Initiative selection framework

Score each proposal across:

- user learning value;
- ministry/church value;
- reach/growth;
- revenue/support sustainability;
- technical complexity;
- operational burden;
- content/editorial burden;
- privacy/security risk;
- theological risk;
- accessibility/performance impact;
- dependency on third parties;
- reversibility.

Possible decisions:

- approve for discovery only;
- approve limited prototype;
- approve closed beta;
- approve production implementation;
- defer;
- reject.

Store the decision in an ADR or product decision log when architecture, money, privacy or doctrine is affected.

---

# Part A — In-app AI learning assistance

## 4. Product role

AI assistance must support reviewed Bible learning, not replace Scripture, church leadership, professional counsel or human spiritual care.

Initial recommended capabilities:

- `Поясни мою помилку`;
- `Покажи контекст уривка`;
- `Поясни простіше`;
- `Створи коротке повторення`;
- glossary/term clarification;
- question rephrasing for accessibility;
- personalized review summary based on authoritative progress.

Avoid beginning with unrestricted open-ended “spiritual advisor” chat.

---

## 5. AI retrieval and evidence

User-facing AI should retrieve only from:

- approved published content;
- verified Scripture references/translations;
- approved glossary/context sources;
- user’s own authorized learning/progress data required for the request.

Response includes:

- citations/references;
- AI label;
- source scope;
- feedback/report action;
- deterministic fallback when provider fails;
- statement of uncertainty when appropriate.

Do not retrieve unpublished review comments, other users’ data or raw private community content.

---

## 6. AI request lifecycle

```text
user intent
→ auth/eligibility/rate check
→ classify supported task
→ retrieve approved context
→ construct versioned prompt
→ provider call with budget
→ schema/safety validation
→ citation verification
→ response or deterministic fallback
→ feedback/telemetry
```

Requests are bounded by:

- max context/output;
- rate/cost limit;
- supported task enum;
- timeout/retry policy;
- privacy redaction;
- provider/model allowlist.

---

## 7. AI safety boundaries

The assistant must not:

- claim divine authority;
- present itself as pastor/prophet/counsellor;
- invent Bible verses/references;
- conceal major interpretive uncertainty;
- give crisis/medical/legal advice as spiritual fact;
- expose sensitive analytics/profile data;
- generate public/published content directly;
- bypass content review;
- determine rewards, rank or leaderboard results.

For sensitive prompts:

- provide bounded safe response;
- encourage appropriate trusted human/professional support where needed;
- use local crisis/hotline workflows only through approved policy/tooling;
- record only minimal safe telemetry.

---

## 8. AI UX

- AI actions are contextual, not always-on floating distractions;
- response begins quickly with honest loading state;
- no fake typewriter animation requirement;
- citations are tappable/readable;
- feedback/report is clear;
- user can retry with a simpler deterministic explanation;
- AI feature failure never blocks lesson/practice;
- generated response is not automatically saved/shared publicly;
- history retention is explicit and privacy-controlled.

---

## 9. AI evaluation

Build evaluation sets for:

- citation correctness;
- hallucinated verse/reference;
- faithfulness to approved content;
- Ukrainian clarity;
- age-appropriate explanation;
- denominational neutrality/context;
- unsafe authority claims;
- refusal/escalation behavior;
- provider/model regressions;
- latency/cost.

Production model/prompt changes require evaluation and staged rollout.

---

# Part B — Church/Classroom product

## 10. Product scope

Potential capabilities:

- organization/church account;
- multiple groups/classes;
- leader/teacher roles;
- learning assignments;
- scheduled group plans;
- attendance optional and privacy-reviewed;
- Kahoot host controls;
- session history/export;
- aggregate progress dashboard;
- content/playlist templates;
- presentation mode;
- printable/exportable materials;
- invitation/onboarding management.

Church/Classroom should build on Phase 5 communities and Phase 6 entitlements, not create a second user/group system.

---

## 11. Organization model

Possible entities:

- Organization;
- OrganizationMembership;
- Group/Class;
- Assignment;
- AssignmentProgress;
- Meeting/Session;
- LeaderPermission;
- Billing/Plan mapping.

Organization role is separate from global admin/content publisher.

Multi-tenant rules:

- strict organization scoping;
- no cross-tenant access;
- audit leader/admin actions;
- ownership transfer;
- archive/export/delete lifecycle;
- organization-level privacy settings;
- data retention after plan cancellation.

---

## 12. Assignments and learning analytics

Assignment includes:

- published plan/lesson/objective revision;
- target group;
- start/deadline;
- optional completion requirements;
- reminder policy;
- visibility;
- status.

Leader analytics should emphasize:

- assigned/completed/in-progress;
- aggregate objective/review health;
- technical failures;
- participation trend.

Avoid unrestricted viewing of every wrong answer or sensitive spiritual activity unless explicitly justified and consented.

---

## 13. Presentation mode

Presentation/Classroom mode may provide:

- large-screen optimized layout;
- presenter controls;
- QR/join code;
- slide/question/current result display;
- speaker notes where approved;
- remote participant synchronization;
- low-motion/high-contrast modes;
- offline-safe static presentation where feasible.

It must use published content revisions and the existing Kahoot/realtime services.

---

# Part C — Internationalization

## 14. UI localization architecture

Requirements:

- stable message keys;
- locale fallback policy;
- pluralization/date/number formatting;
- right-to-left readiness only if future target requires;
- no hardcoded Ukrainian strings in domain logic;
- untranslated-key detection;
- pseudo-localization/long-string testing;
- locale stored as user preference.

Do not mix interface localization with content translation silently.

---

## 15. Content language model

Content variants link to the same conceptual item/objective but retain independent revisions/review.

Store:

- language/locale;
- translation source;
- translator/reviewer;
- source revision;
- translation status;
- Scripture translation/reference mapping;
- publication version;
- fallback eligibility.

A translated item is not approved merely because the source language is approved.

---

## 16. Bible translations and licensing

For every locale/translation:

- verify rights/API terms;
- store source/version;
- define quotation limits;
- handle unavailable translation;
- avoid mixing translations in one lesson without label;
- support reference normalization per language;
- preserve historical session evidence.

---

# Part D — Advanced learning and personalization

## 17. Prerequisite/objective graph

Extend objectives with:

- prerequisites;
- dependency strength/type;
- misconceptions;
- difficulty/age metadata;
- recommended learning sequence;
- review evidence requirements.

Graph changes are versioned and reviewed. Avoid a speculative graph disconnected from real content.

---

## 18. Adaptive sequencing

Adaptive recommendations may use:

- objective mastery;
- recent wrong answers;
- review due state;
- lesson prerequisites;
- user-selected goals/time;
- content availability;
- accessibility preferences.

The algorithm must be explainable to the user:

> “Рекомендуємо повторити цю тему, бо два останні питання були складними.”

Avoid opaque high-stakes profiling or manipulative retention optimization.

---

## 19. Experimentation

Experiment framework requirements:

- explicit hypothesis;
- eligible population;
- privacy-safe assignment;
- stable variant ID;
- no security/content correctness variants;
- accessibility parity;
- stop conditions;
- statistical analysis plan;
- no dark patterns;
- user/organization exclusions where needed;
- decision and cleanup after experiment.

Never A/B test theological facts, correct answers or required safety messaging.

---

## 20. Cohort insights

Possible aggregate insights:

- lesson completion;
- objective difficulty;
- review effectiveness;
- content error rate;
- accessibility/performance issues;
- group assignment completion.

Do not expose individual sensitive patterns unnecessarily or label users spiritually.

---

# Part E — Content ecosystem and invited authors

## 21. Author model

Invited authors may:

- create drafts;
- use templates;
- submit content for review;
- respond to change requests;
- view their own audit/history.

They cannot self-publish unless separately granted publisher permission.

Required:

- author identity/profile;
- agreements/rights;
- attribution policy;
- permission scope;
- content ownership/license;
- removal/dispute process;
- quality metrics and training.

---

## 22. Templates and content packs

Templates define structure, not truth. Examples:

- lesson plan;
- topic quiz;
- group discussion;
- Kahoot playlist;
- youth challenge;
- Bible reading plan.

Content packs use Phase 4 publication and, if paid, Phase 6 catalog/entitlements. A marketplace is not launched until review capacity, rights and support are proven.

---

## 23. Marketplace constraints

Before marketplace:

- seller/author verification;
- review and moderation;
- pricing/revenue share/legal policy;
- refunds/support;
- rights/DMCA-style process as relevant;
- theological/content standards;
- child safety;
- tax/accounting;
- discoverability without manipulation;
- ratings/reviews abuse prevention.

Default safer path: curated invited collections rather than open upload marketplace.

---

# Part F — Additional platforms

## 24. Standalone web/PWA

A standalone web version may add:

- non-Telegram authentication provider;
- web session/account linking;
- installable PWA;
- broader deep links/search discovery;
- desktop-responsive host/admin/learning experiences.

It must not duplicate accounts/progress. Account linking requires a secure identity model and recovery policy.

PWA capability follows Phase 7 cache/offline rules and never caches payment/auth truth unsafely.

---

## 25. Desktop wrapper

A desktop wrapper is justified only for a real use case such as:

- church presenter/host station;
- Content Studio productivity;
- offline classroom materials.

Do not wrap the mobile app merely for distribution. Define update signing, storage, permissions, security and support.

---

## 26. External integrations

Potential integrations:

- calendar assignment reminders;
- LMS/classroom systems;
- church management software;
- approved Bible APIs;
- export formats;
- analytics/BI with privacy safeguards.

Each integration uses:

- OAuth/API keys with least privilege;
- explicit consent;
- scoped data mapping;
- sync conflict policy;
- webhook verification/idempotency;
- revocation/deletion;
- rate limits;
- monitoring;
- vendor risk review.

Do not build direct database integrations.

---

# Part G — Richer themes, motion, sound and seasonal experiences

## 27. Theme expansion

Future themes reuse the Phase 3 semantic contract. Possible directions already documented include:

- Нічна молитва;
- Пустельний шлях;
- Оливкова гілка;
- Царські псалми;
- Ранкова благодать;
- Ліхтар віри;
- Ковчег;
- Небесний спокій.

Each theme requires:

- asset provenance;
- token mapping;
- all-state accessibility matrix;
- Telegram chrome behavior;
- performance budget;
- theme preview;
- entitlement/catalog integration;
- fallback;
- visual owner approval.

---

## 28. Celebration packs

Theme-specific celebration may change:

- particle color/shape;
- glow/rays;
- restrained decorative symbols;
- optional achievement presentation.

It may not change:

- event trigger;
- correct/wrong semantics;
- duration/blocking budget;
- reduced/minimal motion;
- reward value;
- competitive result;
- accessibility.

Celebration packs are cosmetic and must not become casino-like.

---

## 29. Sound design

Optional settings:

- interface sounds;
- game sounds;
- major achievement sounds;
- volume/mute;
- no autoplay before interaction;
- system/media respect.

Sound style:

- short;
- warm;
- clean;
- no arcade spam;
- no loud fanfare;
- no routine church-bell clichés;
- accessible visual equivalent always present.

Audio assets require license/provenance and mobile performance testing.

---

## 30. Seasonal events

Seasonal content/motion only when:

- event has approved content/theological framing;
- publication/review complete;
- start/end/rollback defined;
- no fake scarcity pressure;
- no inaccessible theme requirement;
- reward/economy anti-abuse reviewed;
- assets are optional and performant;
- base product remains usable after event ends.

---

# Part H — Governance, architecture and implementation process

## 31. Initiative architecture brief

Before implementation, create:

- problem and evidence;
- target user/outcome;
- exact scope/out of scope;
- dependencies;
- domain owner;
- API/data changes;
- migration;
- security/privacy/content/legal review;
- design/motion/accessibility;
- performance/cost budget;
- feature flags;
- rollout/rollback;
- success/stop metrics;
- tests;
- support/operations.

Use the main AI execution prompt with this Phase file and relevant domain docs.

---

## 32. Avoiding architecture fragmentation

Phase 8 features must extend existing domains:

- AI uses Phase 4 jobs/content retrieval;
- Church/Classroom uses Phase 5 communities and Phase 6 entitlements;
- internationalization extends content revisions/preferences;
- adaptive learning uses Phase 2/3 objectives/progress;
- marketplace uses Phase 4 publication and Phase 6 catalog;
- standalone web uses existing API/auth abstractions;
- themes use Phase 3 renderer;
- sound/motion use `MOTION_SYSTEM.md`.

Do not create separate profile, wallet, group, content or analytics systems.

---

## 33. Data and migration rules

Every new persisted feature requires:

- schema version;
- migration and rollback/forward fix;
- export/delete/retention behavior;
- ownership/authorization;
- audit for sensitive mutations;
- local/offline policy;
- analytics/privacy classification;
- compatibility with old clients;
- test fixtures.

---

## 34. Feature flags and rollout

Each initiative has an independent flag/kill switch. Typical rollout:

1. offline design/research;
2. internal prototype using production-like contracts;
3. security/content/accessibility review;
4. internal users;
5. invitation-only beta;
6. measured cohort;
7. production expansion;
8. decision to continue, revise or remove;
9. flag cleanup.

Avoid permanent beta flags and abandoned code paths.

---

## 35. Observability and cost

Track initiative-specific health without collecting excessive data:

### AI

- latency/failure/citation error/report/cost;
- provider/model version;
- fallback rate.

### Church/Classroom

- assignment/session completion;
- leader errors/support;
- tenant access violations;
- group size/performance.

### Internationalization

- missing keys/fallback;
- content coverage;
- locale-specific errors.

### Adaptive learning

- recommendation acceptance/completion;
- learning outcome, not only clicks;
- fairness/segment review.

### Marketplace/content ecosystem

- review load;
- rejection/error/report/refund;
- rights disputes.

Define monthly/provider budget and automatic stop conditions where cost can grow.

---

## 36. Testing requirements

Every initiative includes:

- unit/domain tests;
- API/schema validation;
- auth/authorization;
- migration fixtures;
- E2E critical flow;
- accessibility;
- reduced motion/theme matrix;
- mobile Telegram/browser support as relevant;
- slow network/provider failure;
- privacy/export/delete;
- rollback/kill switch;
- load/cost testing where relevant.

Additional AI tests include adversarial/hallucination/citation evaluation. Additional multi-tenant tests include cross-organization access. Additional i18n tests include pseudo-localization and Scripture translation mapping.

---

## 37. Conflicts and risk controls

### AI vs spiritual authority

AI remains labeled, cited and bounded. Human leaders/reviewers remain authoritative for ministry/content decisions.

### Personalization vs privacy

Use minimal learning data and explain recommendations. Avoid sensitive profiling or cross-user comparison.

### Church analytics vs surveillance

Leaders see necessary assignment/aggregate information, not unrestricted private spiritual behavior.

### Internationalization vs quality

Do not auto-publish machine translations. Each locale needs review capacity.

### Marketplace vs content safety

Curated/invited supply before open marketplace. All content passes publication standards.

### Platform expansion vs account fragmentation

One internal user/account/progress model; secure account linking rather than duplicate records.

### Rich themes/sound vs accessibility/performance

Base functionality and minimal mode remain available. Cosmetic assets obey budgets.

### Experiments vs truth/safety

Never experiment with correct answers, security, privacy consent, mandatory safety text or doctrinal factuality.

---

## 38. Forbidden shortcuts

- implementing all Phase 8 items as one project;
- open-ended spiritual AI before bounded retrieval/citations;
- AI publishing content;
- separate Church account/profile system;
- leader access to all private answers;
- auto-translated published content without review;
- opaque adaptive algorithm with no explanation;
- open marketplace before moderation/rights/support;
- duplicate standalone-web accounts;
- arbitrary remote theme CSS/scripts;
- autoplay sound;
- seasonal casino-like rewards;
- permanent experiments/flags with no decision;
- bonus feature that exceeds performance/support capacity;
- calling a prototype production because it works for one internal user.

---

## 39. Definition of Done for a Phase 8 initiative

An individual initiative is complete when:

1. Product owner approved its brief and dependencies.
2. It extends canonical domains instead of duplicating them.
3. Security, privacy, content/theological, legal and accessibility reviews are complete.
4. Data schemas/migrations/export/delete/retention are implemented.
5. Feature flags, metrics, stop conditions and rollback exist.
6. Production behavior is server-authoritative where required.
7. Core product works when the feature/provider is disabled.
8. Tests cover normal, failure, abuse, reduced-motion and compatibility cases.
9. Support/operations/cost ownership is defined.
10. Staged rollout demonstrates user value without unacceptable risk.
11. Documentation and user-facing disclosures are accurate.
12. Temporary code/flags from the experiment are cleaned up.

Phase 8 as a whole is never considered “complete” merely because every idea was implemented. It remains an expansion portfolio governed by individual decisions.

---

## 40. Rollback

Every initiative must support independent rollback:

- AI provider/features disabled with deterministic core fallback;
- Church/Classroom premium disabled without deleting organizations/data;
- locale disabled while preserving content revisions;
- adaptive recommendation falls back to deterministic Today rules;
- marketplace submissions paused while published approved content remains;
- external integration tokens revoked and sync stopped;
- theme/sound/seasonal assets disabled with `Світло` fallback;
- no rollback may reintroduce client authority or delete audit/payment/content history.

---

## 41. Long-term success definition

Phase 8 succeeds when Bible Games can expand without losing its core identity:

- Scripture learning remains central;
- AI remains a bounded helper;
- churches/groups gain useful tools without surveillance;
- new languages retain editorial quality;
- personalization is understandable and respectful;
- paid/author content remains reviewed and fair;
- new platforms share one secure account/data model;
- themes, motion and sound remain premium but restrained;
- every optional capability can be disabled without breaking the core product.
