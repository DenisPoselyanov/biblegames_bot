# Phase 7 — Performance, Offline, Accessibility & Public Release

> **Priority:** P2 release preparation  
> **Depends on:** completed production paths from Phase 1–6  
> **Canonical parent:** [`../BIBLE_GAMES_MASTER_SPECIFICATION.md`](../BIBLE_GAMES_MASTER_SPECIFICATION.md)

---

## 1. Product outcome

After Phase 7, Bible Games is ready for controlled public production use on real mobile devices, Telegram WebViews and unstable networks.

The phase proves that the completed product is:

- fast enough on supported mobile devices;
- resilient to slow or interrupted networks;
- honest about offline limitations;
- accessible with keyboard, screen reader, large text and reduced motion;
- observable and supportable in production;
- recoverable after incidents, failed migrations or dependency outages;
- safe to roll out gradually and disable selectively;
- accurately documented from deployment to incident response.

Phase 7 is not a cosmetic optimization pass. It is the release gate for the entire system.

---

## 2. Release-readiness principles

1. Measure before optimizing.
2. Performance budgets are product requirements, not suggestions.
3. Offline capability is explicit per feature, never implied by cached UI.
4. Accessibility applies to every theme and major motion state.
5. A successful build does not prove production readiness.
6. Backups are incomplete until restore is rehearsed.
7. Monitoring must identify user-impacting failure, not merely collect logs.
8. Rollout must be staged and reversible.
9. Security/privacy/legal checks are current at release time.
10. Release documentation must match the actual deployment architecture.

---

## 3. Supported environment matrix

Define and publish a support policy.

Minimum test matrix:

### Telegram

- Android Telegram current supported version range;
- iOS Telegram current supported version range;
- small and large phone viewport;
- low-memory Android device;
- background/foreground restoration;
- changing Telegram theme/chrome where relevant.

### Browser fallback

- current Chrome Android;
- current Safari iOS;
- desktop Chrome/Firefox/Safari for host/admin/presentation use where supported;
- mobile browser outside Telegram with reduced capabilities clearly handled.

### Viewports

- 320×568;
- 360×800;
- 390×844;
- 412×915;
- 430×932;
- presentation/display sizes for Kahoot;
- large text at 200%.

The exact supported versions must be verified near release and recorded, not hardcoded forever in this planning document.

---

## 4. Performance budgets

## 4.1 Frontend loading

Set measurable budgets for:

- initial JavaScript;
- initial CSS;
- fonts;
- critical images;
- route chunks;
- memory after initial render;
- Time to Interactive or chosen real-user equivalent;
- API data required for first useful screen.

Target principles:

- Home/Today does not download multi-megabyte question banks;
- major game/admin routes are lazy-loaded;
- theme assets are fetched only when needed;
- critical UI works before below-the-fold imagery;
- no font-induced layout jump;
- errors/offline appear quickly rather than hanging behind a spinner.

## 4.2 Runtime responsiveness

Targets:

- tap feedback under 100 ms;
- common route transition under 300 ms;
- answer feedback begins promptly after authoritative result;
- scrolling remains responsive on long lists;
- no persistent main-thread blocking from parsing large JSON;
- no unbounded provider/context rerender cascades;
- no timer interval per visible row/card.

## 4.3 Motion budgets

Follow `MOTION_SYSTEM.md`:

- 60 FPS target on supported normal device;
- reduced particle count on low-end devices;
- no fullscreen blur/filter animation;
- CTA not blocked by celebration;
- no duplicate animation after reconnect;
- no layout shift caused by enter/exit;
- animation cleanup on unmount.

## 4.4 Backend budgets

Define SLO/SLA-style targets for:

- authentication;
- Today/profile/progress reads;
- practice answer submission;
- purchase transaction;
- content query;
- room join/answer/reveal;
- background jobs;
- payment reconciliation.

Track percentile latency and error rate, not averages only.

---

## 5. Frontend performance work

## 5.1 Bundle analysis

Automate bundle reports and budgets. Investigate:

- large question/theme chunks;
- duplicated libraries;
- locale/font bundles;
- React-Vant component imports;
- motion/animation payload;
- admin/Content Studio code leaking into user bundle;
- AI tooling accidentally bundled;
- large images/assets.

CI fails or warns according to approved thresholds. Budget increases require explanation.

## 5.2 Route/data code splitting

- user app routes split by major domain;
- Content Studio separate bundle/deployment if planned;
- Kahoot display/host/player loaded only when used;
- Millionaire/Survival loaded on demand;
- theme previews/assets loaded on demand;
- error boundary handles chunk-load failure with retry/version refresh guidance.

## 5.3 Question/content delivery

- server creates bounded sessions;
- client receives only needed questions;
- published immutable content cached by version;
- indexes/search endpoints replace full client scans;
- large text/lesson media streamed or paginated where appropriate;
- no duplicate content copies in memory.

## 5.4 Images

- responsive sizes;
- modern formats where supported;
- explicit dimensions/aspect ratio;
- lazy loading below fold;
- low-resolution placeholder only if it does not create unnecessary motion;
- safe fallback/alt text;
- content/theme asset hash/version;
- no unreviewed remote images.

## 5.5 Fonts

- approved serif/sans families and weights only;
- subsetting for Ukrainian/required locales;
- preload only critical font resources;
- fallback metrics chosen to minimize layout shift;
- license and caching verified;
- failure still leaves readable UI.

## 5.6 React rendering

Profile and optimize:

- broad Context updates;
- query cache invalidation;
- large lists;
- derived selectors;
- repeated topic hierarchy processing;
- global stats/telemetry intervals;
- animation rerenders;
- hidden/offscreen game components.

Avoid memoization everywhere without profiling; fix actual hot paths.

---

## 6. Backend performance and scalability

## 6.1 Database

- index common user/content/session/ledger queries;
- inspect query plans;
- pagination for leaderboards/audit/content;
- avoid N+1 in Today, community, entitlements and session results;
- transaction scope kept minimal but correct;
- connection pool limits tuned;
- slow query logging;
- archive/retention strategy for large events/telemetry.

## 6.2 Caching

Cache only where consistency allows:

- published content set/version;
- public catalog;
- community/leaderboard projections with bounded staleness;
- user-independent Scripture metadata;
- room snapshots according to realtime design.

Do not cache auth/permissions/wallet incorrectly. Define keys, TTL, invalidation and fallback.

## 6.3 API payloads

- select only needed fields;
- compress responses where appropriate;
- size limits;
- cursor pagination;
- avoid returning raw audit/job/provider artifacts;
- stable ETag/version for immutable resources;
- no giant profile blob containing every historical event.

## 6.4 Realtime capacity

Load-test:

- concurrent sockets;
- rooms;
- participant count;
- reconnect burst;
- answer burst near timer end;
- broadcasts;
- persistence latency;
- cleanup/expiry;
- multi-instance adapter if enabled.

Define overload behavior: reject new rooms/joins gracefully rather than corrupt existing sessions.

## 6.5 Background jobs

- concurrency limits;
- queue depth alerts;
- retry/backoff;
- dead-letter/failed state;
- checkpoint/resume;
- resource isolation from API/realtime;
- cost/provider limits for AI;
- cleanup and retention.

---

## 7. Offline capability model

Each feature receives an explicit offline class.

### Class A — fully available offline

Possible examples:

- app shell;
- last cached settings/theme;
- already-downloaded immutable lesson reading;
- local accessibility preferences;
- static help/about.

### Class B — available offline with queued reconciliation

Only where the server protocol guarantees safe reconciliation, for example:

- lesson reading checkpoint;
- non-competitive reflection draft;
- possibly practice answers in explicitly offline-created non-reward sessions.

Queued mutations require:

- unique command ID;
- original content revision;
- created time/timezone;
- expiry;
- conflict policy;
- user-visible pending state;
- no local reward before server acceptance.

### Class C — unavailable offline

- wallet purchase;
- Telegram Stars/payment;
- authoritative reward grant;
- current leaderboard;
- live communities feed;
- friend challenge result submission if fairness cannot be reconciled;
- Kahoot/realtime;
- admin/content publication;
- AI generation.

UI must explain this clearly.

---

## 8. Service worker and cache strategy

If PWA/service worker is introduced:

- app shell cache versioned by build;
- immutable content cached by published version/hash;
- no cache of authenticated API responses that leaks between users;
- logout/account switch clears user-specific caches;
- update flow prevents old client/new API incompatibility;
- corrupt cache recovery;
- storage quota handling;
- offline fallback screen;
- no stale price/payment/auth truth.

A service worker is not mandatory if Telegram Mini App constraints make it unsuitable; the decision requires current platform testing.

---

## 9. IndexedDB/local storage

Use structured local storage for approved offline/cache data:

- schema version;
- migration;
- per-user namespace;
- content version;
- expiry/size limits;
- encryption only if threat model/benefit supports it;
- cleanup on logout/account deletion;
- quota/error handling.

Do not store:

- provider/payment secrets;
- raw initData longer than needed;
- authoritative wallet as sole truth;
- unrestricted social/audit data;
- sensitive private reflection without explicit design/security.

localStorage remains suitable only for tiny non-sensitive preferences/boot hints where synchronous read is required.

---

## 10. Conflict and reconciliation rules

For every offline-capable mutation define:

- command ID;
- base version;
- server acceptance criteria;
- duplicate behavior;
- stale content/profile behavior;
- user-facing conflict message;
- retry/expiry;
- rollback of optimistic presentation;
- telemetry.

Examples:

### Lesson checkpoint

Server may accept the furthest valid checkpoint for the same lesson revision. Completion reward remains server-authoritative.

### Theme preference

Offline selection can apply locally only if cached entitlement is known, but server may reject after revocation; fallback to `Світло` and explain sync.

### Practice

Competitive/reward practice should not accept arbitrary offline score. A separate offline practice mode can be non-rewarding or submit full signed/session data according to a future approved design.

---

## 11. Accessibility program

## 11.1 Standards and ownership

Adopt WCAG-oriented targets appropriate for the product and current legal context. Define an accessibility owner and issue severity policy.

## 11.2 Semantic structure

- one clear page heading;
- logical heading hierarchy;
- landmarks;
- labels/descriptions;
- buttons vs links correctly chosen;
- list/table semantics;
- form errors associated with fields;
- dialog roles/focus management;
- status/live regions controlled.

## 11.3 Keyboard

Browser/desktop host/admin flows support:

- logical tab order;
- visible focus;
- Escape close;
- arrow keys where standard;
- no keyboard trap except managed modal focus;
- skip repetitive navigation where useful;
- Kahoot host controls usable without mouse.

## 11.4 Screen reader

Test critical flows:

- login/loading;
- Today;
- lesson/Scripture block;
- Quiz correct/wrong;
- progress/level;
- theme selection;
- Shop purchase;
- community/challenge;
- Kahoot join/answer/result;
- settings;
- errors/offline.

Avoid duplicate `aria-live` announcements from rerenders/reconnect.

## 11.5 Visual accessibility

- 4.5:1 regular text target where applicable;
- 3:1 large text/significant UI boundaries where applicable;
- gold never used as low-contrast small critical text;
- selected/correct/wrong not color-only;
- focus visible in all themes;
- charts/leaderboards have textual equivalents;
- state icons have labels;
- no essential information only in image.

## 11.6 Text scaling and localization

- 200% text does not clip critical content;
- buttons/cards can grow;
- no fixed-height answer text;
- long Ukrainian labels supported;
- future locale expansion considered;
- tab labels/truncation tested;
- typography remains readable if custom font fails.

## 11.7 Motion and vestibular safety

- system reduced motion overrides app setting;
- minimal mode;
- no flashing;
- no uncontrolled parallax;
- no large zoom/pan for reading surfaces;
- countdown/results remain understandable without animation;
- particles/confetti optional/removed;
- focus and announcements work independently.

---

## 12. Theme accessibility and quality matrix

Every active/paid theme must pass:

- all semantic state colors;
- regular/large text contrast;
- focus ring;
- disabled controls;
- correct/wrong answer;
- warning/error/offline;
- Shop/purchase;
- Kahoot colored options with shape/label;
- Millionaire ladder;
- large text;
- reduced motion;
- dark/light Telegram chrome;
- missing imagery/assets.

A theme failing a critical check is disabled or fixed, even if purchased. Users retain entitlement/history.

---

## 13. Security hardening before release

Re-run threat/security review for:

- Telegram auth/session;
- RBAC/admin/Content Studio;
- wallet/payment callbacks;
- Socket.IO/reconnect/host permissions;
- community privacy/moderation;
- file/import/export;
- AI providers/jobs;
- CSP/CORS/security headers;
- dependencies/supply chain;
- secrets/environment;
- rate limits/abuse;
- logging/PII;
- account deletion/export;
- backups.

Actions:

- dependency audit and upgrade policy;
- lockfile integrity;
- secret scanning;
- SAST/security review as available;
- penetration-style negative tests;
- production config check;
- least privilege DB/provider credentials;
- incident contact/process.

Any unresolved critical/high issue blocks release unless formally accepted with compensating controls and owner.

---

## 14. Privacy and data lifecycle

Document:

- data categories;
- purpose/legal basis where required;
- retention;
- sharing/providers;
- export;
- deletion/anonymization;
- audit retention exceptions;
- minors/community data;
- AI/payment/Telegram processing;
- telemetry opt-out/controls where applicable.

Implement:

- user data export request;
- account deletion request and asynchronous status;
- cache/session revocation;
- community ownership transfer/archive rules;
- payment/ledger retention according to legal requirements;
- deletion verification tests.

Do not promise deletion of legally required financial/audit records; explain retention accurately.

---

## 15. Reliability and resilience

## 15.1 Health/readiness

- liveness proves process alive;
- readiness checks critical dependencies;
- separate API/realtime/job readiness where needed;
- no destructive deep check on every request;
- provider degradation reflected honestly.

## 15.2 Timeouts/retries/circuit breakers

Define per dependency:

- database;
- Telegram API;
- Scripture source;
- AI providers;
- payment/Stars flow;
- cache/queue.

Retries only for safe/idempotent operations. Use bounded exponential backoff/jitter. Circuit/open state produces user-safe fallback.

## 15.3 Graceful shutdown

- stop accepting new work;
- finish/abort requests safely;
- close sockets with recovery guidance;
- release DB connections;
- checkpoint jobs;
- avoid partial publication/payment/reward.

## 15.4 Data corruption detection

- ledger reconciliation;
- content publication hash;
- migration checksums;
- orphan relation checks;
- session sequence validation;
- cache version validation;
- alerts and repair runbook.

---

## 16. Backup and restore

Back up:

- production database;
- content revisions/publication sets;
- wallet/payment/entitlements;
- community/social data;
- relevant configuration/asset manifests;
- job/audit metadata according to policy.

Requirements:

- encrypted storage/access control;
- retention schedule;
- restore point/RPO target;
- recovery time/RTO target;
- restore into isolated environment;
- integrity verification;
- documented responsible owner;
- regular restore drill.

A backup job success metric without restore evidence is insufficient.

---

## 17. Observability

## 17.1 Logs

Structured logs include:

- timestamp;
- severity;
- service/build/environment;
- request/event/job/room ID;
- safe user correlation ID;
- error code;
- duration/outcome.

No raw secrets/initData/payment payloads/full private profiles.

## 17.2 Metrics

- API/realtime latency/error;
- auth failures;
- practice/lesson completion failures;
- content query/version errors;
- queue/job health;
- room connection/reconnect;
- wallet/payment reconciliation;
- cache hit/storage quota;
- frontend errors/chunk load;
- Web Vitals/real-user performance where privacy permits;
- accessibility preference usage aggregated;
- rollout cohort health.

## 17.3 Tracing

Trace critical multi-service flows where practical:

- login/profile;
- practice completion → progression → wallet → UI outcome;
- purchase/payment → entitlement;
- Kahoot final result → reward;
- content publication → client version;
- AI job lifecycle.

## 17.4 Alerts

Alerts must have actionable thresholds, owner and runbook. Avoid noisy alerts with no response plan.

---

## 18. Incident management

Create runbooks for:

- auth outage/forged identity concern;
- DB outage/corruption;
- bad content publication;
- wallet/payment mismatch;
- duplicated rewards;
- Kahoot/realtime outage;
- AI provider runaway cost;
- leaked secret;
- abusive community/content;
- broken theme/accessibility regression;
- frontend bad deploy/chunk mismatch.

Runbook includes:

- detection;
- severity;
- immediate containment/feature flags;
- data preservation;
- rollback/forward fix;
- user/support communication;
- verification;
- post-incident review.

---

## 19. CI/CD and environments

## 19.1 Environments

- local;
- test/CI;
- staging resembling production;
- production.

No production secrets/data in preview environments. Test data clearly marked.

## 19.2 Pipeline

Required gates:

- install/lockfile;
- lint;
- frontend/server typecheck;
- unit/integration/contract/security tests;
- migrations against clean and legacy fixtures;
- content/schema checks;
- accessibility automated checks;
- bundle/performance budgets;
- build;
- artifact integrity;
- staging deploy/smoke;
- controlled production deploy.

## 19.3 Migration deployment

- backup/compatibility check;
- expand/contract pattern;
- old/new client compatibility window;
- migration status/lock;
- rollback/forward-fix plan;
- no automatic destructive migration without explicit approval.

## 19.4 Release artifact

Tag/version includes:

- frontend/API/bot build versions;
- migration set;
- published content set;
- feature flag configuration reference;
- changelog;
- known limitations.

---

## 20. Staged rollout

Recommended sequence:

1. internal team accounts;
2. controlled church/youth alpha;
3. small beta cohort;
4. percentage production rollout;
5. region/platform/device monitoring;
6. expand only if error/performance/business/content metrics remain acceptable;
7. full release;
8. remove temporary compatibility flags after evidence.

Define rollback triggers:

- auth/security anomaly;
- data/ledger inconsistency;
- critical crash/error rate;
- performance regression;
- inaccessible core flow;
- bad content publication;
- payment/reward duplication;
- realtime instability.

---

## 21. Feature flags and kill switches

Inventory every active flag with:

- owner;
- purpose;
- environments;
- default;
- dependency;
- metrics;
- rollback effect;
- expiry/removal date.

Critical kill switches:

- disable new auth sessions if needed;
- read-only mode;
- disable rewards;
- disable purchases/payments;
- disable Content Studio publication/AI jobs;
- disable new communities/challenges;
- disable new Kahoot rooms;
- disable problematic theme/asset;
- restore previous content publication;
- disable sponsorship/ads.

Kill switches must not corrupt existing transactions/sessions.

---

## 22. Support and user communication

Prepare:

- help/FAQ;
- account/privacy/payment support flow;
- content error report;
- status/outage communication channel;
- known limitations;
- refund/support policy if monetized;
- accessibility contact;
- version/build diagnostics safe for users;
- localized Ukrainian messages.

Error screens should provide an action and reference code, not stack traces.

---

## 23. Release analytics and success metrics

Use metrics tied to product quality:

- successful onboarding/Today action;
- lesson/practice completion;
- error/abandon rate;
- review return;
- content error report rate/resolution;
- retention without manipulative streak pressure;
- realtime session success;
- purchase/payment success/support rate if enabled;
- performance by device/platform;
- accessibility/reduced-motion issue reports;
- incident count/time to recovery.

Do not optimize solely for session length or clicks if it conflicts with meaningful learning.

---

## 24. Test program

## 24.1 Performance

- cold/warm load;
- slow 3G/latency/loss;
- low-memory Android;
- long lesson/list;
- large community/leaderboard;
- max supported Kahoot room;
- theme switching;
- memory leak across repeated routes/games;
- bundle budget.

## 24.2 Offline/reconnect

- launch offline with/without cache;
- cached lesson;
- queued safe checkpoint;
- quota/corrupt cache;
- user switch/logout;
- background/foreground;
- API reconnect;
- Kahoot reconnect;
- payment offline rejection;
- version update while cached.

## 24.3 Accessibility

- automated axe/equivalent;
- keyboard;
- screen reader on mobile/desktop where practical;
- 200% text;
- contrast for every theme;
- reduced/minimal motion;
- correct/wrong states;
- dialogs/sheets/toasts;
- Kahoot/Millionaire;
- error/offline/purchase.

## 24.4 Reliability/security

- dependency outage;
- DB failover/restart;
- duplicate events;
- process graceful shutdown;
- migration failure;
- backup restore;
- bad content rollback;
- forged auth/permission;
- rate-limit/abuse;
- payment reconciliation;
- secret/config validation.

## 24.5 Release smoke

A documented end-to-end checklist from Telegram launch through:

- auth;
- Today;
- lesson;
- practice correct/wrong;
- progress;
- theme;
- community/challenge;
- Kahoot;
- Shop/purchase sandbox or disabled state;
- settings/privacy;
- report content;
- logout/reopen.

---

## 25. Conflicts and interactions

### Performance vs design

Premium visuals cannot exceed budgets. Hero imagery, shadows, fonts and particles degrade gracefully.

### Offline vs authority

Do not show local rewards/purchases/results as final. Offline convenience never bypasses authoritative reconciliation.

### Accessibility vs paid themes

A purchased theme cannot bypass accessibility. Disable/fix unsafe theme while preserving entitlement.

### Realtime vs scale

Do not launch public large rooms until load/recovery behavior is proven.

### AI/content vs availability

If AI providers fail, published learning still works. Content Studio generation can degrade independently.

### Monetization vs incident response

Purchases/payments can be disabled independently without taking core learning offline.

### Privacy vs observability

Use correlation IDs/aggregates rather than full payloads. Monitoring does not justify collecting sensitive spiritual/social data.

---

## 26. Forbidden shortcuts

- declaring offline because the shell opens;
- caching authenticated responses across users;
- granting rewards offline before server acceptance;
- releasing without restore drill;
- ignoring low-end Telegram devices;
- accessibility only on default theme;
- relying only on automated accessibility scans;
- logging secrets/full payment/profile payloads;
- deploying migrations with no compatibility plan;
- alerting without owner/runbook;
- shipping all flags permanently;
- public rollout before moderation/support readiness;
- treating staging with different architecture as sufficient proof;
- hiding performance regressions by increasing spinners/timeouts.

---

## 27. Definition of Done

Phase 7 is complete when:

1. Supported platforms/viewports are documented and tested.
2. Frontend/backend/realtime performance budgets pass.
3. Core routes do not deliver full question banks or unnecessary large assets.
4. Offline capabilities and limitations are implemented per feature class.
5. Queued offline mutations have safe reconciliation or are prohibited.
6. All active themes pass contrast/state/large-text/reduced-motion checks.
7. Critical flows pass keyboard/screen-reader/manual accessibility review.
8. Security hardening and current dependency/config reviews have no unresolved critical blockers.
9. Privacy/export/delete/retention behavior is implemented and documented.
10. Backup restore and migration rehearsal succeed.
11. Monitoring, alerts and incident runbooks are active and actionable.
12. CI/CD gates include tests, migrations, content, accessibility, bundle and staging smoke.
13. Critical feature kill switches are tested.
14. Controlled alpha/beta rollout meets defined health thresholds.
15. Full release smoke passes in Telegram Android/iOS and browser fallback.
16. README/deployment/support/changelog reflect production truth.
17. Known limitations and owner decisions are documented.

---

## 28. Rollback

Release rollback strategy includes:

- frontend artifact rollback;
- API/realtime version compatibility;
- feature flag disable;
- read-only mode;
- content publication rollback;
- theme disable/fallback;
- purchase/reward pause;
- job queue pause;
- no destructive DB downgrade when forward-fix is safer;
- data preservation and reconciliation after rollback;
- user/support communication.

Rollback is rehearsed in staging and at least critical flags are exercised before public launch.

---

## 29. Handoff to Phase 8

Phase 8 begins only after the core product has stable production metrics and operational capacity. It receives:

- reliable contracts/platform;
- measured performance budgets;
- accessibility/theme requirements;
- content/AI publication platform;
- social/realtime/economy services;
- offline/support/deployment foundations;
- expansion decision and experiment framework.

Bonus work must not reopen security, authority, accessibility or release-quality debt closed by Phase 1–7.
